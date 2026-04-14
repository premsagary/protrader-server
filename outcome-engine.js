// =============================================================================
//  outcome-engine.js
//  Lookahead-safe outcome computation for the ML training dataset.
//
//  WHAT IT DOES:
//    For every row in features_snapshot that is >= 31 minutes old and does not
//    yet have a matching row in outcome_metrics, pull the 1-min candles from
//    candles_1m covering [ts+1min, ts+30min] and compute:
//      - MFE (max favourable excursion) + timestamp
//      - MAE (max adverse excursion) + timestamp
//      - Close-to-close returns at 5/15/30/60 min (nearest-bar match)
//      - Realised vol (std dev of 1-min returns)
//      - Time-to-first-hit at ±0.3/0.5/0.8/1.0% barriers
//
//    Label columns are explicitly left NULL — they get populated in the ML
//    phase, not here.
//
//  LOOKAHEAD SAFETY:
//    1. The SQL filter on ts < NOW() - 31 minutes ensures we only process
//       snapshots whose full outcome window (T to T+30) is already in the
//       past at query time. We physically cannot see data that wasn't
//       available at T+30.
//    2. The candle window uses ts > snapshot.ts (strict), never >=.
//       So a bar at exactly T cannot influence the outcome derived from T.
//    3. All work is done asynchronously via cron. The scoring path never
//       computes or references an outcome.
//
//  INVOCATION:
//    Scheduled: cron '*/5 * * * *' (every 5 min, 24×7 — cheap no-op if no
//    pending rows). Safe to run manually any time via the admin endpoint
//    POST /api/admin/outcome-engine/run added in this commit.
// =============================================================================

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
  idleTimeoutMillis: 30_000,
  statement_timeout: 10_000,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
});

const WINDOW_MIN      = 30;        // outcome window length in minutes
const LOOKAHEAD_SAFETY = 1;        // extra minute buffer beyond WINDOW_MIN
const HORIZONS_MIN    = [5, 15, 30, 60];
const BARRIERS_PCT    = [0.3, 0.5, 0.8, 1.0];

let _running = false;

