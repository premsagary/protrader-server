// server_integration.js — single entry to integrate the engine with kite-server.js
// In kite-server.js, add ONE line near the top:
//   const optionsIntegration = require('./options-strategies/options-engine/server_integration');
// And ONE line in initDB():
//   await optionsIntegration.initDB(pool);
// And ONE line after app + pool are ready:
//   await optionsIntegration.mount({ app, pool, kiteClient: kc });
'use strict';

const engine = require('./index');
const time = require('./time_utils');

// =============== DDL — 8 tables ===============
const DDL = `
CREATE TABLE IF NOT EXISTS options_trades (
  id              SERIAL PRIMARY KEY,
  trade_date      DATE NOT NULL,
  state           VARCHAR(20) NOT NULL DEFAULT 'PROPOSED',
  state_updated_at TIMESTAMP DEFAULT NOW(),
  mode            VARCHAR(10) NOT NULL,
  strategy        VARCHAR(30) NOT NULL,
  day_of_week     VARCHAR(3),
  vix_band        VARCHAR(10),
  vix_prior       NUMERIC(6,2),
  vix_open        NUMERIC(6,2),
  nifty_prior     NUMERIC(10,2),
  nifty_open      NUMERIC(10,2),
  gap_pct         NUMERIC(5,3),
  legs            JSONB NOT NULL,
  lot_size        INTEGER NOT NULL,
  num_lots        INTEGER NOT NULL,
  credit          NUMERIC(10,2),
  margin_used     NUMERIC(10,2),
  sl_per_leg_multiplier    NUMERIC(4,2) DEFAULT 1.25,
  sl_combined_loss_pct     NUMERIC(4,2) DEFAULT 1.00,
  force_exit_time          VARCHAR(8),
  proposed_at     TIMESTAMP DEFAULT NOW(),
  entry_time      TIMESTAMP,
  exit_time       TIMESTAMP,
  exit_reason     VARCHAR(30),
  realized_pnl    NUMERIC(10,2),
  filter_results  JSONB,
  notes           TEXT,
  created_by      VARCHAR(50)
);
CREATE INDEX IF NOT EXISTS idx_ot_date  ON options_trades(trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_ot_state ON options_trades(state);

DO $$ BEGIN
  ALTER TABLE options_trades ADD CONSTRAINT chk_state_valid
    CHECK (state IN ('PROPOSED','BUILDING','VALIDATING','PLACING','OPEN','PARTIAL',
                     'EXITING','RECONCILING','CLOSED','FAILED','REJECTED','EXPIRED','HALTED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_trade
  ON options_trades(trade_date, strategy)
  WHERE state IN ('PROPOSED','BUILDING','VALIDATING','PLACING','OPEN','PARTIAL','EXITING','RECONCILING');

CREATE TABLE IF NOT EXISTS options_state_log (
  id          SERIAL PRIMARY KEY,
  trade_id    INTEGER REFERENCES options_trades(id),
  from_state  VARCHAR(20),
  to_state    VARCHAR(20) NOT NULL,
  ctx         JSONB,
  ts          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sl_trade ON options_state_log(trade_id);

CREATE TABLE IF NOT EXISTS options_event_log (
  id          SERIAL PRIMARY KEY,
  event_type  VARCHAR(40) NOT NULL,
  severity    VARCHAR(10) DEFAULT 'INFO',
  trade_id    INTEGER REFERENCES options_trades(id) ON DELETE SET NULL,
  ctx         JSONB NOT NULL,
  ts          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_el_type  ON options_event_log(event_type, ts DESC);
CREATE INDEX IF NOT EXISTS idx_el_sev   ON options_event_log(severity, ts DESC);
CREATE INDEX IF NOT EXISTS idx_el_trade ON options_event_log(trade_id);

CREATE TABLE IF NOT EXISTS options_order_audit (
  id              SERIAL PRIMARY KEY,
  trade_id        INTEGER REFERENCES options_trades(id),
  leg_index       INTEGER,
  action          VARCHAR(20),
  request_json    JSONB NOT NULL,
  response_json   JSONB,
  http_status     INTEGER,
  error_message   TEXT,
  exchange_ts     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oa_trade ON options_order_audit(trade_id);

CREATE TABLE IF NOT EXISTS options_settings (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER,
  engine_enabled      BOOLEAN DEFAULT FALSE,
  mode                VARCHAR(10) DEFAULT 'PAPER',
  manual_approval     BOOLEAN DEFAULT TRUE,
  capital             NUMERIC(12,2) DEFAULT 200000,
  max_lots            INTEGER DEFAULT 1,
  use_phase           INTEGER DEFAULT 1,
  daily_loss_cap      NUMERIC(10,2) DEFAULT 5000,
  max_open_positions  INTEGER DEFAULT 1,
  max_consec_losses   INTEGER DEFAULT 2,
  max_drawdown_pct    NUMERIC(4,2) DEFAULT 0.15,
  max_vix             NUMERIC(5,2) DEFAULT 35,
  max_spread_pct      NUMERIC(4,2) DEFAULT 0.02,
  safe_mode_active    BOOLEAN DEFAULT FALSE,
  safe_mode_reason    VARCHAR(200),
  safe_mode_entered   TIMESTAMP,
  killed_until        TIMESTAMP,
  killed_reason       VARCHAR(200),
  enabled_filters     JSONB DEFAULT '{}',
  notify_telegram     VARCHAR(100),
  notify_email        VARCHAR(100),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS options_skip_log (
  id           SERIAL PRIMARY KEY,
  trade_date   DATE NOT NULL,
  skip_time    TIMESTAMP DEFAULT NOW(),
  day_of_week  VARCHAR(3),
  vix_prior    NUMERIC(6,2),
  vix_band     VARCHAR(10),
  reason       VARCHAR(200) NOT NULL,
  layer        INTEGER,
  filter_id    INTEGER,
  details      JSONB
);
CREATE INDEX IF NOT EXISTS idx_skip_date ON options_skip_log(trade_date DESC);

CREATE TABLE IF NOT EXISTS options_event_calendar (
  id           SERIAL PRIMARY KEY,
  event_date   DATE NOT NULL UNIQUE,
  event_type   VARCHAR(30),
  description  TEXT,
  skip         BOOLEAN DEFAULT TRUE
);
INSERT INTO options_event_calendar (event_date, event_type, description) VALUES
  -- Macro events (BUDGET / RBI MPC)
  ('2026-02-01', 'BUDGET',  'Union Budget 2026'),
  ('2026-04-09', 'RBI_MPC', 'RBI MPC April 2026'),
  ('2026-06-06', 'RBI_MPC', 'RBI MPC June 2026'),
  ('2026-08-08', 'RBI_MPC', 'RBI MPC August 2026'),
  ('2026-10-08', 'RBI_MPC', 'RBI MPC October 2026'),
  ('2026-12-05', 'RBI_MPC', 'RBI MPC December 2026'),
  -- NSE 2026 trading holidays (best-known schedule; verify against NSE official before deploy)
  ('2026-01-26', 'HOLIDAY', 'Republic Day'),
  ('2026-03-03', 'HOLIDAY', 'Holi'),
  ('2026-03-31', 'HOLIDAY', 'Eid-ul-Fitr (Ramzan Id)'),
  ('2026-04-03', 'HOLIDAY', 'Good Friday'),
  ('2026-04-14', 'HOLIDAY', 'Dr. Ambedkar Jayanti'),
  ('2026-05-01', 'HOLIDAY', 'Maharashtra Day / May Day'),
  ('2026-08-15', 'HOLIDAY', 'Independence Day'),
  ('2026-08-26', 'HOLIDAY', 'Ganesh Chaturthi'),
  ('2026-10-02', 'HOLIDAY', 'Gandhi Jayanti'),
  ('2026-10-21', 'HOLIDAY', 'Dussehra'),
  ('2026-11-09', 'HOLIDAY', 'Diwali (Laxmi Pujan — special muhurat session)'),
  ('2026-11-10', 'HOLIDAY', 'Diwali Balipratipada'),
  ('2026-11-25', 'HOLIDAY', 'Guru Nanak Jayanti'),
  ('2026-12-25', 'HOLIDAY', 'Christmas')
ON CONFLICT (event_date) DO NOTHING;

CREATE TABLE IF NOT EXISTS options_paper_fills (
  id           SERIAL PRIMARY KEY,
  trade_id     INTEGER REFERENCES options_trades(id),
  leg_index    INTEGER,
  bid_at_entry NUMERIC(8,2),
  ask_at_entry NUMERIC(8,2),
  ltp_at_entry NUMERIC(8,2),
  fill_price   NUMERIC(8,2),
  slippage_pct NUMERIC(5,3),
  spread_pct   NUMERIC(5,3),
  ts           TIMESTAMP DEFAULT NOW()
);
`;

