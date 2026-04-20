/**
 * agent-config.js — single source of truth for every agent threshold.
 *
 * Hardcoded defaults are deliberate: deterministic behavior requires that the
 * same pick + same state always produce the same decision. Env vars are
 * provided only for the kill-mode flag and for paper capital.
 *
 * If you change a threshold, bump CONFIG_VERSION — it gets stamped on every
 * agent_decisions row (via state_snapshot) so audit replays stay coherent.
 */

'use strict';

const CONFIG_VERSION = '1.3.0-varsity-binary-gate';

// ── Mode ─────────────────────────────────────────────────────────────────────
// off     — agent does nothing (DEFAULT — safe)
// paper   — simulate fills against live quotes, write to agent_trades
// live    — place real MIS orders (Phase 3, NOT built in Phase 1)
//
// (dry_run was removed 2026-04-17 — paper already logs the same decision
// audit trail, so there was no remaining benefit to a propose-only mode.)
//
// Mode is mutable at runtime: getMode() / setMode(m) allow the UI to flip it
// without a redeploy. setMode DOES NOT persist by itself — the caller is
// responsible for writing to app_config so the change survives restarts.
const VALID_MODES = new Set(['off', 'paper', 'live']);
// Legacy modes that may appear in env or DB — coerce silently to 'off' rather
// than blowing up on boot. Persisted value will be overwritten the next time
// the user presses a mode button in the UI.
const _LEGACY_MODES = new Set(['dry_run']);
let _INITIAL_MODE = (process.env.AGENT_MODE || 'off').toLowerCase();
if (_LEGACY_MODES.has(_INITIAL_MODE)) {
  console.warn(`agent-config: AGENT_MODE="${_INITIAL_MODE}" is deprecated, coercing to "off"`);
  _INITIAL_MODE = 'off';
}
if (!VALID_MODES.has(_INITIAL_MODE)) {
  throw new Error(`agent-config: invalid AGENT_MODE="${_INITIAL_MODE}", expected one of ${[...VALID_MODES].join(',')}`);
}
let _currentMode = _INITIAL_MODE;

function getMode() { return _currentMode; }
function setMode(m) {
  let v = String(m || '').toLowerCase();
  if (_LEGACY_MODES.has(v)) {
    console.warn(`agent-config.setMode: legacy mode "${m}" coerced to "off"`);
    v = 'off';
  }
  if (!VALID_MODES.has(v)) {
    throw new Error(`agent-config.setMode: invalid mode "${m}"`);
  }
  const prev = _currentMode;
  _currentMode = v;
  return { prev, current: v };
}
function listValidModes() { return [...VALID_MODES]; }

// ── Auto-schedule ────────────────────────────────────────────────────────────
// When enabled, the agent auto-flips to `targetMode` at market open (9:15 IST)
// and auto-flips back to 'off' at market close (15:30 IST) on trading days.
// Persistence handled by kite-server via app_config — this module just holds
// the runtime state. Target mode is always 'paper' for now; live will be
// added in Phase 3 behind an explicit unlock.
const AUTO_VALID_TARGETS = new Set(['paper', 'live']);
let _autoEnabled = false;
let _autoTargetMode = 'paper';

function getAutoSchedule() {
  return { enabled: _autoEnabled, targetMode: _autoTargetMode };
}
function setAutoSchedule({ enabled, targetMode }) {
  const e = Boolean(enabled);
  let t = targetMode ? String(targetMode).toLowerCase() : _autoTargetMode;
  // Legacy: silently coerce dry_run → paper rather than erroring on persisted
  // values from before dry_run was removed.
  if (t === 'dry_run') {
    console.warn(`agent-config.setAutoSchedule: legacy targetMode "dry_run" coerced to "paper"`);
    t = 'paper';
  }
  if (!AUTO_VALID_TARGETS.has(t)) {
    throw new Error(`agent-config.setAutoSchedule: targetMode must be one of ${[...AUTO_VALID_TARGETS].join(',')}`);
  }
  const prev = { enabled: _autoEnabled, targetMode: _autoTargetMode };
  _autoEnabled = e;
  _autoTargetMode = t;
  return { prev, current: { enabled: _autoEnabled, targetMode: _autoTargetMode } };
}
function listAutoTargets() { return [...AUTO_VALID_TARGETS]; }

// Legacy export — snapshot at require-time. Prefer getMode() for anything that
// needs to react to runtime changes.
const AGENT_MODE = _INITIAL_MODE;

