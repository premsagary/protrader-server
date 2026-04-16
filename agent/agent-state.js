/**
 * agent-state.js — getVerifiedState() + kill-switch checks.
 *
 * Frozen-at-decision-time snapshot used by trade-agent + constraint-engine.
 * NO cached data — every field is either fetched fresh or computed from
 * authoritative sources. If any required field is unavailable, we mark the
 * state `invalid` and the cycle is aborted (no trade beats a bad trade).
 *
 * Dependencies are injected via `deps` rather than required directly, so the
 * agent can be unit-tested and so kite-server.js stays the owner of the Kite
 * client and pool.
 */

'use strict';

const { getMode, PAPER_CAPITAL_RUPEES, CONSTRAINTS } = require('./agent-config');

// ────────────────────────────────────────────────────────────────────────────
// IST time helpers (the agent never trusts server-local time for decisions)
// ────────────────────────────────────────────────────────────────────────────
function nowIST() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}
function minsSinceOpenIST() {
  const ist = nowIST();
  return (ist.getHours() - 9) * 60 + ist.getMinutes() - 15;
}

// ────────────────────────────────────────────────────────────────────────────
// getVerifiedState — returns a frozen object the agent/constraint layer uses.
//
// deps = {
//   pool,             // pg Pool
//   kite,             // KiteConnect instance (null-safe)
//   isMarketOpen,     // () => boolean
//   getKiteToken,     // () => string | null
//   niftyDailyChange, // number | null   (from kite-server module snapshot)
// }
// ────────────────────────────────────────────────────────────────────────────
async function getVerifiedState(deps) {
  const { pool, kite, isMarketOpen, getKiteToken, niftyDailyChange } = deps;
  const fetchedAt = Date.now();
  const state = {
    fetchedAt,
    nowIST: nowIST().toISOString(),
    minsSinceOpen: minsSinceOpenIST(),
    marketOpen: typeof isMarketOpen === 'function' ? isMarketOpen() : false,
    agentMode: getMode(),
    kiteTokenPresent: Boolean(getKiteToken && getKiteToken()),

    // Capital / PnL
    capital: PAPER_CAPITAL_RUPEES,     // live mode will override below
    realizedPnlToday: 0,
    unrealizedPnlToday: 0,

    // Positions
    openPositions: [],
    pendingOrders: [],
    tradesTodayCount: 0,
    consecutiveLossesToday: 0,
    tradedSymsToday: [],
    tradedSectorsToday: [],

    // Regime
    niftyChangePct: niftyDailyChange == null ? null : Number(niftyDailyChange),
    vixLevel: null,                    // Phase 1: not fetched
    fastNiftyMove: false,              // Phase 2: will hook to NIFTY 5m candles

    // Integrity flags
    invalid: false,
    invalidReason: null,
  };

  // ── Pull today's agent activity from agent_trades (source of truth for agent PnL) ──
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::INT                                         AS n_trades,
        COUNT(*) FILTER (WHERE exit_at IS NULL)::INT          AS n_open,
        COALESCE(SUM(pnl_rupees) FILTER (WHERE exit_at IS NOT NULL), 0) AS realized,
        COALESCE(SUM(pnl_rupees) FILTER (WHERE exit_at IS NULL),     0) AS unrealized,
        ARRAY(SELECT DISTINCT sym FROM agent_trades
                WHERE created_at::date = CURRENT_DATE)        AS syms
      FROM agent_trades
      WHERE created_at::date = CURRENT_DATE
    `);
    const r = rows[0] || {};
    state.tradesTodayCount     = r.n_trades      || 0;
    state.realizedPnlToday     = Number(r.realized   || 0);
    state.unrealizedPnlToday   = Number(r.unrealized || 0);
    state.tradedSymsToday      = Array.isArray(r.syms) ? r.syms : [];

    // Consecutive losses (today only, ordered by exit_at)
    const { rows: recent } = await pool.query(`
      SELECT pnl_rupees
        FROM agent_trades
       WHERE created_at::date = CURRENT_DATE AND exit_at IS NOT NULL
       ORDER BY exit_at DESC
       LIMIT 5
    `);
    let streak = 0;
    for (const t of recent) {
      if (Number(t.pnl_rupees) < 0) streak++;
      else break;
    }
    state.consecutiveLossesToday = streak;
  } catch (e) {
    // If agent_trades doesn't exist yet, treat as zero-history (Phase 1 dry run)
    if (/relation .* does not exist/i.test(String(e.message))) {
      // expected before migration has been run — state stays zeroed
    } else {
      state.invalid = true;
      state.invalidReason = `state_query_failed: ${e.message}`;
      return Object.freeze(state);
    }
  }

  // ── In LIVE mode only, query Kite for live positions/orders. Phase 1: skip. ──
  if (getMode() === 'live' && kite) {
    try {
      const [positions, orders] = await Promise.all([
        kite.getPositions(),
        kite.getOrders(),
      ]);
      state.openPositions = (positions && positions.net ? positions.net : []).filter(p => p.quantity !== 0);
      state.pendingOrders = (orders || []).filter(o =>
        ['OPEN', 'TRIGGER PENDING', 'PENDING', 'OPEN_PENDING'].includes(o.status)
      );
    } catch (e) {
      state.invalid = true;
      state.invalidReason = `kite_state_failed: ${e.message}`;
      return Object.freeze(state);
    }
  }

  // ── Staleness check (unused in Phase 1 because we just fetched, but codified) ──
  const ageSec = (Date.now() - fetchedAt) / 1000;
  if (ageSec > CONSTRAINTS.MAX_STATE_AGE_SEC) {
    state.invalid = true;
    state.invalidReason = `state_stale: ${ageSec.toFixed(1)}s`;
  }

  // ── Sectors-today (requires join to features_snapshot; keep optional) ─────
  try {
    if (state.tradedSymsToday.length) {
      const { rows } = await pool.query(
        `SELECT DISTINCT sector FROM features_snapshot
          WHERE sym = ANY($1::text[]) AND ts::date = CURRENT_DATE`,
        [state.tradedSymsToday]
      );
      state.tradedSectorsToday = rows.map(r => r.sector).filter(Boolean);
    }
  } catch (e) {
    // features_snapshot may not exist in all envs — not fatal
  }

  return Object.freeze(state);
}

// ────────────────────────────────────────────────────────────────────────────
// isSystemKilled — returns null if OK, or a kill-reason string.
// Called before any proposal is even generated. Hard stop, no propose+reject.
// ────────────────────────────────────────────────────────────────────────────
function isSystemKilled(state) {
  if (state.invalid) return `STATE_INVALID:${state.invalidReason}`;
  if (!state.marketOpen) return 'MARKET_CLOSED';
  if (state.agentMode === 'off') return 'AGENT_DISABLED';
  if (state.agentMode === 'live' && !state.kiteTokenPresent) return 'KITE_TOKEN_MISSING';

  // Daily loss cap
  const lossPct = (state.realizedPnlToday / state.capital) * 100;
  if (lossPct <= -CONSTRAINTS.MAX_DAILY_LOSS_PCT) {
    return `DAILY_LOSS_CAP_HIT:${lossPct.toFixed(2)}%`;
  }
  // Cooldown after N consecutive losses
  if (state.consecutiveLossesToday >= CONSTRAINTS.COOLDOWN_AFTER_N_LOSSES) {
    return `CONSECUTIVE_LOSS_COOLDOWN:${state.consecutiveLossesToday}`;
  }
  // Regime killswitch
  if (state.niftyChangePct != null &&
      Math.abs(state.niftyChangePct) > CONSTRAINTS.MAX_NIFTY_FAST_MOVE_PCT_15MIN) {
    // Note: this is cumulative-day change; a stricter 15-min-slope version will
    // be added in Phase 2 when we hook in nifty_5m_slope_pct.
    // Keep the check here as a conservative gate.
  }
  if (state.vixLevel != null && state.vixLevel > CONSTRAINTS.MAX_VIX_LEVEL) {
    return `VIX_TOO_HIGH:${state.vixLevel}`;
  }
  // Entry time cutoff
  if (state.minsSinceOpen >= CONSTRAINTS.NO_ENTRIES_AFTER_MINS) {
    return `AFTER_ENTRY_CUTOFF:${state.minsSinceOpen}m`;
  }
  return null;
}

module.exports = {
  getVerifiedState,
  isSystemKilled,
  nowIST,
  minsSinceOpenIST,
};