async function computeOutcomes(batchSize = 500) {
  if (_running) return { skipped: true, reason: 'already_running' };
  _running = true;
  const t0 = Date.now();
  let processed = 0, skipped = 0, insufficient = 0, failed = 0;

  try {
    // Pull snapshots whose outcome window is safely in the past.
    // LEFT JOIN filter ensures we never re-process rows already computed.
    const { rows: snaps } = await pool.query(`
      SELECT fs.snapshot_id, fs.sym, fs.ts, fs.price
        FROM features_snapshot fs
        LEFT JOIN outcome_metrics om
               ON om.sym = fs.sym AND om.ts = fs.ts
       WHERE om.snapshot_id IS NULL
         AND fs.ts < NOW() - INTERVAL '${WINDOW_MIN + LOOKAHEAD_SAFETY} minutes'
       ORDER BY fs.ts
       LIMIT $1
    `, [batchSize]);

    for (const s of snaps) {
      try {
        // Fetch 1-min candles strictly AFTER ts, up to ts + 30 min.
        // Strict > is critical: a bar at exactly T cannot be part of T's
        // outcome. This is the core lookahead guarantee.
        const { rows: bars } = await pool.query(`
          SELECT ts, open, high, low, close
            FROM candles_1m
           WHERE sym = $1
             AND ts >  $2::timestamptz
             AND ts <= $2::timestamptz + INTERVAL '${WINDOW_MIN} minutes'
           ORDER BY ts
        `, [s.sym, s.ts]);

        // Need at least a handful of bars — otherwise defer to next cycle
        // when more data may have arrived (e.g., Kite backfill catching up).
        if (bars.length < 3) { insufficient++; continue; }

        const entry = parseFloat(s.price);
        if (!entry || entry <= 0) { skipped++; continue; }

        // ── Walk bars once, collect everything ────────────────────────
        let mfePrice = entry, mfeTs = null;
        let maePrice = entry, maeTs = null;
        const returns1m = [];
        let prevClose = entry;

        // Barrier first-hit tracking
        const timeToBarrier = {};
        for (const p of BARRIERS_PCT) {
          timeToBarrier[`plus_${p}`]  = null;
          timeToBarrier[`minus_${p}`] = null;
        }

        const tSnap = new Date(s.ts).getTime();

        for (const b of bars) {
          const hi = parseFloat(b.high);
          const lo = parseFloat(b.low);
          const cl = parseFloat(b.close);
          const barMs = new Date(b.ts).getTime();

          if (hi > mfePrice) { mfePrice = hi; mfeTs = b.ts; }
          if (lo < maePrice) { maePrice = lo; maeTs = b.ts; }

          returns1m.push((cl - prevClose) / prevClose);
          prevClose = cl;

          const ageSec = Math.max(0, Math.floor((barMs - tSnap) / 1000));
          for (const p of BARRIERS_PCT) {
            const upLvl = entry * (1 + p / 100);
            const dnLvl = entry * (1 - p / 100);
            const kPlus  = `plus_${p}`;
            const kMinus = `minus_${p}`;
            if (hi >= upLvl && timeToBarrier[kPlus]  === null) timeToBarrier[kPlus]  = ageSec;
            if (lo <= dnLvl && timeToBarrier[kMinus] === null) timeToBarrier[kMinus] = ageSec;
          }
        }

        // ── Close-to-close returns at 5/15/30/60 min ─────────────────
        // Nearest-bar match within ±1 min tolerance. Null if no candle
        // near the horizon (common for the 60-min one with 30-min window).
        const horizonReturns = {};
        for (const h of HORIZONS_MIN) {
          const targetMs = tSnap + h * 60_000;
          let best = null, bestDelta = Infinity;
          for (const b of bars) {
            const delta = Math.abs(new Date(b.ts).getTime() - targetMs);
            if (delta < bestDelta && delta <= 60_000) { best = b; bestDelta = delta; }
          }
          horizonReturns[h] = best ? ((parseFloat(best.close) - entry) / entry) * 100 : null;
        }

        // ── Realised vol = std dev of 1-min returns ──────────────────
        const mean = returns1m.reduce((a, r) => a + r, 0) / returns1m.length;
        const variance = returns1m.reduce((a, r) => a + (r - mean) ** 2, 0) / returns1m.length;
        const volDuring = Math.sqrt(variance);

        const mfePct = ((mfePrice - entry) / entry) * 100;
        const maePct = ((maePrice - entry) / entry) * 100;

        await pool.query(`
          INSERT INTO outcome_metrics (
            snapshot_id, sym, ts, entry_ref_price,
            mfe_price, mfe_ts, mfe_pct,
            mae_price, mae_ts, mae_pct,
            ret_5m_pct, ret_15m_pct, ret_30m_pct, ret_60m_pct,
            vol_during_window, bars_observed,
            time_to_plus_0_3pct,  time_to_plus_0_5pct,  time_to_plus_0_8pct,  time_to_plus_1_0pct,
            time_to_minus_0_3pct, time_to_minus_0_5pct, time_to_minus_0_8pct, time_to_minus_1_0pct
          ) VALUES (
            $1,$2,$3,$4,
            $5,$6,$7,
            $8,$9,$10,
            $11,$12,$13,$14,
            $15,$16,
            $17,$18,$19,$20,
            $21,$22,$23,$24
          )
          ON CONFLICT (sym, ts) DO UPDATE SET
            mfe_price = EXCLUDED.mfe_price,
            mfe_ts    = EXCLUDED.mfe_ts,
            mfe_pct   = EXCLUDED.mfe_pct,
            mae_price = EXCLUDED.mae_price,
            mae_ts    = EXCLUDED.mae_ts,
            mae_pct   = EXCLUDED.mae_pct,
            ret_5m_pct  = EXCLUDED.ret_5m_pct,
            ret_15m_pct = EXCLUDED.ret_15m_pct,
            ret_30m_pct = EXCLUDED.ret_30m_pct,
            ret_60m_pct = EXCLUDED.ret_60m_pct,
            vol_during_window = EXCLUDED.vol_during_window,
            bars_observed = EXCLUDED.bars_observed,
            computed_at = NOW(),
            computed_version = 'v1'
        `, [
          s.snapshot_id, s.sym, s.ts, entry,
          mfePrice, mfeTs, mfePct,
          maePrice, maeTs, maePct,
          horizonReturns[5], horizonReturns[15], horizonReturns[30], horizonReturns[60],
          volDuring, bars.length,
          timeToBarrier['plus_0.3'],  timeToBarrier['plus_0.5'],  timeToBarrier['plus_0.8'],  timeToBarrier['plus_1']  || timeToBarrier['plus_1.0'],
          timeToBarrier['minus_0.3'], timeToBarrier['minus_0.5'], timeToBarrier['minus_0.8'], timeToBarrier['minus_1'] || timeToBarrier['minus_1.0'],
        ]);
        processed++;
      } catch (e) {
        failed++;
        console.error(`[outcome-engine] row ${s.sym}@${s.ts} error:`, e.message);
      }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[outcome-engine] ${processed} processed · ${insufficient} insufficient · ${failed} failed · ${skipped} skipped · ${elapsed}s`);
    return { processed, insufficient, failed, skipped, elapsed };
  } finally {
    _running = false;
  }
}

// When required by kite-server.js: exports computeOutcomes for the admin
// endpoint, plus a convenience runner for the cron.
module.exports = {
  computeOutcomes,
  isRunning: () => _running,
};

// Standalone CLI mode (for one-shot backfills or cron)
if (require.main === module) {
  (async () => {
    const n = await computeOutcomes(parseInt(process.argv[2] || '500', 10));
    console.log(JSON.stringify(n));
    await pool.end();
  })().catch(e => { console.error(e); process.exit(1); });
}
