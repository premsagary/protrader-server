/**
 * ops-agent.js — operational health monitor + auto-healer.
 *
 * Runs as an independent interval loop alongside the main trading cycle.
 * Window: 09:00 IST (pre-market warm-up) → 16:30 IST (EOD reconciliation).
 *
 * Mandate: own everything that has to be working for the trading system to do
 * its job. Detect issues early, attempt safe auto-remediation via existing
 * admin routes, escalate loudly when auto-fix fails. NEVER patches code.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Detections (kind codes written to ops_incidents):
 *   PIPELINE_STALLED     — unified pipeline hasn't run in >10min during market hours
 *   CACHE_EMPTY          — _dayTradeCache has <5 picks past 9:25 IST
 *   KITE_TOKEN_EXPIRED   — kite session missing/invalid past 8:30 IST
 *   CANDIDATES_EMPTY     — candidates tab empty past 9:30 IST
 *   NO_TRADES_BY_1030    — 0 trades by 10:30 IST with healthy universe
 *   DRAWDOWN_BREACH      — realized+unrealized loss > MAX_DAILY_LOSS_PCT
 *   KILL_SWITCH_TRIPPED  — agent-state.isSystemKilled() returned a reason
 *   VIX_SPIKE            — VIX >= 20 (constraint threshold)
 *   EOD_UNRECONCILED     — open positions past 15:30 IST
 *   STALE_PICKS          — _dayTradeCache.updatedAt > 15min old during market
 *   AGENT_CYCLE_MISSED   — agent cycle hasn't run in >2min during market hours
 *   HEARTBEAT_MISSED     — ops-agent own tick gap > 3min (self-diagnostic)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Auto-remediation action surface (operational only, never code edits):
 *   REFRESH_CACHE           — invalidate in-memory picks cache
 *   RERUN_PIPELINE          — trigger runUnifiedKitePipeline() once
 *   CLEAR_CONCURRENCY_LOCK  — clear stuck _scanRunning gate
 *   NOTIFY_ONLY             — no action, just audit + log (for most severities)
 *
 * Anti-flap policy:
 *   - An incident is written only after it persists across MIN_PERSIST_TICKS
 *     consecutive checks (default 2 ticks = ~2 minutes).
 *   - Same kind is not re-written within SAME_INCIDENT_COOLDOWN_SEC (default
 *     10 min) to avoid log spam.
 *   - An auto-remediation is attempted at most MAX_AUTO_ATTEMPTS_PER_HOUR per
 *     kind, to prevent action storms.
 *
 * All action choices are advisory — the caller wires dep functions that may
 * refuse. Ops agent never fails open; if a dep is missing, it logs and
 * degrades to NOTIFY_ONLY.
 * ────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { CONSTRAINTS } = require('./agent-config');
const { nowIST, minsSinceOpenIST } = require('./agent-state');

// ── Config ───────────────────────────────────────────────────────────────────
const TICK_INTERVAL_MS = 60 * 1000;         // 60s loop
const MIN_PERSIST_TICKS = 2;                 // issue must repeat before incident fires
const SAME_INCIDENT_COOLDOWN_SEC = 10 * 60;  // 10 min
const MAX_AUTO_ATTEMPTS_PER_HOUR = 3;
const OPS_WINDOW_START_MINS = -15;           // 09:00 IST (15m before market open)
const OPS_WINDOW_END_MINS = 435;             // 16:30 IST (60m after market close)
const PIPELINE_MAX_STALE_SEC = 10 * 60;      // 10 min
const CACHE_MAX_STALE_SEC = 15 * 60;         // 15 min
const AGENT_CYCLE_MAX_STALE_SEC = 2 * 60;    // 2 min
const CACHE_MIN_PICKS_AFTER_925 = 5;

// Log-pattern thresholds (queried from app_errors via deps.getErrorCounts)
const KITE_ERROR_BURST_THRESHOLD    = 10;    // ≥10 KITE_* errors in 5 min
const DB_POOL_THRESHOLD             = 5;     // ≥5 DB_POOL errors in 5 min
const UNHANDLED_SPIKE_THRESHOLD     = 3;     // ≥3 UNHANDLED in 10 min
const CACHE_WRITE_FAILURE_THRESHOLD = 5;     // ≥5 CACHE_WRITE in 5 min
const RING_BUFFER_ATTACH_LINES      = 20;    // tail lines attached to log-pattern incidents

const INCIDENT_KINDS = Object.freeze({
  PIPELINE_STALLED:    'PIPELINE_STALLED',
  CACHE_EMPTY:         'CACHE_EMPTY',
  KITE_TOKEN_EXPIRED:  'KITE_TOKEN_EXPIRED',
  CANDIDATES_EMPTY:    'CANDIDATES_EMPTY',
  NO_TRADES_BY_1030:   'NO_TRADES_BY_1030',
  DRAWDOWN_BREACH:     'DRAWDOWN_BREACH',
  KILL_SWITCH_TRIPPED: 'KILL_SWITCH_TRIPPED',
  VIX_SPIKE:           'VIX_SPIKE',
  EOD_UNRECONCILED:    'EOD_UNRECONCILED',
  STALE_PICKS:         'STALE_PICKS',
  AGENT_CYCLE_MISSED:  'AGENT_CYCLE_MISSED',
  HEARTBEAT_MISSED:    'HEARTBEAT_MISSED',

  // Log-pattern detectors (populated from app_errors via error-sink)
  KITE_ERROR_BURST:          'KITE_ERROR_BURST',
  DB_POOL_EXHAUSTED:         'DB_POOL_EXHAUSTED',
  UNHANDLED_REJECTION_SPIKE: 'UNHANDLED_REJECTION_SPIKE',
  CACHE_WRITE_FAILURE:       'CACHE_WRITE_FAILURE',
});

const SEVERITY = Object.freeze({
  INFO: 'info', WARN: 'warn', ERROR: 'error', CRITICAL: 'critical',
});

// ── Runtime state ────────────────────────────────────────────────────────────
let _intervalId = null;
let _running = false;              // tick concurrency guard
let _lastTick = null;
let _tickCount = 0;
let _enabled = false;

// Persistence trackers — { [kind]: { count, firstSeenAt } }
const _pending = new Map();
// Cooldowns — { [kind]: lastFiredAtMs }
const _lastIncidentAt = new Map();
// Action attempts — { [kind]: [timestamps within last hour] }
const _recentActions = new Map();

// Deps injected at start() time
let _deps = null;

// ────────────────────────────────────────────────────────────────────────────
// In-ops-window check — 09:00-16:30 IST weekdays
// ────────────────────────────────────────────────────────────────────────────
function _inOpsWindow() {
  const t = nowIST();
  const dow = t.getDay(); // 0=Sun 6=Sat
  if (dow === 0 || dow === 6) return false;
  const m = minsSinceOpenIST();
  return m >= OPS_WINDOW_START_MINS && m <= OPS_WINDOW_END_MINS;
}

function _nowMs() { return Date.now(); }
function _secSince(ts) { return (Date.now() - ts) / 1000; }

function _canFireIncident(kind) {
  const last = _lastIncidentAt.get(kind);
  if (!last) return true;
  return _secSince(last) >= SAME_INCIDENT_COOLDOWN_SEC;
}

function _recordPending(kind) {
  const cur = _pending.get(kind);
  if (cur) {
    cur.count++;
    return cur.count;
  }
  _pending.set(kind, { count: 1, firstSeenAt: _nowMs() });
  return 1;
}

function _clearPending(kind) { _pending.delete(kind); }

function _canAttemptAction(kind) {
  const list = _recentActions.get(kind) || [];
  const cutoff = _nowMs() - 60 * 60 * 1000;
  const recent = list.filter(ts => ts > cutoff);
  _recentActions.set(kind, recent);
  return recent.length < MAX_AUTO_ATTEMPTS_PER_HOUR;
}

function _recordActionAttempt(kind) {
  const list = _recentActions.get(kind) || [];
  list.push(_nowMs());
  _recentActions.set(kind, list);
}

// ────────────────────────────────────────────────────────────────────────────
// Incident writer
// ────────────────────────────────────────────────────────────────────────────
async function _writeIncident(pool, {
  runId, severity, kind, summary, evidence,
  actionAttempted = 'NONE', actionResult = 'not_attempted', actionDetail = null,
  autoResolved = false,
}) {
  try {
    await pool.query(
      `INSERT INTO ops_incidents (
         run_id, severity, kind, summary, evidence,
         action_attempted, action_result, action_detail, auto_resolved
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        runId, severity, kind, summary,
        evidence ? JSON.stringify(evidence) : null,
        actionAttempted, actionResult, actionDetail, autoResolved,
      ]
    );
    _lastIncidentAt.set(kind, _nowMs());
    console.log(`🚨 ops-agent: [${severity}] ${kind} — ${summary}${actionAttempted !== 'NONE' ? ` (action=${actionAttempted}/${actionResult})` : ''}`);
  } catch (e) {
    if (/relation .* does not exist/i.test(String(e.message))) {
      console.warn(`ops-agent: ops_incidents table missing — run migrations/002_ops_and_shadow_tables.sql`);
    } else {
      console.error(`✖  ops-agent: incident write failed — ${e.message}`);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Detector primitives — return { hit: bool, evidence?: object }
// All detectors are pure; they consume a `snap` object assembled once per tick.
// ────────────────────────────────────────────────────────────────────────────
function dPipelineStalled(snap) {
  if (!snap.marketOpen) return { hit: false };
  const lastRunAt = snap.lastUnifiedPipelineAt;
  if (!lastRunAt) return { hit: true, evidence: { lastRunAt: null, reason: 'never_ran_today' } };
  const ageSec = _secSince(lastRunAt);
  return {
    hit: ageSec > PIPELINE_MAX_STALE_SEC,
    evidence: { lastRunAt: new Date(lastRunAt).toISOString(), ageSec: Math.round(ageSec) },
  };
}

function dCacheEmpty(snap) {
  // After 9:25 IST the cache should have at least CACHE_MIN_PICKS_AFTER_925 entries.
  if (snap.minsSinceOpen < 10) return { hit: false };
  const n = snap.dayTradeCacheSize;
  return {
    hit: n < CACHE_MIN_PICKS_AFTER_925,
    evidence: { cacheSize: n, threshold: CACHE_MIN_PICKS_AFTER_925 },
  };
}

function dKiteTokenExpired(snap) {
  // Warn before open (token should be valid by 08:30 IST).
  if (snap.minsSinceOpen < -45) return { hit: false };
  return {
    hit: !snap.kiteTokenPresent,
    evidence: { kiteTokenPresent: snap.kiteTokenPresent, minsSinceOpen: snap.minsSinceOpen },
  };
}

function dCandidatesEmpty(snap) {
  if (snap.minsSinceOpen < 15) return { hit: false };
  // Candidates count comes from most recent scanAndTrade run.
  const n = snap.candidatesCount;
  if (n == null) return { hit: false };
  return {
    hit: n === 0,
    evidence: { candidatesCount: n, minsSinceOpen: snap.minsSinceOpen },
  };
}

function dNoTradesBy1030(snap) {
  // 10:30 IST = 75 min after open.
  if (snap.minsSinceOpen < 75) return { hit: false };
  if (snap.minsSinceOpen > 120) return { hit: false }; // only fires in 10:30-11:00 window
  return {
    hit: snap.tradesTodayCount === 0,
    evidence: {
      tradesTodayCount: snap.tradesTodayCount,
      candidatesCount: snap.candidatesCount,
      minsSinceOpen: snap.minsSinceOpen,
    },
  };
}

function dDrawdownBreach(snap) {
  if (!snap.capital) return { hit: false };
  const pnl = (snap.realizedPnlToday || 0) + (snap.unrealizedPnlToday || 0);
  const lossPct = (pnl / snap.capital) * 100;
  return {
    hit: lossPct <= -CONSTRAINTS.MAX_DAILY_LOSS_PCT,
    evidence: { lossPct: +lossPct.toFixed(2), cap: CONSTRAINTS.MAX_DAILY_LOSS_PCT },
  };
}

function dKillSwitchTripped(snap) {
  if (!snap.killReason) return { hit: false };
  // Some kill reasons are expected (market closed, agent off) — filter those out
  const expected = ['MARKET_CLOSED', 'AGENT_DISABLED'];
  if (expected.some(e => snap.killReason.startsWith(e))) return { hit: false };
  return { hit: true, evidence: { reason: snap.killReason } };
}

function dVixSpike(snap) {
  if (snap.vixLevel == null) return { hit: false };
  return {
    hit: snap.vixLevel > CONSTRAINTS.MAX_VIX_LEVEL,
    evidence: { vix: snap.vixLevel, cap: CONSTRAINTS.MAX_VIX_LEVEL },
  };
}

function dEodUnreconciled(snap) {
  // After 15:30 IST (minsSinceOpen >= 375), no open positions should remain.
  if (snap.minsSinceOpen < 375) return { hit: false };
  return {
    hit: snap.openPositionsCount > 0,
    evidence: { openPositionsCount: snap.openPositionsCount, minsSinceOpen: snap.minsSinceOpen },
  };
}

function dStalePicks(snap) {
  if (!snap.dayTradeCacheUpdatedAt) return { hit: false };
  if (snap.minsSinceOpen < 10) return { hit: false };
  const ageSec = _secSince(snap.dayTradeCacheUpdatedAt);
  return {
    hit: ageSec > CACHE_MAX_STALE_SEC,
    evidence: { ageSec: Math.round(ageSec), threshold: CACHE_MAX_STALE_SEC },
  };
}

function dAgentCycleMissed(snap) {
  if (!snap.marketOpen) return { hit: false };
  if (snap.agentMode === 'off') return { hit: false };
  if (!snap.lastAgentCycleAt) return { hit: snap.minsSinceOpen > 5, evidence: { reason: 'never_ran' } };
  const ageSec = _secSince(snap.lastAgentCycleAt);
  return {
    hit: ageSec > AGENT_CYCLE_MAX_STALE_SEC,
    evidence: { ageSec: Math.round(ageSec), lastAt: new Date(snap.lastAgentCycleAt).toISOString() },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Log-pattern detectors — read aggregates from app_errors (pre-computed once
// per tick into snap.errorCounts5m / errorCounts10m). These are intentionally
// NOTIFY_ONLY in v1: they tell us a class of failure is happening before it
// breaks visible state, but we don't yet auto-remediate — the primitive for
// "reduce Kite call rate" or "trim pg pool" needs real-world evidence of
// what helps before we let the agent pull those levers.
// ────────────────────────────────────────────────────────────────────────────
function dKiteErrorBurst(snap) {
  const c = snap.errorCounts5m || {};
  const n = (c.KITE_API || 0) + (c.KITE_TOKEN || 0);
  if (n < KITE_ERROR_BURST_THRESHOLD) return { hit: false };
  return {
    hit: true,
    evidence: { count: n, threshold: KITE_ERROR_BURST_THRESHOLD, window: '5m',
                kite_api: c.KITE_API || 0, kite_token: c.KITE_TOKEN || 0 },
  };
}

function dDbPoolExhausted(snap) {
  const n = (snap.errorCounts5m || {}).DB_POOL || 0;
  if (n < DB_POOL_THRESHOLD) return { hit: false };
  return {
    hit: true,
    evidence: { count: n, threshold: DB_POOL_THRESHOLD, window: '5m' },
  };
}

function dUnhandledRejectionSpike(snap) {
  const n = (snap.errorCounts10m || {}).UNHANDLED || 0;
  if (n < UNHANDLED_SPIKE_THRESHOLD) return { hit: false };
  return {
    hit: true,
    evidence: { count: n, threshold: UNHANDLED_SPIKE_THRESHOLD, window: '10m' },
  };
}

function dCacheWriteFailure(snap) {
  const n = (snap.errorCounts5m || {}).CACHE_WRITE || 0;
  if (n < CACHE_WRITE_FAILURE_THRESHOLD) return { hit: false };
  return {
    hit: true,
    evidence: { count: n, threshold: CACHE_WRITE_FAILURE_THRESHOLD, window: '5m' },
  };
}

const DETECTORS = Object.freeze([
  { kind: INCIDENT_KINDS.KITE_TOKEN_EXPIRED,          sev: SEVERITY.CRITICAL, fn: dKiteTokenExpired },
  { kind: INCIDENT_KINDS.DRAWDOWN_BREACH,             sev: SEVERITY.CRITICAL, fn: dDrawdownBreach },
  { kind: INCIDENT_KINDS.KILL_SWITCH_TRIPPED,         sev: SEVERITY.ERROR,    fn: dKillSwitchTripped },
  { kind: INCIDENT_KINDS.PIPELINE_STALLED,            sev: SEVERITY.ERROR,    fn: dPipelineStalled },
  { kind: INCIDENT_KINDS.AGENT_CYCLE_MISSED,          sev: SEVERITY.ERROR,    fn: dAgentCycleMissed },
  { kind: INCIDENT_KINDS.CACHE_EMPTY,                 sev: SEVERITY.WARN,     fn: dCacheEmpty },
  { kind: INCIDENT_KINDS.STALE_PICKS,                 sev: SEVERITY.WARN,     fn: dStalePicks },
  { kind: INCIDENT_KINDS.CANDIDATES_EMPTY,            sev: SEVERITY.WARN,     fn: dCandidatesEmpty },
  { kind: INCIDENT_KINDS.NO_TRADES_BY_1030,           sev: SEVERITY.INFO,     fn: dNoTradesBy1030 },
  { kind: INCIDENT_KINDS.VIX_SPIKE,                   sev: SEVERITY.WARN,     fn: dVixSpike },
  { kind: INCIDENT_KINDS.EOD_UNRECONCILED,            sev: SEVERITY.WARN,     fn: dEodUnreconciled },
  // Log-pattern detectors. `attachLogs: true` means the tick attaches the
  // ring-buffer tail to evidence for forensic context.
  { kind: INCIDENT_KINDS.KITE_ERROR_BURST,            sev: SEVERITY.ERROR,    fn: dKiteErrorBurst,          attachLogs: true },
  { kind: INCIDENT_KINDS.DB_POOL_EXHAUSTED,           sev: SEVERITY.ERROR,    fn: dDbPoolExhausted,         attachLogs: true },
  { kind: INCIDENT_KINDS.UNHANDLED_REJECTION_SPIKE,   sev: SEVERITY.ERROR,    fn: dUnhandledRejectionSpike, attachLogs: true },
  { kind: INCIDENT_KINDS.CACHE_WRITE_FAILURE,         sev: SEVERITY.WARN,     fn: dCacheWriteFailure,       attachLogs: true },
]);

// ────────────────────────────────────────────────────────────────────────────
// Auto-remediation — operational actions only (no code patching)
// ────────────────────────────────────────────────────────────────────────────
async function _attemptAction(kind, deps, evidence) {
  // Routing: which kind maps to which safe action.
  if (kind === INCIDENT_KINDS.PIPELINE_STALLED || kind === INCIDENT_KINDS.CACHE_EMPTY || kind === INCIDENT_KINDS.STALE_PICKS) {
    if (typeof deps.rerunUnifiedPipeline === 'function') {
      if (!_canAttemptAction('RERUN_PIPELINE')) {
        return { action: 'RERUN_PIPELINE', result: 'skipped', detail: 'rate_limited' };
      }
      _recordActionAttempt('RERUN_PIPELINE');
      try {
        const r = await deps.rerunUnifiedPipeline({ reason: `ops-agent:${kind}` });
        return { action: 'RERUN_PIPELINE', result: 'ok', detail: JSON.stringify(r).slice(0, 400) };
      } catch (e) {
        return { action: 'RERUN_PIPELINE', result: 'failed', detail: e.message };
      }
    }
    // Cache-only fallback
    if (kind === INCIDENT_KINDS.CACHE_EMPTY && typeof deps.refreshCache === 'function') {
      if (!_canAttemptAction('REFRESH_CACHE')) {
        return { action: 'REFRESH_CACHE', result: 'skipped', detail: 'rate_limited' };
      }
      _recordActionAttempt('REFRESH_CACHE');
      try {
        const r = await deps.refreshCache({ reason: `ops-agent:${kind}` });
        return { action: 'REFRESH_CACHE', result: 'ok', detail: JSON.stringify(r).slice(0, 400) };
      } catch (e) {
        return { action: 'REFRESH_CACHE', result: 'failed', detail: e.message };
      }
    }
  }

  if (kind === INCIDENT_KINDS.CANDIDATES_EMPTY && typeof deps.clearScanLock === 'function') {
    // If candidates are empty and the scan lock is stuck, clear it.
    if (evidence && evidence.scanLockStuck) {
      if (!_canAttemptAction('CLEAR_CONCURRENCY_LOCK')) {
        return { action: 'CLEAR_CONCURRENCY_LOCK', result: 'skipped', detail: 'rate_limited' };
      }
      _recordActionAttempt('CLEAR_CONCURRENCY_LOCK');
      try {
        const r = await deps.clearScanLock({ reason: `ops-agent:${kind}` });
        return { action: 'CLEAR_CONCURRENCY_LOCK', result: 'ok', detail: JSON.stringify(r).slice(0, 200) };
      } catch (e) {
        return { action: 'CLEAR_CONCURRENCY_LOCK', result: 'failed', detail: e.message };
      }
    }
  }

  // Default: notify only. Everything else is for humans — drawdown, VIX spike,
  // EOD unreconciled, kite token expired are operator calls, not automation.
  return { action: 'NOTIFY_ONLY', result: 'ok', detail: 'human_attention_required' };
}

// ────────────────────────────────────────────────────────────────────────────
// Snapshot builder — collects everything the detectors need, once per tick
// ────────────────────────────────────────────────────────────────────────────
async function _buildSnapshot(deps) {
  const minsSinceOpen = minsSinceOpenIST();
  const snap = {
    minsSinceOpen,
    marketOpen: typeof deps.isMarketOpen === 'function' ? Boolean(deps.isMarketOpen()) : false,
    kiteTokenPresent: Boolean(deps.getKiteToken && deps.getKiteToken()),
    agentMode: deps.getAgentMode ? deps.getAgentMode() : 'off',

    // Pipeline timestamps (ms or null)
    lastUnifiedPipelineAt: deps.getLastUnifiedPipelineAt ? deps.getLastUnifiedPipelineAt() : null,
    lastAgentCycleAt:      deps.getLastAgentCycleAt      ? deps.getLastAgentCycleAt()      : null,

    // Cache snapshot
    dayTradeCacheSize:      deps.getDayTradeCacheSize      ? deps.getDayTradeCacheSize()      : 0,
    dayTradeCacheUpdatedAt: deps.getDayTradeCacheUpdatedAt ? deps.getDayTradeCacheUpdatedAt() : null,

    // Most recent scan result
    candidatesCount:        deps.getCandidatesCount        ? deps.getCandidatesCount()        : null,

    // Live capital/PnL (from deps to avoid circular state dependency)
    capital:              deps.getCapital           ? deps.getCapital()           : null,
    realizedPnlToday:     deps.getRealizedPnlToday  ? deps.getRealizedPnlToday()  : 0,
    unrealizedPnlToday:   deps.getUnrealizedPnlToday? deps.getUnrealizedPnlToday(): 0,
    tradesTodayCount:     deps.getTradesTodayCount  ? deps.getTradesTodayCount()  : 0,
    openPositionsCount:   deps.getOpenPositionsCount? deps.getOpenPositionsCount(): 0,

    vixLevel: deps.getVixLevel ? deps.getVixLevel() : null,

    killReason: deps.getKillReason ? deps.getKillReason() : null,

    // Log-pattern aggregates (populated from app_errors via error-sink).
    // If getErrorCounts is missing or throws, we default to empty objects so
    // detectors simply never fire — fail-safe, never fail-open.
    errorCounts5m:  {},
    errorCounts10m: {},
  };
  if (typeof deps.getErrorCounts === 'function') {
    try {
      const [c5, c10] = await Promise.all([
        deps.getErrorCounts({ minutes: 5 }),
        deps.getErrorCounts({ minutes: 10 }),
      ]);
      snap.errorCounts5m  = c5  || {};
      snap.errorCounts10m = c10 || {};
    } catch (_e) {
      // leave defaults
    }
  }
  return snap;
}

// ────────────────────────────────────────────────────────────────────────────
// Tick — one pass of the health check loop
// ────────────────────────────────────────────────────────────────────────────
async function _tick() {
  if (_running) return;
  if (!_deps || !_deps.pool) return;

  _running = true;
  _tickCount++;
  _lastTick = new Date().toISOString();

  try {
    if (!_inOpsWindow()) return;

    const runId = `ops-${Date.now().toString(36)}`;
    const snap = await _buildSnapshot(_deps);

    // Run every detector. Bucket by whether it hit.
    const hitKinds = new Set();

    for (const det of DETECTORS) {
      let result;
      try {
        result = det.fn(snap);
      } catch (e) {
        console.error(`✖  ops-agent: detector ${det.kind} threw: ${e.message}`);
        continue;
      }
      if (!result || !result.hit) {
        _clearPending(det.kind);
        continue;
      }
      hitKinds.add(det.kind);

      const ticks = _recordPending(det.kind);
      // Anti-flap: require persistence
      if (ticks < MIN_PERSIST_TICKS) continue;
      if (!_canFireIncident(det.kind)) continue;

      // Attach ring-buffer tail as forensic context for log-pattern incidents.
      let evidence = result.evidence || {};
      if (det.attachLogs && typeof _deps.getRingBuffer === 'function') {
        try {
          const tail = _deps.getRingBuffer(RING_BUFFER_ATTACH_LINES);
          if (Array.isArray(tail) && tail.length) {
            evidence = Object.assign({}, evidence, { recent_log: tail });
          }
        } catch (_e) { /* best effort */ }
      }

      const summary = _summaryFor(det.kind, evidence);
      const action = await _attemptAction(det.kind, _deps, evidence);

      await _writeIncident(_deps.pool, {
        runId,
        severity: det.sev,
        kind: det.kind,
        summary,
        evidence,
        actionAttempted: action.action,
        actionResult: action.result,
        actionDetail: action.detail,
        autoResolved: false,
      });
    }

    // For kinds in _pending that didn't hit this tick, clear the counter (done above per-detector).
  } catch (e) {
    console.error(`✖  ops-agent tick failed: ${e.message}`);
  } finally {
    _running = false;
  }
}

