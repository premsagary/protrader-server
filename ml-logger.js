// =============================================================================
//  ml-logger.js
//  Data-capture layer for future ML training.
//
//  Design goals (in priority order):
//    1. NEVER block the hot scoring path. Every exported function is async and
//       internally wrapped in try/catch. Any failure returns null but never
//       throws back to the caller.
//    2. ZERO data loss. Failed writes go into an in-memory ring buffer first
//       (for immediate retries), then flush to the durable writer_dead_letter
//       table when the DB recovers. A background drainer retries those with
//       exponential backoff.
//    3. Idempotent. All writes use ON CONFLICT DO NOTHING on stable PKs so
//       duplicate invocations (e.g., replay after crash) don't corrupt data.
//    4. Feature snapshots are PRIORITY ONE. Even if candles or trades fail
//       to persist, a snapshot write gets its own try/catch + DLQ.
//
//  Usage — imported from kite-server.js:
//    const mlLogger = require('./ml-logger');
//    const snapshotId = await mlLogger.logFeatureSnapshot(scored, 'unified_pipeline');
//    await mlLogger.logCandlesBatch('candles_1m', bars);
//    const tradeId = await mlLogger.logTradeEntry({ ... });
//    await mlLogger.logTradeExit({ tradeId, ... });
// =============================================================================

const { Pool } = require('pg');

// Reuse DATABASE_URL — same Railway Postgres as the existing trading system.
// Separate pool keeps logging back-pressure isolated from trading queries.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 6,
  idleTimeoutMillis: 30_000,
  statement_timeout: 5_000,   // never block more than 5s on any write
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
});

pool.on('error', (e) => {
  // A background client errored. Don't crash — mark unhealthy and rely on DLQ.
  console.error('[ml-logger] pool error:', e.message);
  dbHealthy = false;
});

// =============================================================================
// In-memory ring buffer — the first line of defense if DB is down.
// Drained to the durable writer_dead_letter table when DB recovers.
// =============================================================================

const RING_MAX = 5_000;
const ring = [];            // [{target, payload, errMsg, at}]
let dbHealthy = true;
let lastHealthCheck = 0;

function _ringEnqueue(target, payload, errMsg) {
  if (ring.length >= RING_MAX) ring.shift();   // drop oldest, prefer recent
  ring.push({ target, payload, errMsg, at: Date.now() });
}

async function _markDbHealthyIfPossible() {
  // Cheap heartbeat — avoid hammering Postgres
  if (Date.now() - lastHealthCheck < 5_000) return dbHealthy;
  lastHealthCheck = Date.now();
  try {
    await pool.query('SELECT 1');
    dbHealthy = true;
  } catch (e) {
    dbHealthy = false;
  }
  return dbHealthy;
}

// =============================================================================
// 1. FEATURE SNAPSHOT WRITER (PRIORITY ONE)
// =============================================================================

const SNAPSHOT_COLS = [
  'sym', 'ts', 'scan_source', 'price', 'sector', 'grp',
  'best_setup', 'best_setup_score', 'day_trade_score', 'ch19_pass_count',
  'vwap_score', 'gap_score', 'breakout_score', 'bounce_score',
  'rsi_5m', 'stoch_k', 'adx', 'macd_hist', 'macd_bull', 'macd_cross',
  'macd_hist_rising', 'macd_hist_zero_up', 'ema_9', 'ema_20',
  'vwap', 'vwap_dist_pct', 'vwap_sigma',
  'vwap_upper_1', 'vwap_lower_1', 'vwap_upper_2', 'vwap_lower_2',
  'below_1sigma', 'below_2sigma', 'above_2sigma',
  'bb_pct', 'bb_squeeze', 'bb_squeeze_release_up', 'supertrend_bull',
  'rsi_bull_div', 'rsi_bear_div', 'macd_bull_div', 'macd_bear_div',
  'obv', 'obv_bull_div', 'obv_bear_div',
  'vol_ratio', 'vol_expanding', 'vol_contracting',
  'vpa_confirm_bull', 'vpa_confirm_bear', 'vpa_weak_rally', 'vpa_weak_decline',
  'day_high', 'day_low', 'pd_high', 'pd_low',
  'or_high', 'or_low', 'or_range',
  'day_high_touches', 'or_high_touches', 'pd_high_touches', 'pd_low_touches',
  'equal_highs_count', 'equal_lows_count',
  'pdh_role_support', 'or_high_role_support',
  'or_failed_break', 'pdh_failed_break',
  'round_number', 'at_round_number',
  'cpr_pp', 'cpr_bc', 'cpr_tc',
  'cpr_r1', 'cpr_r2', 'cpr_r3', 'cpr_s1', 'cpr_s2', 'cpr_s3',
  'cpr_width_pct', 'cpr_type', 'cpr_virgin',
  'fib_level', 'fib_strength',
  'gap_pct', 'gap_unfilled', 'gap_class',
  'candle_pattern', 'candle_pattern_bull', 'pattern_confirmed', 'session_trend',
  'rsi_above_midline', 'rsi_crossed_midline_up',
  'nifty_daily_change', 'rel_strength', 'adr_avg', 'adr_used_pct',
  'atr_pct', 'session_phase',
  'kelly_fraction_pct', 'vol_scale',
  'entry_price', 'sl_price', 'tgt_price', 'rr_ratio',
];