// ── Capital ──────────────────────────────────────────────────────────────────
// Paper mode uses this fixed amount (Phase 2 rollout = ₹1,00,000).
// Live mode will read margin from Kite at runtime (Phase 3).
const PAPER_CAPITAL_RUPEES = parseInt(process.env.AGENT_PAPER_CAPITAL || '100000', 10);

// ── Filter-chain thresholds (Layer 2 — Agent) ────────────────────────────────
const FILTERS = Object.freeze({
  // 2026-04-20: score-based gating DROPPED — scoreDayTrade now returns null
  // unless the Varsity M2 Ch20 binary checklist (11 items) passes. Score is
  // still emitted as a diagnostic field but is NOT the gate. Kept at 0 so
  // this filter is effectively a no-op and every Varsity-qualified candidate
  // flows through to the remaining filter-chain thresholds.
  MIN_DAY_TRADE_SCORE: 0,           // no-op — Varsity checklist is the gate now
  MIN_VOL_RATIO: 1.5,               // current 5m vol vs 20-bar avg (reverted 2026-04-20 to 1.5 to match pre-hardening ₹14K paper baseline for A/B trial; was briefly 1.2 on Day-1 live)
  MIN_ATR_PCT: 0.4,                 // avoid sideways / low-vol
  MAX_ATR_PCT: 3.0,                 // avoid wild vol (already filtered in scoreDayTrade but belt-and-suspenders)
  STRUCTURE_MIN_ATR_DISTANCE: 0.5,  // |price - nearest_level| / atr ≥ this
  ENTRY_OPEN_BUFFER_MINS: 10,       // no entries in first N mins
  ENTRY_CLOSE_CUTOFF_MINS: 345,     // no NEW entries after 345 mins since open (= 14:30 IST)
  CANDLE_CONFIRM_BPS: 5,            // close above breakout+0.05% (5 bps) to fire BUY
  ARMED_EXPIRY_MINS: 15,            // armed candidate expires after this
});

// ── Hard constraints (Layer 3 — Constraint Engine) ───────────────────────────
const CONSTRAINTS = Object.freeze({
  MAX_RISK_PER_TRADE_PCT: 1.0,      // 1% of capital
  MAX_DAILY_LOSS_PCT: 2.0,          // 2% daily stop
  MAX_TRADES_PER_DAY: 5,
  MAX_CONCURRENT_TRADES: 3,
  MIN_RR_RATIO: 1.5,
  MAX_POSITION_PCT_OF_CAPITAL: 30,  // single-position concentration cap
  NO_DUPE_SYMBOL: true,
  NO_DUPE_SECTOR: true,
  NO_ENTRIES_AFTER_MINS: 345,       // 14:30 IST
  // Escalation
  HALVE_SIZE_AT_DAILY_LOSS_PCT: 1.5,
  COOLDOWN_AFTER_N_LOSSES: 2,
  COOLDOWN_MINS: 30,
  // Regime gates
  MAX_NIFTY_FAST_MOVE_PCT_15MIN: 1.5,   // pause if NIFTY moves this fast
  MAX_VIX_LEVEL: 20,
  // State staleness
  MAX_STATE_AGE_SEC: 5,
});

// ── Trade management (Layer 5 — not active in Phase 1) ───────────────────────
const MGMT = Object.freeze({
  POLL_INTERVAL_SEC: 15,
  TRAIL_BREAKEVEN_R_MULTIPLE: 1.0,  // move SL to BE once price moves 1R in favor
  TRAIL_ATR_R_MULTIPLE: 2.0,        // begin ATR trail at 2R
  TRAIL_ATR_MULT: 0.75,
  TIME_EXIT_MINS: 360,              // 15:15 IST
});

// ── Cycle cadence ────────────────────────────────────────────────────────────
const CYCLE = Object.freeze({
  // 09:25–15:15 IST, every minute, weekdays. Cron is server-local — the
  // trade-agent code checks IST internally, so this is a coarse gate.
  CRON_EXPR: '25-59/1 9 * * 1-5,*/1 10-14 * * 1-5,0-15/1 15 * * 1-5',
  // Fallback: run every minute between 9 and 15 server hours, filter inside.
  CRON_EXPR_SIMPLE: '* 9-15 * * 1-5',
});

module.exports = {
  CONFIG_VERSION,
  AGENT_MODE,          // snapshot at boot — do not use for live checks
  getMode, setMode, listValidModes,
  getAutoSchedule, setAutoSchedule, listAutoTargets,
  PAPER_CAPITAL_RUPEES,
  FILTERS,
  CONSTRAINTS,
  MGMT,
  CYCLE,
};