function _summaryFor(kind, evidence) {
  const ev = evidence || {};
  switch (kind) {
    case INCIDENT_KINDS.PIPELINE_STALLED:
      return `Unified pipeline hasn't run in ${ev.ageSec}s (>${PIPELINE_MAX_STALE_SEC}s) during market hours`;
    case INCIDENT_KINDS.CACHE_EMPTY:
      return `DayTrade cache has ${ev.cacheSize} picks (<${ev.threshold}) past 9:25 IST`;
    case INCIDENT_KINDS.KITE_TOKEN_EXPIRED:
      return `Kite token missing at T${ev.minsSinceOpen}m — trading cannot proceed`;
    case INCIDENT_KINDS.CANDIDATES_EMPTY:
      return `Candidates tab empty at T${ev.minsSinceOpen}m since open`;
    case INCIDENT_KINDS.NO_TRADES_BY_1030:
      return `0 trades by 10:30 IST (${ev.candidatesCount} candidates queued)`;
    case INCIDENT_KINDS.DRAWDOWN_BREACH:
      return `Intraday loss ${ev.lossPct}% exceeds cap ${ev.cap}%`;
    case INCIDENT_KINDS.KILL_SWITCH_TRIPPED:
      return `Kill-switch tripped: ${ev.reason}`;
    case INCIDENT_KINDS.VIX_SPIKE:
      return `VIX ${ev.vix} above cap ${ev.cap}`;
    case INCIDENT_KINDS.EOD_UNRECONCILED:
      return `${ev.openPositionsCount} open positions past 15:30 IST`;
    case INCIDENT_KINDS.STALE_PICKS:
      return `Pick cache age ${ev.ageSec}s (>${ev.threshold}s)`;
    case INCIDENT_KINDS.AGENT_CYCLE_MISSED:
      return ev.reason === 'never_ran'
        ? `Agent cycle hasn't run yet today at T${_nowMs() / 60000 | 0}`
        : `Agent cycle last ran ${ev.ageSec}s ago (>${AGENT_CYCLE_MAX_STALE_SEC}s)`;
    case INCIDENT_KINDS.HEARTBEAT_MISSED:
      return `Ops-agent own tick gap detected`;
    case INCIDENT_KINDS.KITE_ERROR_BURST:
      return `${ev.count} Kite errors in last ${ev.window} (threshold ${ev.threshold}; api=${ev.kite_api}, token=${ev.kite_token})`;
    case INCIDENT_KINDS.DB_POOL_EXHAUSTED:
      return `${ev.count} DB pool errors in last ${ev.window} (threshold ${ev.threshold})`;
    case INCIDENT_KINDS.UNHANDLED_REJECTION_SPIKE:
      return `${ev.count} unhandled rejections/exceptions in last ${ev.window} (threshold ${ev.threshold})`;
    case INCIDENT_KINDS.CACHE_WRITE_FAILURE:
      return `${ev.count} cache write failures in last ${ev.window} (threshold ${ev.threshold})`;
    default:
      return kind;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────
function start(deps) {
  if (_intervalId) return { started: false, reason: 'already_running' };
  if (!deps || !deps.pool) return { started: false, reason: 'pool_required' };
  _deps = deps;
  _enabled = true;
  _intervalId = setInterval(() => { _tick().catch(() => {}); }, TICK_INTERVAL_MS);
  // Fire one tick immediately so the first incident doesn't wait 60s.
  _tick().catch(() => {});
  console.log(`🩺 ops-agent: started (every ${TICK_INTERVAL_MS / 1000}s, window 09:00-16:30 IST)`);
  return { started: true, intervalMs: TICK_INTERVAL_MS };
}

function stop() {
  if (!_intervalId) return { stopped: false };
  clearInterval(_intervalId);
  _intervalId = null;
  _enabled = false;
  _pending.clear();
  console.log(`🩺 ops-agent: stopped`);
  return { stopped: true };
}

function getStatus() {
  return {
    enabled: _enabled,
    running: Boolean(_intervalId),
    tickCount: _tickCount,
    lastTick: _lastTick,
    pendingKinds: Array.from(_pending.keys()),
    recentActions: Object.fromEntries(
      Array.from(_recentActions.entries()).map(([k, v]) => [k, v.length])
    ),
    intervalMs: TICK_INTERVAL_MS,
  };
}

async function getRecentIncidents(pool, limit = 50) {
  try {
    const { rows } = await pool.query(
      `SELECT id, detected_at, severity, kind, summary, evidence,
              action_attempted, action_result, action_detail, resolved_at, auto_resolved
         FROM ops_incidents
        WHERE detected_at::date = CURRENT_DATE
        ORDER BY detected_at DESC
        LIMIT $1`,
      [Math.max(1, Math.min(500, limit))]
    );
    return rows;
  } catch (e) {
    if (/relation .* does not exist/i.test(String(e.message))) return [];
    throw e;
  }
}

async function getHealthSummary(pool) {
  const status = getStatus();
  const recent = await getRecentIncidents(pool, 50);
  const counts = { total: recent.length, bySeverity: {}, byKind: {} };
  for (const r of recent) {
    counts.bySeverity[r.severity] = (counts.bySeverity[r.severity] || 0) + 1;
    counts.byKind[r.kind] = (counts.byKind[r.kind] || 0) + 1;
  }
  return {
    status,
    todayCounts: counts,
    recentIncidents: recent.slice(0, 20),
  };
}

module.exports = {
  start,
  stop,
  getStatus,
  getRecentIncidents,
  getHealthSummary,
  INCIDENT_KINDS,
  SEVERITY,
  _internal: {
    _buildSnapshot, _tick, _inOpsWindow,
    dPipelineStalled, dCacheEmpty, dKiteTokenExpired, dCandidatesEmpty,
    dNoTradesBy1030, dDrawdownBreach, dKillSwitchTripped, dVixSpike,
    dEodUnreconciled, dStalePicks, dAgentCycleMissed,
    dKiteErrorBurst, dDbPoolExhausted, dUnhandledRejectionSpike, dCacheWriteFailure,
  },
};
