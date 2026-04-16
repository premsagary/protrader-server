/**
 * robotrade-guards.js — institutional-grade guards that the existing Stocks
 * RoboTrade path was missing.
 *
 * Three independent helpers, all pure-ish (DB-backed but testable with a pool
 * mock):
 *
 *   1. checkDailyLossCap(pool, equity)
 *      Blocks new entries once realized PnL (today, calendar-reset at IST
 *      midnight by date filter) drops below -DAILY_LOSS_CAP_PCT × equity.
 *      Fills the Varsity M9 Ch 6 gap — the existing drawdown check is a
 *      rolling high-water mark, not a daily stop.
 *
 *   2. shouldTimeExit(position, nowMs, cfg)
 *      Returns true if an open position has been held beyond MAX_HOLD_HOURS.
 *      Prevents the "position stays open for days" failure mode Varsity M9
 *      warns against for intraday-style swing setups.
 *
 *   3. loadHwmFromDb(pool) / persistHwm(pool, posKey, hwm)
 *      Hydrates + persists _posHighWaterMark so trailing stops survive
 *      Railway restarts. Before this, an unlucky redeploy would reset every
 *      trailing stop back to entry-1ATR, giving back profits.
 *
 * All three are pure additions — they do not modify existing behavior when
 * the caller opts out (pass cfg.enabled=false). This is deliberate so the
 * patch is zero-risk to deploy.
 */

'use strict';

// Default thresholds — caller can override by passing a cfg object. The
// CONFIG block in kite-server.js provides production values; defaults here
// match those so unit tests don't need to mock CONFIG.
const DEFAULT_CFG = Object.freeze({
  DAILY_LOSS_CAP_PCT: 0.02,    // 2% — matches Varsity M9 recommendation
  MAX_HOLD_HOURS:     6,        // intraday / short-swing tolerance
  // Per-setup overrides. Breakouts should resolve fast; bounces can take
  // longer. These are optional; if a setup isn't listed the default applies.
  MAX_HOLD_HOURS_BY_SETUP: Object.freeze({
    BREAKOUT:        4,        // fail fast on breakouts — they confirm quickly
    GAP_AND_GO:      3,        // gap momentum is a first-90-min play
    VWAP_RECLAIM:    6,
    OVERSOLD_BOUNCE: 6,
  }),
  ENABLED: true,
});

