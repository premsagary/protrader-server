/**
 * agent/index.js — cycle orchestrator.
 *
 * One call into this file = one complete agent cycle:
 *   getVerifiedState → killSwitch → propose → validate → audit → place → evaluateArmed
 *
 * Paper mode adds a second loop (trade-manager.startPoller) that runs every
 * 15s and evaluates SL/TGT/time/trailing for open trades.
 *
 * Wiring (see README.md): kite-server.js adds ONE bootstrap call.
 *   const agent = require('./agent');
 *   await agent.bootstrap({
 *     app, pool, kite, isMarketOpen,
 *     getKiteToken, getPicks, getNiftyDailyChange,
 *     getPrices,   // paper mode — async (syms[]) → { sym: ltp | null }
 *     getAtrPct,   // paper mode — (sym) → number | null (for trailing SL)
 *   });
 *
 * getPrices + getAtrPct are only required for paper mode; if they're missing,
 * paper mode will still boot but no fills or exits will happen.
 */

'use strict';

const cron = require('node-cron');

const {
  getMode, setMode, listValidModes, CYCLE,
  getAutoSchedule, setAutoSchedule, listAutoTargets,
} = require('./agent-config');
const { getVerifiedState, isSystemKilled, nowIST, minsSinceOpenIST } = require('./agent-state');
const tradeAgent       = require('./trade-agent');
const constraintEngine = require('./constraint-engine');
const audit            = require('./agent-audit');
const execution        = require('./execution-engine');
const paper            = require('./paper-fill-engine');
const tradeManager     = require('./trade-manager');

let _cycleRunning = false;
let _deps = null;
let _cronTask = null;
let _autoOpenTask = null;
let _autoCloseTask = null;
// Persistence keys — kept in sync with kite-server (read in bootstrap + write
// on every auto-schedule update).
const AUTO_ENABLED_KEY = 'agent_auto_schedule_enabled';
const AUTO_TARGET_KEY  = 'agent_auto_schedule_target';
const MODE_KEY         = 'agent_mode_override';

// ────────────────────────────────────────────────────────────────────────────
// runCycle — callable ad-hoc (admin API) or on cron tick
// ────────────────────────────────────────────────────────────────────────────
async function runCycle(deps = _deps) {
  const mode = getMode();
  if (mode === 'off') return { skipped: 'agent_off' };
  if (_cycleRunning) return { skipped: 'cycle_in_progress' };
  if (!deps || !deps.pool) return { skipped: 'not_wired' };

  _cycleRunning = true;
  const runId = audit.newRunId();
  const started = Date.now();

  try {
    const tablesOk = await audit.ensureTablesExist(deps.pool);
    if (!tablesOk) {
      console.log(`🤖 agent ${runId}: skipped — run agent/migrations/001_agent_tables.sql first`);
      return { skipped: 'missing_tables', runId };
    }

    // 1. Verified state
    const state = await getVerifiedState({
      pool: deps.pool,
      kite: deps.kite,
      isMarketOpen: deps.isMarketOpen,
      getKiteToken: deps.getKiteToken,
      niftyDailyChange: deps.getNiftyDailyChange ? deps.getNiftyDailyChange() : null,
    });

    // 2. Kill-switch
    const killed = isSystemKilled(state);
    if (killed) {
      console.log(`🤖 agent ${runId}: killed — ${killed}`);
      // Even when killed we still evaluate armed candidates — don't want to
      // leave stale arms. pollOpenTrades runs on its own poller, so it's fine.
      await _evaluateArmedIfPaper({ pool: deps.pool, getPrices: deps.getPrices, runId });
      return { skipped: 'killed', reason: killed, runId };
    }

    // 3. Picks
    const picks = deps.getPicks ? (deps.getPicks() || []) : [];
    if (!picks.length) {
      await _evaluateArmedIfPaper({ pool: deps.pool, getPrices: deps.getPrices, runId });
      return { skipped: 'no_picks', runId };
    }

    // 4. Propose
    const { proposals, rejections } = tradeAgent.propose({ picks, state });

    // 5. Validate
    const { approved, rejected } = constraintEngine.validate(proposals, state);

    // 6. Audit — write BOTH filter-rejections and constraint-rejections
    const allRejected = [...rejections, ...rejected];
    const ids = await audit.writeDecisionsBatch(deps.pool, {
      runId,
      mode,
      approved,
      rejected: allRejected,
      state,
    });

    // 7. Execute — paper arms candidates; live errors until Phase 3.
    //    ids.approved is aligned with approved[] in insertion order, so we can
    //    zip them to get the decisionId for each proposal.
    const placed = [];
    for (let i = 0; i < approved.length; i++) {
      const p = approved[i];
      const decisionId = ids.approved[i] && ids.approved[i].id;
      const res = await execution.place(p, { ...deps, decisionId, runId });
      placed.push({ sym: p.sym, decisionId, ...res });
    }

    // 8. Evaluate armed candidates (paper mode only). This is what actually
    //    fires paper fills: today's armed proposals get checked against the
    //    latest prices, and any that have triggered flip into agent_trades.
    let armedResult = null;
    if (mode === 'paper') {
      armedResult = await _evaluateArmedIfPaper({
        pool: deps.pool, getPrices: deps.getPrices, runId,
      });
    }

    const elapsedMs = Date.now() - started;
    const armedNote = armedResult
      ? ` armed=${armedResult.armed} filled=${armedResult.filled?.length || 0} expired=${armedResult.expired?.length || 0}`
      : '';
    console.log(
      `🤖 agent ${runId}: mode=${mode} picks=${picks.length} `
      + `proposed=${proposals.length} approved=${approved.length} `
      + `rejected=${allRejected.length}${armedNote} (${elapsedMs}ms)`
    );

    return {
      ok: true, runId, mode,
      picksCount: picks.length,
      proposedCount: proposals.length,
      approvedCount: approved.length,
      rejectedCount: allRejected.length,
      placed,
      armed: armedResult,
      decisionIds: ids,
      elapsedMs,
    };
  } catch (e) {
    console.error(`🤖 agent ${runId}: cycle error — ${e.message}`);
    return { ok: false, runId, error: e.message };
  } finally {
    _cycleRunning = false;
  }
}