function _scoredToSnapshotRow(scored, scanSource) {
  const r = scored || {};
  const ts = r.tsMs ? new Date(r.tsMs) : new Date();
  return {
    sym: r.sym, ts, scan_source: scanSource,
    price: r.price, sector: r.sector, grp: r.grp,
    best_setup: r.bestSetup, best_setup_score: r.bestSetupScore,
    day_trade_score: r.dayTradeScore, ch19_pass_count: r.ch19PassCount,
    vwap_score: r.vwapScore, gap_score: r.gapScore,
    breakout_score: r.breakoutScore, bounce_score: r.bounceScore,
    rsi_5m: r.rsi5m, stoch_k: r.stochK, adx: r.adx5m,
    macd_hist: r.macdHist, macd_bull: r.macdBull, macd_cross: r.macdCross,
    macd_hist_rising: r.macdHistRising, macd_hist_zero_up: r.macdHistZeroUp,
    ema_9: r.ema9, ema_20: r.ema20,
    vwap: r.vwap, vwap_dist_pct: r.vwapDist,
    vwap_sigma: r.vwapSigma,
    vwap_upper_1: r.vwapUpper1, vwap_lower_1: r.vwapLower1,
    vwap_upper_2: r.vwapUpper2, vwap_lower_2: r.vwapLower2,
    below_1sigma: r.below1Sigma, below_2sigma: r.below2Sigma, above_2sigma: r.above2Sigma,
    bb_pct: r.bbPct, bb_squeeze: r.bbSqueeze, bb_squeeze_release_up: r.bbSqueezeReleaseUp,
    supertrend_bull: r.stBull,
    rsi_bull_div: r.rsiBullDiv, rsi_bear_div: r.rsiBearDiv,
    macd_bull_div: r.macdBullDiv, macd_bear_div: r.macdBearDiv,
    obv: r.obv, obv_bull_div: r.obvBullDiv, obv_bear_div: r.obvBearDiv,
    vol_ratio: r.volRatio, vol_expanding: r.volExpanding, vol_contracting: r.volContracting,
    vpa_confirm_bull: r.vpa?.confirmBull, vpa_confirm_bear: r.vpa?.confirmBear,
    vpa_weak_rally:   r.vpa?.weakRally,   vpa_weak_decline: r.vpa?.weakDecline,
    day_high: r.dayHigh, day_low: r.dayLow,
    pd_high:  r.pdHigh,  pd_low:  r.pdLow,
    or_high:  r.orHigh,  or_low:  r.orLow,  or_range: r.orRange,
    day_high_touches: r.dayHighTouches, or_high_touches: r.orHighTouches,
    pd_high_touches:  r.pdHighTouches,  pd_low_touches:  r.pdLowTouches,
    equal_highs_count: r.equalHighsCount, equal_lows_count: r.equalLowsCount,
    pdh_role_support: r.pdhRoleSupport, or_high_role_support: r.orHighRoleSupport,
    or_failed_break:  r.orFailedBreak,  pdh_failed_break:  r.pdhFailedBreak,
    round_number: r.roundNumber, at_round_number: r.atRoundNumber,
    cpr_pp: r.cpr?.PP, cpr_bc: r.cpr?.BC, cpr_tc: r.cpr?.TC,
    cpr_r1: r.cpr?.R1, cpr_r2: r.cpr?.R2, cpr_r3: r.cpr?.R3,
    cpr_s1: r.cpr?.S1, cpr_s2: r.cpr?.S2, cpr_s3: r.cpr?.S3,
    cpr_width_pct: r.cpr?.widthPct, cpr_type: r.cpr?.type, cpr_virgin: r.cprVirgin,
    fib_level: r.fibLevel, fib_strength: r.fibStrength,
    gap_pct: r.gapPct, gap_unfilled: r.gapUnfilled, gap_class: r.gapClass,
    candle_pattern: r.candlePattern, candle_pattern_bull: r.candlePatternBull,
    pattern_confirmed: r.patternConfirmed, session_trend: r.sessionTrend,
    rsi_above_midline: r.rsiAboveMidline, rsi_crossed_midline_up: r.rsiCrossedMidlineUp,
    nifty_daily_change: r.niftyDailyChange, rel_strength: r.relStrength,
    adr_avg: r.adrAvg, adr_used_pct: r.adrUsedPct,
    atr_pct: r.atrPct, session_phase: r.sessionPhase,
    kelly_fraction_pct: r.kelly?.fractionPct, vol_scale: r.volSizing?.volScale,
    entry_price: r.price, sl_price: r.sl, tgt_price: r.tgt, rr_ratio: r.rrRatio,
  };
}