// ────────────────────────────────────────────────────────────────────────────
// 1. Daily loss cap
// ────────────────────────────────────────────────────────────────────────────
// Returns { tripped, realizedToday, cap, pctUsed, reason? }.
// tripped=true means the caller MUST NOT open new positions today. The check
// uses IST date boundaries by filtering on CURRENT_DATE in the caller's DB
// timezone — which is what paper_trades' entry_time/exit_time already use.
async function checkDailyLossCap(pool, equity, cfg = {}) {
  const c = { ...DEFAULT_CFG, ...cfg };
  if (!c.ENABLED) return { tripped: false, reason: 'disabled' };
  if (!pool || !equity || equity <= 0) {
    return { tripped: false, reason: 'missing_inputs', realizedToday: 0, cap: 0 };
  }

  let realizedToday = 0;
  try {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(pnl), 0)::NUMERIC AS realized
        FROM paper_trades
       WHERE status = 'CLOSED'
         AND exit_time::date = CURRENT_DATE
    `);
    realizedToday = Number(rows[0] && rows[0].realized || 0);
  } catch (e) {
    // Table missing or DB hiccup — don't block trading on infra error.
    // Drawdown circuit breaker is the backstop.
    return { tripped: false, reason: `query_failed:${e.message}` };
  }

  const capRupees = -equity * c.DAILY_LOSS_CAP_PCT;  // negative — e.g. -1800 on 90k
  const tripped = realizedToday <= capRupees;
  const pctUsed = equity > 0 ? Math.min(1, Math.abs(realizedToday / capRupees)) : 0;

  return {
    tripped,
    realizedToday: +realizedToday.toFixed(2),
    cap: +capRupees.toFixed(2),
    pctUsed: +pctUsed.toFixed(3),
    reason: tripped
      ? `daily_loss_cap_hit:${realizedToday.toFixed(0)}<=${capRupees.toFixed(0)}`
      : null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Time-decay exit
// ────────────────────────────────────────────────────────────────────────────
// Pure function — no DB. Takes an open position row + the current moment.
// Returns { exit: bool, reason, heldHours, maxHours }.
//
// The position shape matches what scanAndTrade already has: it uses
// paper_trades columns `entry_time` (timestamp) and `strategy` (setup label
// like 'BREAKOUT' / 'GAP_AND_GO' / 'VWAP_RECLAIM' / 'OVERSOLD_BOUNCE').
function shouldTimeExit(position, nowMs = Date.now(), cfg = {}) {
  const c = { ...DEFAULT_CFG, ...cfg };
  if (!c.ENABLED) return { exit: false, reason: 'disabled' };
  if (!position || !position.entry_time) {
    return { exit: false, reason: 'no_entry_time' };
  }

  const entryMs = new Date(position.entry_time).getTime();
  if (!Number.isFinite(entryMs) || entryMs <= 0) {
    return { exit: false, reason: 'invalid_entry_time' };
  }

  const heldHours = (nowMs - entryMs) / 3_600_000;
  if (heldHours < 0) return { exit: false, reason: 'entry_in_future' };

  // Resolve max hold — per-setup override falls back to default
  const setup = (position.strategy || '').toUpperCase();
  const maxHours = (c.MAX_HOLD_HOURS_BY_SETUP && c.MAX_HOLD_HOURS_BY_SETUP[setup])
    ? c.MAX_HOLD_HOURS_BY_SETUP[setup]
    : c.MAX_HOLD_HOURS;

  if (heldHours >= maxHours) {
    return {
      exit: true,
      reason: `time_exit_${maxHours}h`,
      heldHours: +heldHours.toFixed(2),
      maxHours,
      setup: setup || 'UNKNOWN',
    };
  }
  return { exit: false, heldHours: +heldHours.toFixed(2), maxHours, setup };
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Daily trade count cap (over-trading guard)
// ────────────────────────────────────────────────────────────────────────────
// Returns { tripped, countToday, cap, reason? }.
// Counts the number of trades OPENED today (regardless of whether they've
// closed yet), so a burst of 6 entries at 10am blocks further entries at
// 10:05 even if none have closed. Addresses the failure mode where the
// scanner fires 15+ entries per day and death-by-a-thousand-cuts eats PnL.
async function checkTradeCountCap(pool, cfg = {}) {
  const maxPerDay = cfg.MAX_TRADES_PER_DAY != null ? cfg.MAX_TRADES_PER_DAY : 8;
  if (!pool || !Number.isFinite(maxPerDay) || maxPerDay <= 0) {
    return { tripped: false, reason: 'invalid_config', countToday: 0, cap: maxPerDay };
  }

  let countToday = 0;
  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*)::INT AS n
        FROM paper_trades
       WHERE entry_time::date = CURRENT_DATE
    `);
    countToday = Number(rows[0] && rows[0].n || 0);
  } catch (e) {
    return { tripped: false, reason: `query_failed:${e.message}`, countToday: 0, cap: maxPerDay };
  }

  const tripped = countToday >= maxPerDay;
  return {
    tripped,
    countToday,
    cap: maxPerDay,
    reason: tripped ? `trade_count_cap_hit:${countToday}>=${maxPerDay}` : null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 4. HWM persistence
// ────────────────────────────────────────────────────────────────────────────
// loadHwmFromDb — called once at boot. Returns a plain object keyed by
// symbol-or-id so the existing _posHighWaterMark dict can be Object.assign'd
// into it. Only loads HWM for currently-open positions; closed trades are
// irrelevant and would just pollute the in-memory map.
async function loadHwmFromDb(pool) {
  if (!pool) return {};
  try {
    const { rows } = await pool.query(`
      SELECT id, symbol, hwm_price
        FROM paper_trades
       WHERE status = 'OPEN' AND hwm_price IS NOT NULL
    `);
    const out = {};
    for (const r of rows) {
      const k1 = String(r.id);
      const k2 = r.symbol;
      // kite-server uses id-or-sym as the key — stash both so whichever
      // lookup pattern updateTrailingStop uses finds it.
      out[k1] = Number(r.hwm_price);
      if (k2 && !out[k2]) out[k2] = Number(r.hwm_price);
    }
    return out;
  } catch (e) {
    // hwm_price column may not exist yet before the migration runs — return
    // empty map so the caller just starts with in-memory tracking.
    return {};
  }
}

// persistHwm — fire-and-forget from updateTrailingStop. We don't await inside
// the hot path of refreshPortfolioSignals; instead the caller can choose. For
// now we await so errors surface, but the caller can wrap in a setImmediate
// if latency becomes an issue.
async function persistHwm(pool, positionId, hwmPrice) {
  if (!pool || !positionId || !Number.isFinite(hwmPrice) || hwmPrice <= 0) return;
  try {
    await pool.query(
      `UPDATE paper_trades SET hwm_price = $1 WHERE id = $2 AND status = 'OPEN'`,
      [hwmPrice, positionId]
    );
  } catch (e) {
    // Silent on DB errors — HWM is best-effort, trailing still works in-memory.
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Idempotent schema bump — called from initDB at boot.
// ────────────────────────────────────────────────────────────────────────────
async function ensureHwmColumn(pool) {
  if (!pool) return { ok: false };
  try {
    await pool.query(`ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS hwm_price DECIMAL(18,8)`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  DEFAULT_CFG,
  checkDailyLossCap,
  checkTradeCountCap,
  shouldTimeExit,
  loadHwmFromDb,
  persistHwm,
  ensureHwmColumn,
};