async function initDB(pool) {
  await pool.query(DDL);
  console.log('[options] DB schema initialized (8 tables)');
}

// =============== ENDPOINTS ===============
function mount({ app, pool, kiteClient = null, requireAuth = null }) {
  const express = require('express');
  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));

  // Default auth check: prefer host-supplied middleware. Fallback: require req.user with admin role.
  const _isAdmin = (req) => req.user?.role === 'admin' || req.user?.is_admin === true;
  const requireAdmin = (req, res, next) => {
    if (requireAuth) return requireAuth(req, res, () => _isAdmin(req) ? next() : res.status(403).json({ error: 'admin required' }));
    if (!_isAdmin(req)) return res.status(403).json({ error: 'admin required' });
    next();
  };

  // Origin check — applies to BOTH GETs and POSTs since GETs return sensitive data
  // (positions, trades, capital, kill state). FAIL-CLOSED on cross-origin from a browser.
  const explicitOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
  const originCheck = (req, res, next) => {
    const origin = req.headers.origin || '';
    // Empty origin = direct curl/server-to-server, allowed (auth still enforced).
    if (!origin) return next();
    // Parse origin via URL to compare hostnames precisely (no substring tricks).
    let originHost;
    try { originHost = new URL(origin).host; } catch (e) { return res.status(403).json({ error: 'invalid origin' }); }
    const reqHost = req.headers.host;
    const sameOrigin = reqHost === originHost;
    const inExplicit = explicitOrigins.some(o => {
      try { return new URL(o).host === originHost; } catch (e) { return false; }
    });
    const isLocalhost = originHost.startsWith('localhost') || originHost.startsWith('127.0.0.1');
    if (!sameOrigin && !inExplicit && !isLocalhost) {
      return res.status(403).json({ error: 'cross-origin blocked' });
    }
    next();
  };
  router.use(originCheck);

  // Simple in-memory rate limiter: 30 writes/min per IP. Prevents stolen-cookie spam.
  const _rl = new Map();  // ip → [timestamps]
  const rateLimit = (req, res, next) => {
    if (req.method === 'GET') return next();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const recent = (_rl.get(ip) || []).filter(t => now - t < 60000);
    if (recent.length >= 30) return res.status(429).json({ error: 'rate limit (30/min)' });
    recent.push(now);
    _rl.set(ip, recent);
    next();
  };
  router.use(rateLimit);

  // ---------- READ ----------
  router.get('/regime', async (req, res) => {
    try {
      const day = engine.time.dayOfWeek();
      const vixBand = engine.strategyEngine.vixBand;
      let vix = null, spot = null;
      if (kiteClient) {
        try {
          const ltp = await kiteClient.getLTP(['NSE:NIFTY 50', 'NSE:INDIA VIX']);
          spot = ltp['NSE:NIFTY 50']?.last_price;
          vix = ltp['NSE:INDIA VIX']?.last_price;
        } catch (e) {}
      }
      res.json({
        timestamp: engine.time.nowUtc(),
        spot, vix,
        day_of_week: day,
        vix_band: vixBand(vix),
        is_market_open: engine.time.isMarketOpen(),
        next_expiry: engine.time.nextWeeklyExpiry(),
        dte: engine.time.dteToNextExpiry(),
        is_expiry_today: engine.time.isExpiryToday(),
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/today-decision', async (req, res) => {
    try {
      const result = await engine.lifecycleEngine.runDailyCycle({ kc: kiteClient, dryRun: true });
      res.json(result);
    } catch (e) {
      console.error('[options /today-decision]', e.stack);
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/positions', async (req, res) => {
    try {
      const trades = await engine.stateEngine.findActive();
      res.json(trades.map(t => ({
        ...t,
        legs: typeof t.legs === 'string' ? JSON.parse(t.legs) : t.legs,
      })));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/trades', async (req, res) => {
    const days = Math.max(1, Math.min(365, parseInt(req.query.days || '30', 10) || 30));
    try {
      const { rows } = await pool.query(
        `SELECT id, trade_date, state, mode, strategy, day_of_week, vix_band, vix_prior,
                credit, realized_pnl, exit_reason, entry_time, exit_time, proposed_at
         FROM options_trades
         WHERE trade_date >= CURRENT_DATE - ($1 || ' days')::INTERVAL
         ORDER BY proposed_at DESC LIMIT 500`, [String(days)]);
      res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/trades/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
      const trade = await engine.stateEngine.get(id);
      if (!trade) return res.status(404).json({ error: 'not found' });
      const history = await engine.stateEngine.getStateHistory(id);
      const { rows: audits } = await pool.query(
        `SELECT * FROM options_order_audit WHERE trade_id = $1 ORDER BY created_at`, [id]);
      res.json({ trade: { ...trade, legs: typeof trade.legs === 'string' ? JSON.parse(trade.legs) : trade.legs }, history, audits });
    } catch (e) { console.error('[options /trades/:id]', e.stack); res.status(500).json({ error: 'fetch failed' }); }
  });

  router.get('/equity-curve', async (req, res) => {
    const days = Math.max(1, Math.min(365, parseInt(req.query.days || '90', 10) || 90));
    try {
      const { rows } = await pool.query(
        `SELECT trade_date, SUM(realized_pnl) AS pnl
         FROM options_trades
         WHERE state='CLOSED' AND trade_date >= CURRENT_DATE - ($1 || ' days')::INTERVAL
         GROUP BY trade_date ORDER BY trade_date`, [String(days)]);
      let cum = 0;
      const curve = rows.map(r => { cum += parseFloat(r.pnl || 0); return { date: r.trade_date, daily: parseFloat(r.pnl), cumulative: cum }; });
      res.json(curve);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/skip-log', async (req, res) => {
    const days = Math.max(1, Math.min(365, parseInt(req.query.days || '30', 10) || 30));
    try {
      const { rows } = await pool.query(
        `SELECT * FROM options_skip_log WHERE trade_date >= CURRENT_DATE - ($1 || ' days')::INTERVAL ORDER BY skip_time DESC LIMIT 200`,
        [String(days)]);
      res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/event-log', async (req, res) => {
    try {
      const events = await engine.eventLogger.recent({
        limit: parseInt(req.query.limit || '100', 10),
        type: req.query.type, severity: req.query.severity,
      });
      res.json(events);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/settings', async (req, res) => {
    try { res.json(await engine.riskEngine.loadSettings()); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/filter-status', async (req, res) => {
    res.json({
      total: engine.filterEngine.FILTERS.length,
      filters: engine.filterEngine.FILTERS.map(f => ({ id: f.id, name: f.name, layer: f.layer })),
    });
  });

  router.get('/engine/status', async (req, res) => {
    try {
      const settings = await engine.riskEngine.loadSettings();
      const health = engine.healthEngine.snapshot();
      const engState = engine.lifecycleEngine.getEngineState();
      const active = await engine.stateEngine.findActive();
      res.json({
        engine_state: engState.state,
        last_cycle: engState.lastCycle,
        engine_enabled: settings.engine_enabled,
        mode: settings.mode,
        manual_approval: settings.manual_approval,
        safe_mode: { active: settings.safe_mode_active, reason: settings.safe_mode_reason },
        kill: { until: settings.killed_until, reason: settings.killed_reason },
        capital: settings.capital,
        max_lots: settings.max_lots,
        open_positions: active.length,
        health,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/engine/health', (req, res) => {
    res.json(engine.healthEngine.snapshot());
  });

  router.get('/live-monitors', (req, res) => {
    res.json(engine.monitorEngine.getLiveMonitorState());
  });

  router.get('/daily-summary', async (req, res) => {
    try {
      const scheduler = require('./scheduler');
      // Access internal builder via module export
      const summary = await (scheduler.buildAndSendDailySummary?.() ?? Promise.resolve(null));
      res.json(summary || { error: 'unable to build' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/risk-status', async (req, res) => {
    try {
      const r5 = await pool.query(
        `SELECT COALESCE(SUM(realized_pnl), 0) AS p FROM options_trades WHERE state='CLOSED' AND trade_date >= CURRENT_DATE - INTERVAL '5 days'`);
      const today = await pool.query(
        `SELECT COALESCE(SUM(realized_pnl), 0) AS p FROM options_trades WHERE state='CLOSED' AND trade_date = CURRENT_DATE`);
      const open = await engine.stateEngine.findActive();
      const status = await engine.riskEngine.getRiskStatus({
        todayPnl: parseFloat(today.rows[0].p) || 0,
        rolling5dPnl: parseFloat(r5.rows[0].p) || 0,
        openCount: open.length,
      });
      res.json(status);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---------- WRITE ----------
  router.post('/engine/start', requireAdmin, async (req, res) => {
    try {
      if (req.body?.confirm !== true) {
        return res.status(400).json({ error: 'enabling engine requires {confirm:true} in body' });
      }
      await pool.query(`UPDATE options_settings SET engine_enabled = TRUE WHERE id = (SELECT id FROM options_settings ORDER BY id LIMIT 1)`);
      await engine.eventLogger.info('engine_started_manual', { by: req.user?.username || 'ui' });
      res.json({ ok: true });
    } catch (e) { console.error('[options /engine/start]', e.stack); res.status(500).json({ error: 'start failed' }); }
  });

  router.post('/engine/stop', requireAdmin, async (req, res) => {
    try {
      await pool.query(`UPDATE options_settings SET engine_enabled = FALSE WHERE id = (SELECT id FROM options_settings ORDER BY id LIMIT 1)`);
      await engine.eventLogger.info('engine_stopped_manual', { by: 'ui' });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/engine/safe-mode', requireAdmin, async (req, res) => {
    try { await engine.riskEngine.enterSafeMode(req.body?.reason || 'manual'); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/engine/safe-mode/clear', requireAdmin, async (req, res) => {
    try { await engine.riskEngine.exitSafeMode(); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/engine/kill', requireAdmin, async (req, res) => {
    try { await engine.riskEngine.activateKill(req.body?.reason || 'manual', req.body?.days || null); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/engine/kill/clear', requireAdmin, async (req, res) => {
    try { await engine.riskEngine.clearKill(); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/engine/flatten-all', requireAdmin, async (req, res) => {
    try {
      const result = await engine.executionEngine.flattenAll(req.body?.reason || 'manual_ui');
      res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/engine/run-cycle', requireAdmin, async (req, res) => {
    try {
      const result = await engine.lifecycleEngine.runDailyCycle({ kc: kiteClient, dryRun: req.body?.dryRun !== false });
      res.json(result);
    } catch (e) {
      console.error('[options /engine/run-cycle]', e.stack);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/exit-trade/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
      const trade = await engine.stateEngine.get(id);
      if (!trade) return res.status(404).json({ error: 'not found' });
      await engine.monitorEngine.triggerExit(trade.id, 'MANUAL', { by: 'ui' });
      res.json({ ok: true });
    } catch (e) { console.error('[options /exit-trade]', e.stack); res.status(500).json({ error: 'exit failed' }); }
  });

  router.post('/settings', requireAdmin, async (req, res) => {
    try {
      const allowed = ['engine_enabled', 'mode', 'manual_approval', 'capital', 'max_lots',
        'use_phase', 'daily_loss_cap', 'max_open_positions', 'max_consec_losses',
        'max_drawdown_pct', 'max_vix', 'max_spread_pct', 'notify_telegram', 'notify_email',
        'enabled_filters'];

      // High-risk mode/enabled changes require explicit `confirm: true` in body
      const flippingToLive = req.body.mode === 'LIVE';
      const enablingEngine = req.body.engine_enabled === true;
      if ((flippingToLive || enablingEngine) && req.body.confirm !== true) {
        return res.status(400).json({
          error: 'high-risk change (mode=LIVE or engine_enabled=true) requires {confirm:true} in body'
        });
      }

      // Get current settings to log diffs
      const cur = (await pool.query(`SELECT * FROM options_settings ORDER BY id LIMIT 1`)).rows[0];

      const sets = [], params = [];
      const diff = {};
      for (const k of allowed) {
        if (req.body[k] !== undefined) {
          if (cur[k] !== req.body[k]) diff[k] = { from: cur[k], to: req.body[k] };
          params.push(req.body[k]);
          sets.push(`${k} = $${params.length}`);
        }
      }
      if (!sets.length) return res.json({ ok: true, changed: 0 });
      sets.push('updated_at = NOW()');
      await pool.query(
        `UPDATE options_settings SET ${sets.join(', ')} WHERE id = (SELECT id FROM options_settings ORDER BY id LIMIT 1)`,
        params
      );
      // Log all changes for audit trail
      await engine.eventLogger.info('settings_changed', { by: req.user?.username || 'unknown', diff });
      res.json({ ok: true, changed: Object.keys(diff).length, diff });
    } catch (e) { console.error('[options /settings]', e.stack); res.status(500).json({ error: 'settings update failed' }); }
  });

  router.post('/event-calendar', requireAdmin, async (req, res) => {
    try {
      const { event_date, event_type, description, skip } = req.body;
      // Validate ISO date YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) return res.status(400).json({ error: 'event_date must be YYYY-MM-DD' });
      const d = new Date(event_date);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'invalid event_date' });
      const type = String(event_type || '').slice(0, 30);
      const desc = String(description || '').slice(0, 500);
      await pool.query(
        `INSERT INTO options_event_calendar (event_date, event_type, description, skip)
         VALUES ($1, $2, $3, $4) ON CONFLICT (event_date) DO UPDATE SET event_type=$2, description=$3, skip=$4`,
        [event_date, type, desc, skip !== false]);
      res.json({ ok: true });
    } catch (e) { console.error('[options /event-calendar]', e.stack); res.status(500).json({ error: 'event update failed' }); }
  });

  app.use('/api/options', router);
  console.log('[options] mounted at /api/options/*  — 20+ endpoints');
}

// Live Kite reference — stored as a getter so token refresh propagates automatically
let _kiteGetter = () => null;

async function bootEngine({ pool, kiteClient = null, getKite = null, startScheduler = false }) {
  if (getKite) _kiteGetter = getKite;
  else if (kiteClient) _kiteGetter = () => kiteClient;
  // Wrap into a "live" proxy that always resolves the current kite client
  const liveKite = new Proxy({}, {
    get(_, prop) {
      const real = _kiteGetter();
      if (!real) return undefined;
      const v = real[prop];
      return typeof v === 'function' ? v.bind(real) : v;
    }
  });
  await engine.bootEngine({ pgPool: pool, kiteClient: liveKite, startScheduler });
}

// Allow host to provide a fresh getter after token refresh
function setKiteGetter(getter) { _kiteGetter = getter; }

// Public adapter: kite-server.js calls this from its WS message handler
function onTick(instrument, ltp) {
  try { return engine.monitorEngine.evaluateOnTick(instrument, ltp); } catch (e) {}
}

// kite-server calls this when token issued/refreshed (token_iat = unix seconds)
function onTokenIssued(iatSeconds) {
  try { return engine.healthEngine.recordTokenIssued(iatSeconds); } catch (e) {}
}

// Helper: get instruments needed by active monitors so kite-server can subscribe
function getInstrumentsForSubscription() {
  try { return engine.monitorEngine.getInstrumentsToSubscribe(); } catch (e) { return []; }
}

module.exports = { initDB, mount, bootEngine, setKiteGetter, onTick, onTokenIssued, getInstrumentsForSubscription, engine };