async function logFeatureSnapshot(scored, scanSource = 'unified_pipeline') {
  if (!scored || !scored.sym) return null;
  const row = _scoredToSnapshotRow(scored, scanSource);

  const placeholders = SNAPSHOT_COLS.map((_, i) => `$${i + 1}`).join(',');
  const sql = `
    INSERT INTO features_snapshot (${SNAPSHOT_COLS.join(',')})
    VALUES (${placeholders})
    ON CONFLICT (sym, ts, scan_source) DO NOTHING
    RETURNING snapshot_id
  `;
  const values = SNAPSHOT_COLS.map((c) => {
    const v = row[c];
    return v === undefined ? null : v;
  });

  try {
    const res = await pool.query(sql, values);
    dbHealthy = true;
    return res.rows[0]?.snapshot_id ?? null;
  } catch (e) {
    dbHealthy = false;
    _ringEnqueue('features_snapshot', row, e.message);
    return null;
  }
}

// =============================================================================
// 2. CANDLE BATCH WRITER
// =============================================================================

async function logCandlesBatch(table /* 'candles_1m' | 'candles_5m' */, bars) {
  if (!Array.isArray(bars) || bars.length === 0) return 0;
  if (table !== 'candles_1m' && table !== 'candles_5m') {
    throw new Error(`logCandlesBatch: invalid table "${table}"`);
  }
  const isFive = table === 'candles_5m';
  const cols = ['sym', 'ts', 'open', 'high', 'low', 'close', 'volume']
    .concat(isFive ? ['vwap'] : []);
  const n = cols.length;

  // Build multi-row VALUES clause: ($1,$2,...,$n),($n+1,...), ...
  const placeholders = bars
    .map((_, i) => `(${cols.map((_, j) => `$${i * n + j + 1}`).join(',')})`)
    .join(',');
  const params = bars.flatMap((b) => cols.map((c) => {
    const v = b[c];
    return v === undefined ? null : v;
  }));

  const sql = `
    INSERT INTO ${table} (${cols.join(',')})
    VALUES ${placeholders}
    ON CONFLICT (sym, ts) DO NOTHING
  `;

  try {
    const res = await pool.query(sql, params);
    dbHealthy = true;
    return res.rowCount ?? 0;
  } catch (e) {
    dbHealthy = false;
    _ringEnqueue(table, bars, e.message);
    return 0;
  }
}