async function _evaluateArmedIfPaper({ pool, getPrices, runId }) {
  if (getMode() !== 'paper') return null;
  if (!getPrices) return { armed: paper.armedCount(), filled: [], expired: [], note: 'no_getPrices_dep' };
  try {
    return await paper.evaluateArmed({ pool, getPrices, runId });
  } catch (e) {
    console.error('🤖 agent: evaluateArmed failed —', e.message);
    return { armed: paper.armedCount(), filled: [], expired: [], error: e.message };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// wire — called once by kite-server.js at startup.
// ────────────────────────────────────────────────────────────────────────────
function wire(deps, persistedMode, persistedAuto) {
  _deps = deps;

  if (persistedMode && listValidModes().includes(persistedMode)) {
    const prev = getMode();
    setMode(persistedMode);
    if (prev !== persistedMode) {
      console.log(`🤖 agent: mode restored from DB override: ${prev} → ${persistedMode}`);
    }
  }

  // Apply persisted auto-schedule state BEFORE starting the cron — the open/
  // close crons need to read this to decide whether to fire.
  if (persistedAuto && typeof persistedAuto.enabled === 'boolean') {
    try {
      setAutoSchedule({
        enabled: persistedAuto.enabled,
        targetMode: persistedAuto.targetMode || 'paper',
      });
      console.log(
        `🤖 agent: auto-schedule restored: enabled=${persistedAuto.enabled} `
        + `target=${persistedAuto.targetMode || 'paper'}`
      );
    } catch (e) {
      console.error('🤖 agent: failed to restore auto-schedule:', e.message);
    }
  }

  if (_cronTask) _cronTask.stop();
  _cronTask = cron.schedule(CYCLE.CRON_EXPR_SIMPLE, () => {
    runCycle().catch(e => console.error('🤖 agent cycle uncaught:', e.message));
  });

  // Register the two IST-timezone crons that auto-flip mode at market
  // open/close. They check getAutoSchedule() at fire time so toggling the UI
  // takes effect without needing to re-schedule.
  _registerAutoCrons();

  // If we're booting mid-session, reconcile state with where we "should" be.
  _reconcileMidSessionMode().catch(e =>
    console.error('🤖 agent: mid-session reconcile error:', e.message)
  );

  // Start the trade-manager poller. It gates internally on market hours and
  // bails fast when there are no open trades — safe to leave running.
  tradeManager.startPoller({
    pool: deps.pool,
    isMarketOpen: deps.isMarketOpen,
    getPrices: deps.getPrices,
    getAtrPct: deps.getAtrPct,
    runId: null,
  });

  const mode = getMode();
  console.log(`🤖 agent: wired (mode=${mode}, cron=${CYCLE.CRON_EXPR_SIMPLE})`);
  return { wired: true, mode, cron: true, poller: tradeManager.getStatus() };
}

// ── Auto-schedule crons ─────────────────────────────────────────────────────
// 9:15 IST — flip to target mode.   15:30 IST — flip to off.
// Both are registered unconditionally on wire(). Their callbacks check
// getAutoSchedule().enabled at fire time, so disabling auto-schedule via the
// UI takes effect immediately without tearing down the cron.
//
// node-cron supports IANA timezones natively; we pass 'Asia/Kolkata' so the
// schedule is interpreted in IST regardless of Railway's server timezone.
function _registerAutoCrons() {
  if (_autoOpenTask) _autoOpenTask.stop();
  if (_autoCloseTask) _autoCloseTask.stop();

  _autoOpenTask = cron.schedule('15 9 * * 1-5', async () => {
    await _autoFireOpen('cron_9:15_IST');
  }, { timezone: 'Asia/Kolkata' });

  _autoCloseTask = cron.schedule('30 15 * * 1-5', async () => {
    await _autoFireClose('cron_15:30_IST');
  }, { timezone: 'Asia/Kolkata' });

  console.log('🤖 agent: auto-schedule crons registered (9:15 open / 15:30 close IST, Mon-Fri)');
}

async function _autoFireOpen(source) {
  const auto = getAutoSchedule();
  if (!auto.enabled) return { skipped: 'auto_disabled' };

  // Safety: only auto-start when current mode is 'off'. If the user has
  // manually set a different mode, respect that choice.
  const cur = getMode();
  if (cur !== 'off') {
    console.log(`🤖 agent auto-open [${source}]: mode is "${cur}", not overriding.`);
    return { skipped: 'manual_mode_set', currentMode: cur };
  }

  const target = auto.targetMode || 'paper';
  const r = setMode(target);
  await _persistMode(target);
  console.log(`🤖 agent auto-open [${source}]: ${r.prev} → ${r.current}`);
  return { ok: true, prev: r.prev, current: r.current };
}

async function _autoFireClose(source) {
  const auto = getAutoSchedule();
  if (!auto.enabled) return { skipped: 'auto_disabled' };

  const cur = getMode();
  // Only auto-stop if we're in the target mode. Respect manual modes.
  if (cur !== auto.targetMode && cur !== 'off') {
    console.log(`🤖 agent auto-close [${source}]: mode is "${cur}", not overriding.`);
    return { skipped: 'manual_mode_set', currentMode: cur };
  }

  // Also cancel any pending armed candidates — they shouldn't fire after close.
  paper.clearArmed();

  const r = setMode('off');
  await _persistMode('off');
  console.log(`🤖 agent auto-close [${source}]: ${r.prev} → ${r.current}, armed cleared`);
  return { ok: true, prev: r.prev, current: r.current };
}

async function _persistMode(m) {
  if (!_deps || !_deps.pool) return;
  try {
    await _deps.pool.query(
      `INSERT INTO app_config(key,value,updated_at) VALUES($1,$2,NOW())
       ON CONFLICT(key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [MODE_KEY, m]
    );
  } catch (e) {
    console.error('🤖 agent: failed to persist auto mode change:', e.message);
  }
}

// ── Boot reconciliation ─────────────────────────────────────────────────────
// Covers the case where Railway restarts mid-session: without this, we'd
// remain in whatever the last-persisted mode was until the next 9:15 cron.
// With it, if auto-schedule is on and we're IN market hours, flip to target
// immediately; if we're OUTSIDE market hours, flip to off.
//
// Only fires when auto-schedule is enabled. If user has manually set a mode
// that doesn't match expectations, we leave it alone (treat as intentional
// override).
async function _reconcileMidSessionMode() {
  const auto = getAutoSchedule();
  if (!auto.enabled) return { skipped: 'auto_disabled' };
  if (!_deps || !_deps.pool) return { skipped: 'not_wired' };

  const marketOpen = _deps.isMarketOpen ? _deps.isMarketOpen() : false;
  const cur = getMode();

  if (marketOpen && cur === 'off') {
    // We should be trading — flip on
    const target = auto.targetMode || 'paper';
    setMode(target);
    await _persistMode(target);
    console.log(`🤖 agent: boot reconcile — market open, auto-starting ${target}`);
    return { ok: true, action: 'started', current: target };
  }
  if (!marketOpen && cur !== 'off' && cur === auto.targetMode) {
    // Market is closed but we're in auto's target mode — flip off
    paper.clearArmed();
    setMode('off');
    await _persistMode('off');
    console.log('🤖 agent: boot reconcile — market closed, auto-stopping');
    return { ok: true, action: 'stopped' };
  }
  return { ok: true, action: 'none', currentMode: cur, marketOpen };
}

function applyMode(m) { return setMode(m); }

function getStatus() {
  const auto = getAutoSchedule();
  return {
    mode: getMode(),
    validModes: listValidModes(),
    cycleRunning: _cycleRunning,
    wired: Boolean(_deps),
    cronActive: Boolean(_cronTask),
    trader: tradeManager.getStatus(),
    armedCount: paper.armedCount(),
    autoSchedule: {
      enabled: auto.enabled,
      targetMode: auto.targetMode,
      validTargets: listAutoTargets(),
      openCronActive: Boolean(_autoOpenTask),
      closeCronActive: Boolean(_autoCloseTask),
    },
  };
}

function stop() {
  if (_cronTask) { _cronTask.stop(); _cronTask = null; }
  if (_autoOpenTask) { _autoOpenTask.stop(); _autoOpenTask = null; }
  if (_autoCloseTask) { _autoCloseTask.stop(); _autoCloseTask = null; }
  tradeManager.stopPoller();
  return { stopped: true };
}

// ────────────────────────────────────────────────────────────────────────────
// mountRoutes — admin HTTP endpoints.
//
//   GET  /api/agent/status      mode + stats + recent + open trades + armed
//   POST /api/agent/mode        { mode } — persists to app_config
//   POST /api/agent/run-now     force one cycle
//   GET  /api/agent/decisions   last N decisions
//   GET  /api/agent/trades      open + closed paper trades today
//   POST /api/agent/clear-armed cancel all armed candidates (testing aid)
// ────────────────────────────────────────────────────────────────────────────
function mountRoutes(app, opts = {}) {
  if (!_deps || !_deps.pool) {
    throw new Error('agent.mountRoutes: must be called after wire({ pool, ... })');
  }
  const pool = _deps.pool;
  const gate = opts.requireAdmin || ((req, res, next) => next());
  // MODE_KEY / AUTO_* keys are module-level consts (defined near top)

  app.get('/api/agent/status', gate, async (req, res) => {
    try {
      const [stats, recent, paperStats, openTrades] = await Promise.all([
        audit.getTodayStats(pool),
        audit.getRecentDecisions(pool, 20),
        audit.getPaperStatsToday(pool),
        audit.getOpenTrades(pool),
      ]);
      res.json({
        ok: true,
        ...getStatus(),
        paperCapital: require('./agent-config').PAPER_CAPITAL_RUPEES,
        configVersion: require('./agent-config').CONFIG_VERSION,
        envFallback: (process.env.AGENT_MODE || 'off').toLowerCase(),
        stats,
        recent,
        paper: paperStats,
        openTrades,
        armed: paper.snapshotArmed(),
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/agent/mode', gate, async (req, res) => {
    try {
      const m = String(req.body && req.body.mode || '').toLowerCase();
      if (!listValidModes().includes(m)) {
        return res.status(400).json({ ok: false, error: `invalid mode "${m}"`, validModes: listValidModes() });
      }
      const r = applyMode(m);
      try {
        await pool.query(
          `INSERT INTO app_config(key,value,updated_at) VALUES($1,$2,NOW())
           ON CONFLICT(key) DO UPDATE SET value=$2, updated_at=NOW()`,
          [MODE_KEY, m]
        );
      } catch (pe) {
        console.error('🤖 agent.mountRoutes: failed to persist mode:', pe.message);
      }
      // Switching OUT of paper clears any pending arms — they'd otherwise
      // survive a mode change and fire unexpectedly on re-enable.
      if (r.prev === 'paper' && r.current !== 'paper') paper.clearArmed();
      console.log(`🤖 agent: mode changed via UI: ${r.prev} → ${r.current}`);
      res.json({ ok: true, prev: r.prev, current: r.current, persisted: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/agent/run-now', gate, async (req, res) => {
    try {
      const r = await runCycle();
      res.json({ ok: true, result: r });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/agent/decisions', gate, async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(200, parseInt(req.query.limit || '50', 10)));
      const rows = await audit.getRecentDecisions(pool, limit);
      res.json({ ok: true, rows });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/agent/trades', gate, async (req, res) => {
    try {
      const [open, closed] = await Promise.all([
        audit.getOpenTrades(pool),
        audit.getClosedTradesToday(pool),
      ]);
      res.json({ ok: true, open, closed, armed: paper.snapshotArmed() });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/agent/clear-armed', gate, (req, res) => {
    res.json({ ok: true, ...paper.clearArmed() });
  });

  // Auto-schedule: { enabled: bool, targetMode?: 'paper' }
  // Persists to app_config under two keys so a Railway restart restores both.
  app.post('/api/agent/auto-schedule', gate, async (req, res) => {
    try {
      const body = req.body || {};
      const enabled = Boolean(body.enabled);
      const targetMode = body.targetMode ? String(body.targetMode).toLowerCase() : undefined;
      const r = setAutoSchedule({ enabled, targetMode });

      try {
        await pool.query(
          `INSERT INTO app_config(key,value,updated_at) VALUES($1,$2,NOW())
           ON CONFLICT(key) DO UPDATE SET value=$2, updated_at=NOW()`,
          [AUTO_ENABLED_KEY, enabled ? 'true' : 'false']
        );
        await pool.query(
          `INSERT INTO app_config(key,value,updated_at) VALUES($1,$2,NOW())
           ON CONFLICT(key) DO UPDATE SET value=$2, updated_at=NOW()`,
          [AUTO_TARGET_KEY, r.current.targetMode]
        );
      } catch (pe) {
        console.error('🤖 agent: failed to persist auto-schedule:', pe.message);
      }

      // If user just turned it ON during market hours with mode=off, auto-start now.
      // If they just turned it OFF, leave the current mode as-is (don't surprise them).
      if (enabled) await _reconcileMidSessionMode();

      console.log(`🤖 agent: auto-schedule ${enabled ? 'ENABLED' : 'DISABLED'} target=${r.current.targetMode}`);
      res.json({ ok: true, prev: r.prev, current: r.current, persisted: true });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  console.log('🤖 agent: routes mounted at /api/agent/{status,mode,run-now,decisions,trades,clear-armed,auto-schedule}');
  return { mounted: true };
}

// ────────────────────────────────────────────────────────────────────────────
// _ensureMigration — idempotent DDL bootstrap
// ────────────────────────────────────────────────────────────────────────────
async function _ensureMigration(pool) {
  const fs   = require('fs');
  const path = require('path');
  try {
    const already = await audit.ensureTablesExist(pool);
    if (already) return { applied: false, reason: 'already_present' };

    const sql = fs.readFileSync(path.join(__dirname, 'migrations', '001_agent_tables.sql'), 'utf8');
    await pool.query(sql);
    const ok = await audit.ensureTablesExist(pool);
    if (!ok) throw new Error('migration ran but agent_decisions still missing');
    console.log('🤖 agent: migration 001 applied (agent_decisions/agent_trades/agent_trade_events)');
    return { applied: true };
  } catch (e) {
    console.error('🤖 agent: migration bootstrap failed:', e.message);
    return { applied: false, error: e.message };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// bootstrap — kite-server.js single entry point
// ────────────────────────────────────────────────────────────────────────────
async function bootstrap({
  app, pool, kite, isMarketOpen,
  getKiteToken, getPicks, getNiftyDailyChange,
  getPrices, getAtrPct, requireAdmin,
}) {
  const mig = await _ensureMigration(pool);

  // Load persisted mode + auto-schedule state in a single query round-trip.
  let persistedMode = null;
  let persistedAuto = null;
  try {
    const { rows } = await pool.query(
      `SELECT key, value FROM app_config WHERE key = ANY($1::text[])`,
      [[MODE_KEY, AUTO_ENABLED_KEY, AUTO_TARGET_KEY]]
    );
    const kv = {};
    for (const r of rows) kv[r.key] = r.value;
    if (kv[MODE_KEY])          persistedMode = String(kv[MODE_KEY]).toLowerCase();
    if (kv[AUTO_ENABLED_KEY] != null) {
      persistedAuto = {
        enabled: String(kv[AUTO_ENABLED_KEY]).toLowerCase() === 'true',
        targetMode: (kv[AUTO_TARGET_KEY] || 'paper').toLowerCase(),
      };
    }
  } catch (e) { /* app_config may be absent on first boot */ }

  wire({
    pool, kite, isMarketOpen,
    getKiteToken, getPicks, getNiftyDailyChange,
    getPrices, getAtrPct,
  }, persistedMode, persistedAuto);

  if (app) mountRoutes(app, { requireAdmin });

  return { ok: true, mode: getMode(), persistedMode, persistedAuto, migration: mig };
}

module.exports = {
  wire,
  bootstrap,
  mountRoutes,
  runCycle,
  applyMode,
  getStatus,
  stop,
  _internal: { tradeAgent, constraintEngine, audit, execution, paper, tradeManager },
};
