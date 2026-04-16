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

const { getMode, setMode, listValidModes, CYCLE } = require('./agent-config');
const { getVerifiedState, isSystemKilled } = require('./agent-state');
const tradeAgent       = require('./trade-agent');
const constraintEngine = require('./constraint-engine');
const audit            = require('./agent-audit');
const execution        = require('./execution-engine');
const paper            = require('./paper-fill-engine');
const tradeManager     = require('./trade-manager');

let _cycleRunning = false;
let _deps = null;
let _cronTask = null;

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

    // 7. Execute — dry_run does nothing; paper arms candidates; live errors.
    //    ids.approved is aligned with approved[] in insertion order, so we can
    //    zip them to get the decisionId for each proposal.
    const placed = [];
    if (mode === 'dry_run') {
      for (const p of approved) placed.push({ sym: p.sym, ok: true, mode: 'dry_run' });
    } else {
      for (let i = 0; i < approved.length; i++) {
        const p = approved[i];
        const decisionId = ids.approved[i] && ids.approved[i].id;
        const res = await execution.place(p, { ...deps, decisionId, runId });
        placed.push({ sym: p.sym, decisionId, ...res });
      }
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
function wire(deps, persistedMode) {
  _deps = deps;

  if (persistedMode && listValidModes().includes(persistedMode)) {
    const prev = getMode();
    setMode(persistedMode);
    if (prev !== persistedMode) {
      console.log(`🤖 agent: mode restored from DB override: ${prev} → ${persistedMode}`);
    }
  }

  if (_cronTask) _cronTask.stop();
  _cronTask = cron.schedule(CYCLE.CRON_EXPR_SIMPLE, () => {
    runCycle().catch(e => console.error('🤖 agent cycle uncaught:', e.message));
  });

  // Start the trade-manager poller. It gates internally on market hours and
  // bails fast when there are no open trades — safe to leave running.
  tradeManager.startPoller({
    pool: deps.pool,
    isMarketOpen: deps.isMarketOpen,
    getPrices: deps.getPrices,
    getAtrPct: deps.getAtrPct,
    runId: null,  // poller generates its own per-tick; nulls fine for now
  });

  const mode = getMode();
  console.log(`🤖 agent: wired (mode=${mode}, cron=${CYCLE.CRON_EXPR_SIMPLE})`);
  return { wired: true, mode, cron: true, poller: tradeManager.getStatus() };
}

function applyMode(m) { return setMode(m); }

function getStatus() {
  return {
    mode: getMode(),
    validModes: listValidModes(),
    cycleRunning: _cycleRunning,
    wired: Boolean(_deps),
    cronActive: Boolean(_cronTask),
    trader: tradeManager.getStatus(),
    armedCount: paper.armedCount(),
  };
}

function stop() {
  if (_cronTask) { _cronTask.stop(); _cronTask = null; }
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
  const MODE_KEY = 'agent_mode_override';

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

  console.log('🤖 agent: routes mounted at /api/agent/{status,mode,run-now,decisions,trades,clear-armed}');
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

  const MODE_KEY = 'agent_mode_override';
  let persistedMode = null;
  try {
    const { rows } = await pool.query('SELECT value FROM app_config WHERE key=$1', [MODE_KEY]);
    if (rows[0] && rows[0].value) persistedMode = String(rows[0].value).toLowerCase();
  } catch (e) { /* app_config may be absent on first boot */ }

  wire({
    pool, kite, isMarketOpen,
    getKiteToken, getPicks, getNiftyDailyChange,
    getPrices, getAtrPct,
  }, persistedMode);

  if (app) mountRoutes(app, { requireAdmin });

  return { ok: true, mode: getMode(), persistedMode, migration: mig };
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