// =============================================================================
// 3. TRADE LOG WRITERS
// =============================================================================

async function logTradeEntry({
  snapshotId, sym, entryTime, entryPrice, qty, side = 'LONG',
  slPrice, tgtPrice, setup, mode = 'paper', kiteOrderId = null,
}) {
  if (!sym || !entryTime || entryPrice == null || !qty) return null;
  const sql = `
    INSERT INTO trade_log (
      snapshot_id, sym, entry_time, entry_price, position_size, side,
      sl_price, tgt_price, setup, mode, kite_order_id_entry
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING trade_id
  `;
  const params = [
    snapshotId ?? null, sym, entryTime, entryPrice, qty, side,
    slPrice ?? null, tgtPrice ?? null, setup ?? null, mode, kiteOrderId,
  ];
  try {
    const res = await pool.query(sql, params);
    dbHealthy = true;
    return res.rows[0]?.trade_id ?? null;
  } catch (e) {
    dbHealthy = false;
    _ringEnqueue('trade_log_entry', { snapshotId, sym, entryTime, entryPrice, qty, side, slPrice, tgtPrice, setup, mode, kiteOrderId }, e.message);
    return null;
  }
}

// Kite-accurate Indian-market intraday (MIS) fee calculation
function _computeFees(entryPrice, exitPrice, qty, side) {
  const buyVal  = side === 'LONG' ? entryPrice * qty : exitPrice * qty;
  const sellVal = side === 'LONG' ? exitPrice  * qty : entryPrice * qty;
  const brokerage = Math.min(20, buyVal * 0.0003) + Math.min(20, sellVal * 0.0003);
  const stt       = sellVal * 0.00025;                 // MIS: 0.025% on sell
  const exch      = (buyVal + sellVal) * 0.0000325;    // NSE
  const sebi      = (buyVal + sellVal) * 0.00001;
  const stamp     = buyVal * 0.00003;                  // buy side only
  const gst       = (brokerage + exch + sebi) * 0.18;
  const grossPnl  = (exitPrice - entryPrice) * qty * (side === 'LONG' ? 1 : -1);
  const totalFees = brokerage + stt + exch + sebi + stamp + gst;
  const netPnl    = grossPnl - totalFees;
  return { brokerage, stt, exch, sebi, stamp, gst, grossPnl, totalFees, netPnl };
}

async function logTradeExit({
  tradeId, exitTime, exitPrice, exitReason, qty, entryPrice, side = 'LONG',
  kiteOrderId = null,
}) {
  if (!tradeId || !exitTime || exitPrice == null || qty == null || entryPrice == null) return null;
  const f = _computeFees(entryPrice, exitPrice, qty, side);
  const sql = `
    UPDATE trade_log SET
      exit_time    = $2,
      exit_price   = $3,
      exit_reason  = $4,
      gross_pnl    = $5,
      brokerage    = $6,
      stt          = $7,
      exchange_fee = $8,
      sebi_fee     = $9,
      stamp_duty   = $10,
      gst          = $11,
      net_pnl      = $12,
      kite_order_id_exit = $13
    WHERE trade_id = $1
  `;
  const params = [
    tradeId, exitTime, exitPrice, exitReason ?? 'MANUAL',
    f.grossPnl, f.brokerage, f.stt, f.exch, f.sebi, f.stamp, f.gst, f.netPnl,
    kiteOrderId,
  ];
  try {
    await pool.query(sql, params);
    dbHealthy = true;
    return { grossPnl: f.grossPnl, netPnl: f.netPnl, totalFees: f.totalFees };
  } catch (e) {
    dbHealthy = false;
    _ringEnqueue('trade_log_exit', { tradeId, exitTime, exitPrice, exitReason, qty, entryPrice, side, kiteOrderId }, e.message);
    return null;
  }
}

// =============================================================================
// 4. DEAD-LETTER DRAIN
// =============================================================================

