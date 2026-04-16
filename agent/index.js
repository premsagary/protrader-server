/**
 * agent/index.js — cycle orchestrator.
 *
 * One call into this file = one complete agent cycle:
 *   getVerifiedState → killSwitchCheck → propose → validate → audit → place
 *
 * The cycle is idempotent on its own; safety against double-firing across
 * overlapping cron ticks is provided by the `_cycleRunning` guard.
 *
 * Wiring (see README.md): kite-server.js adds ONE require and ONE call.
 *   const agent = require('./agent');
 *   agent.wire({ pool, kite, isMarketOpen, getKiteToken, getPicks, getNiftyDailyChange });
 *
 * `getPicks` should return `_dayTradeCache` (or any array of picks matching
 * the scoreDayTrade output schema). `getKiteToken` returns the current access
 * token (or null). `getNiftyDailyChange` returns _niftyDailyChangePct.
 */

'use strict';

const cron = require('node-cron');

const { getMode, setMode, listValidModes, CYCLE } = require('./agent-config');
const { getVerifiedState, isSystemKilled } = require('./agent-state');
const tradeAgent       = require('./trade-agent');
const constraintEngine = require('./constraint-engine');
const audit            = require('./agent-audit');
const execution        = require('./execution-engine');

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
    // Lazy migration-presence check. If the tables don't exist we skip + tell
    // the operator; we do NOT auto-create (migrations are manual in ProTrader).
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
      return { skipped: 'killed', reason: killed, runId };
    }

    // 3. Picks
    const picks = deps.getPicks ? (deps.getPicks() || []) : [];
    if (!picks.length) return { skipped: 'no_picks', runId };

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

    // 7. Execute (dry run = synthetic ids, no broker touch)
    //    For dry_run we STILL call place() so the full pipeline is exercised
    //    every cycle. But we do NOT write to agent_trades in dry_run (the
    //    table is reserved for paper/live).
    const placed = [];
    if (mode !== 'dry_run') {
      // Paper/live path — Phase 2+
      for (const p of approved) {
        const res = await execution.place(p, deps);
        placed.push({ sym: p.sym, ...res });
      }
    } else {
      for (const p of approved) placed.push({ sym: p.sym, ok: true, mode: 'dry_run' });
    }

    const elapsedMs = Date.now() - started;
    console.log(
      `🤖 agent ${runId}: mode=${mode} picks=${picks.length} `
      + `proposed=${proposals.length} approved=${approved.length} `
      + `rejected=${allRejected.length} (${elapsedMs}ms)`
    );

    return {
      ok: true, runId, mode,
      picksCount: picks.length,
      proposedCount: proposals.length,
      approvedCount: approved.length,
      rejectedCount: allRejected.length,
      placed,
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

// ────────────────────────────────────────────────────────────────────────────
// wire — called once by kite-server.js at startup.
//
// The cron runs unconditionally; runCycle() short-circuits when mode='off'.
// This lets the UI flip modes without needing to restart or rewire.
// If a persistedMode is provided (from app_config), it overrides the env var.
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

  // Cadence: every minute between 09:00 and 15:59 server time, Mon-Fri.
  // IST-vs-local gating is handled inside getVerifiedState / isSystemKilled,
  // so a coarse cron expression is intentional.
  if (_cronTask) _cronTask.stop();
  _cronTask = cron.schedule(CYCLE.CRON_EXPR_SIMPLE, () => {
    runCycle().catch(e => console.error('🤖 agent cycle uncaught:', e.message));
  });

  const mode = getMode();
  console.log(`🤖 agent: wired (mode=${mode}, cron=${CYCLE.CRON_EXPR_SIMPLE}, cycle auto-skips when mode=off)`);
  return { wired: true, mode, cron: true };
}

// Runtime mode switch. Persistence is the CALLER's responsibility
// (kite-server's /api/agent/mode writes to app_config).
function applyMode(m) { return setMode(m); }

function getStatus() {
  return {
    mode: getMode(),
    validModes: listValidModes(),
    cycleRunning: _cycleRunning,
    wired: Boolean(_deps),
    cronActive: Boolean(_cronTask),
  };
}

function stop() {
  if (_cronTask) { _cronTask.stop(); _cronTask = null; }
  return { stopped: true };
}

// ────────────────────────────────────────────────────────────────────────────
// mountRoutes — attach the 4 admin endpoints on the caller's Express app.
//
//   GET  /api/agent/status      → { mode, validModes, stats, recent[] }
//   POST /api/agent/mode        → body { mode } — persists to app_config
//   POST /api/agent/run-now     → force one cycle (for dev/debugging)
//   GET  /api/agent/decisions   → last N decisions (?limit=50)
//
// All endpoints return JSON. Auth is delegated to the caller — pass in an
// optional `requireAdmin` middleware if you want role gating.
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
      const [stats, recent] = await Promise.all([
        audit.getTodayStats(pool),
        audit.getRecentDecisions(pool, 20),
      ]);
      res.json({
        ok: true,
        ...getStatus(),
        paperCapital: require('./agent-config').PAPER_CAPITAL_RUPEES,
        configVersion: require('./agent-config').CONFIG_VERSION,
        envFallback: (process.env.AGENT_MODE || 'off').toLowerCase(),
        stats,
        recent,
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
      // Persist so it survives restarts
      try {
        await pool.query(
          `INSERT INTO app_config(key,value,updated_at) VALUES($1,$2,NOW())
           ON CONFLICT(key) DO UPDATE SET value=$2, updated_at=NOW()`,
          [MODE_KEY, m]
        );
      } catch (pe) {
        // app_config missing — don't fail the switch, just warn
        console.error('🤖 agent.mountRoutes: failed to persist mode:', pe.message);
      }
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

  console.log('🤖 agent: routes mounted at /api/agent/{status,mode,run-now,decisions}');
  return { mounted: true };
}

// Idempotent DDL bootstrap — runs the 001 migration if tables are missing.
// All statements are `CREATE TABLE / INDEX IF NOT EXISTS`, so re-running is a
// no-op. Called by bootstrap() on every boot so a fresh Railway deploy
// self-heals without manual psql.
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

// Convenience bootstrap: migrate + wire + persist-check + mountRoutes in one call.
// kite-server.js can just do:
//   await require('./agent').bootstrap({ app, pool, kite, ... });
async function bootstrap({ app, pool, kite, isMarketOpen, getKiteToken, getPicks, getNiftyDailyChange, requireAdmin }) {
  // 1. Ensure audit tables exist (auto-applies migration if needed)
  const mig = await _ensureMigration(pool);

  // 2. Load persisted mode override (falls back to env var on first boot)
  const MODE_KEY = 'agent_mode_override';
  let persistedMode = null;
  try {
    const { rows } = await pool.query('SELECT value FROM app_config WHERE key=$1', [MODE_KEY]);
    if (rows[0] && rows[0].value) persistedMode = String(rows[0].value).toLowerCase();
  } catch (e) {
    // app_config table may not exist on first boot — fall through to env var
  }

  // 3. Wire cron + runtime mode + dependencies
  wire({ pool, kite, isMarketOpen, getKiteToken, getPicks, getNiftyDailyChange }, persistedMode);

  // 4. Mount admin HTTP endpoints
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
  // exposed for tests / admin API
  _internal: { tradeAgent, constraintEngine, audit, execution },
};