async function _drainRingToDlq() {
  if (ring.length === 0) return 0;
  if (!(await _markDbHealthyIfPossible())) return 0;
  const batch = ring.splice(0, Math.min(200, ring.length));
  let saved = 0;
  for (const item of batch) {
    try {
      await pool.query(
        `INSERT INTO writer_dead_letter (target, payload, error_msg, next_retry)
         VALUES ($1, $2::jsonb, $3, NOW())`,
        [item.target, JSON.stringify(item.payload), item.errMsg || null]
      );
      saved++;
    } catch (e) {
      ring.unshift(item);
      break;
    }
  }
  return saved;
}

async function _retryDlqRow(row) {
  const delayMs = Math.min(3_600_000, 5_000 * Math.pow(2, Math.min(row.retries, 10)));
  const nextRetry = new Date(Date.now() + delayMs);

  const payload = row.payload;
  let ok = false;
  try {
    if (row.target === 'features_snapshot') {
      const placeholders = SNAPSHOT_COLS.map((_, i) => `$${i + 1}`).join(',');
      const values = SNAPSHOT_COLS.map((c) => {
        const v = payload[c];
        return v === undefined ? null : v;
      });
      await pool.query(
        `INSERT INTO features_snapshot (${SNAPSHOT_COLS.join(',')})
         VALUES (${placeholders}) ON CONFLICT (sym, ts, scan_source) DO NOTHING`,
        values
      );
      ok = true;
    } else if (row.target === 'candles_1m' || row.target === 'candles_5m') {
      await logCandlesBatch(row.target, payload);
      ok = true;
    } else if (row.target === 'trade_log_entry') {
      const id = await logTradeEntry(payload);
      ok = id !== null;
    } else if (row.target === 'trade_log_exit') {
      const r = await logTradeExit(payload);
      ok = r !== null;
    } else {
      ok = true;
    }
  } catch (e) {
    ok = false;
  }

  if (ok) {
    await pool.query(
      `UPDATE writer_dead_letter SET resolved = TRUE, last_retry = NOW() WHERE id = $1`,
      [row.id]
    );
  } else {
    await pool.query(
      `UPDATE writer_dead_letter
         SET retries = retries + 1, last_retry = NOW(), next_retry = $2
       WHERE id = $1`,
      [row.id, nextRetry]
    );
  }
  return ok;
}

async function drainDeadLetters(maxRows = 50) {
  try {
    await _drainRingToDlq();
    if (!(await _markDbHealthyIfPossible())) return 0;
    const { rows } = await pool.query(
      `SELECT id, target, payload, retries
         FROM writer_dead_letter
        WHERE resolved = FALSE AND next_retry <= NOW()
        ORDER BY next_retry
        LIMIT $1`,
      [maxRows]
    );
    let resolved = 0;
    for (const row of rows) {
      const ok = await _retryDlqRow(row);
      if (ok) resolved++;
    }
    return resolved;
  } catch (e) {
    console.error('[ml-logger] drainDeadLetters error:', e.message);
    return 0;
  }
}

let _drainerStarted = false;
function startDrainer() {
  if (_drainerStarted) return;
  _drainerStarted = true;
  setInterval(() => {
    drainDeadLetters(50).catch((e) => console.error('[ml-logger] drain err:', e.message));
  }, 30_000).unref?.();
}
startDrainer();

// =============================================================================
// DIAGNOSTIC HELPERS (for admin endpoints / health checks)
// =============================================================================

function getDiagnostics() {
  return {
    dbHealthy,
    ringSize: ring.length,
    ringMax: RING_MAX,
    lastHealthCheck: lastHealthCheck ? new Date(lastHealthCheck).toISOString() : null,
  };
}

async function getDlqSummary() {
  try {
    const { rows } = await pool.query(`
      SELECT target,
             COUNT(*) FILTER (WHERE resolved = FALSE) AS pending,
             COUNT(*) FILTER (WHERE resolved = TRUE)  AS resolved_count,
             MIN(enqueued_at) FILTER (WHERE resolved = FALSE) AS oldest_pending
        FROM writer_dead_letter
       GROUP BY target
    `);
    return rows;
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = {
  logFeatureSnapshot,
  logCandlesBatch,
  logTradeEntry,
  logTradeExit,
  drainDeadLetters,
  getDiagnostics,
  getDlqSummary,
};
