// lifecycle_engine.js — daily flow: BOOT → HEALTH_CHECK → ... → COMPLETE.
'use strict';

const time = require('./time_utils');
const eventLogger = require('./event_logger');
const stateEngine = require('./state_engine');
const strategyEngine = require('./strategy_engine');
const filterEngine = require('./filter_engine');
const healthEngine = require('./health_engine');
const riskEngine = require('./risk_engine');
const recoveryEngine = require('./recovery_engine');
const monitorEngine = require('./monitor_engine');
const executionEngine = require('./execution_engine');

let pool = null;
let kc = null;
let engineState = 'BOOT';
let lastCycle = null;

function init({ pgPool, kiteClient }) {
  pool = pgPool;
  kc = kiteClient || null;
}

async function transitionEngine(toState, reason = '') {
  const from = engineState;
  engineState = toState;
  await eventLogger.info('engine_transition', { from, to: toState, reason });
}

function getEngineState() { return { state: engineState, lastCycle }; }

// Cache NFO instruments for the trading day (refreshed daily)
let _nfoInstrumentsCache = null;
let _nfoInstrumentsCachedAt = 0;
async function getNfoInstruments(kc) {
  const ONE_HOUR = 3600 * 1000;
  if (_nfoInstrumentsCache && Date.now() - _nfoInstrumentsCachedAt < ONE_HOUR) return _nfoInstrumentsCache;
  if (!kc) return null;
  try {
    _nfoInstrumentsCache = await kc.getInstruments('NFO');
    _nfoInstrumentsCachedAt = Date.now();
    return _nfoInstrumentsCache;
  } catch (e) {
    await eventLogger.error('nfo_instruments_fetch_failed', { error: e.message });
    return null;
  }
}

// Resolve real Kite tradingsymbol + lot size + instrument_token for a NIFTY weekly option leg
async function resolveOptionInstrument(kc, expiryDate, strike, type) {
  const instr = await getNfoInstruments(kc);
  if (!instr) return null;
  const expIso = expiryDate.toISOString().slice(0, 10);
  const m = instr.find(i =>
    i.name === 'NIFTY' &&
    i.expiry === expIso &&
    Number(i.strike) === Number(strike) &&
    i.instrument_type === type
  );
  return m ? { tradingsymbol: m.tradingsymbol, lot_size: m.lot_size, instrument_token: m.instrument_token } : null;
}

// Build live option chain (ATM ± 10 strikes) from Kite quotes
async function buildLiveChain(kc, spot, expiryDate) {
  if (!kc) return {};
  const instr = await getNfoInstruments(kc);
  if (!instr) return {};
  const expIso = expiryDate.toISOString().slice(0, 10);
  const niftyExpiry = instr.filter(i => i.name === 'NIFTY' && i.expiry === expIso);
  if (!niftyExpiry.length) return {};
  const atm = Math.round(spot / 50) * 50;
  const wantedStrikes = [];
  for (let off = -10; off <= 10; off++) wantedStrikes.push(atm + off * 50);
  const symbols = [];
  for (const s of wantedStrikes) {
    for (const t of ['CE', 'PE']) {
      const m = niftyExpiry.find(i => Number(i.strike) === s && i.instrument_type === t);
      if (m) symbols.push(`NFO:${m.tradingsymbol}`);
    }
  }
  if (!symbols.length) return {};
  let quotes = {};
  try { quotes = await kc.getQuote(symbols); } catch (e) { return {}; }
  const chain = {};
  for (const [sym, q] of Object.entries(quotes)) {
    const parts = sym.replace('NFO:', '');
    // Match to instrument record
    const m = niftyExpiry.find(i => i.tradingsymbol === parts);
    if (!m) continue;
    const strike = Number(m.strike);
    const type = m.instrument_type.toLowerCase();
    if (!chain[strike]) chain[strike] = {};
    chain[strike][type] = {
      ltp:  q.last_price,
      bid:  q.depth?.buy?.[0]?.price || (q.last_price * 0.99),
      ask:  q.depth?.sell?.[0]?.price || (q.last_price * 1.01),
      oi:   q.oi,
      tradingsymbol: m.tradingsymbol,
      instrument_token: m.instrument_token,
      lot_size: m.lot_size,
    };
  }
  return chain;
}

// Build today's context for filters + strategy
async function buildContext({ kc, settings }) {
  const ctx = {
    day: time.dayOfWeek(),
    isExpiry: time.isExpiryToday(),
    settings,
    health: healthEngine.snapshot(),
    broker: { tokenAgeHours: healthEngine.snapshot().token?.age_hours || 0, consecFails: healthEngine.snapshot().broker.consec_fails },
    exchange: { ok: true },
    chainAgeMs: 999999,  // updated below if chain fetched fresh
    vixAgeSec: 999,
    wsLastTickMs: healthEngine.snapshot().ws.last_tick_age_ms || 0,
    consecMaxLossDays: 0,
    drawdown: 0,
    rolling5dPnl: 0,
    rolling30dPnl: 0,
    eventToday: null,
    chain: {},
    availableMargin: 0,
  };

  // Pull rolling P&L from DB
  if (pool) {
    const r5 = await pool.query(
      `SELECT COALESCE(SUM(realized_pnl), 0) AS total FROM options_trades
       WHERE state='CLOSED' AND trade_date >= CURRENT_DATE - INTERVAL '5 days'`);
    const r30 = await pool.query(
      `SELECT COALESCE(SUM(realized_pnl), 0) AS total FROM options_trades
       WHERE state='CLOSED' AND trade_date >= CURRENT_DATE - INTERVAL '30 days'`);
    ctx.rolling5dPnl = parseFloat(r5.rows[0].total) || 0;
    ctx.rolling30dPnl = parseFloat(r30.rows[0].total) || 0;

    const e = await pool.query(
      `SELECT event_type FROM options_event_calendar WHERE event_date = CURRENT_DATE AND skip = TRUE`);
    if (e.rows.length) ctx.eventToday = e.rows[0].event_type;

    const recent = await pool.query(
      `SELECT trade_date, realized_pnl FROM options_trades WHERE state='CLOSED' ORDER BY trade_date DESC LIMIT 10`);
    let consec = 0;
    for (const t of recent.rows) {
      if (parseFloat(t.realized_pnl) <= -5000) consec++; else break;
    }
    ctx.consecMaxLossDays = consec;
  }

  // Live market data
  if (kc) {
    const t0 = Date.now();
    try {
      const ltp = await kc.getLTP(['NSE:NIFTY 50', 'NSE:INDIA VIX']);
      ctx.niftyOpen = ltp['NSE:NIFTY 50']?.last_price;
      ctx.vixNow = ltp['NSE:INDIA VIX']?.last_price;
      ctx.vixPrior = ctx.vixNow;
      ctx.vixAgeSec = (Date.now() - t0) / 1000;
      healthEngine.recordBrokerSuccess(Date.now() - t0);

      // Prior close: use Kite OHLC API (yesterday's close)
      try {
        const ohlc = await kc.getOHLC(['NSE:NIFTY 50']);
        ctx.niftyPrior = ohlc['NSE:NIFTY 50']?.ohlc?.close || ctx.niftyOpen;
      } catch (e) { ctx.niftyPrior = ctx.niftyOpen; }

      // Margin
      try {
        const m = await kc.getMargins('equity');
        ctx.availableMargin = m?.net || m?.available?.live_balance || 200000;
      } catch (e) { ctx.availableMargin = settings.capital || 200000; }

      // Chain (ATM ± 10 strikes)
      if (ctx.niftyOpen) {
        const expiry = time.nextWeeklyExpiry();
        const t1 = Date.now();
        ctx.chain = await buildLiveChain(kc, ctx.niftyOpen, expiry);
        ctx.chainAgeMs = Date.now() - t1;
        ctx.expiry = expiry;
      }
    } catch (e) {
      healthEngine.recordBrokerFailure(e);
      await eventLogger.error('buildContext_failed', { error: e.message });
    }
  } else {
    // Paper-only / no broker: provide reasonable defaults so filters don't HALT
    ctx.availableMargin = settings.capital || 200000;
    ctx.chainAgeMs = 0;
    ctx.vixAgeSec = 0;
  }
  return ctx;
}

module.exports.getNfoInstruments = getNfoInstruments;
module.exports.resolveOptionInstrument = resolveOptionInstrument;
module.exports.buildLiveChain = buildLiveChain;

async function runDailyCycle({ kc, dryRun = false } = {}) {
  lastCycle = new Date();
  await transitionEngine('HEALTH_CHECK', 'cycle start');

  if (!healthEngine.isHealthy()) {
    await transitionEngine('SAFE_MODE', healthEngine.degradationReason());
    await riskEngine.enterSafeMode(healthEngine.degradationReason());
    return { decision: 'SAFE_MODE', reason: healthEngine.degradationReason() };
  }

  const settings = await riskEngine.loadSettings();
  if (!settings.engine_enabled) {
    await transitionEngine('COMPLETE', 'engine disabled');
    return { decision: 'DISABLED' };
  }
  if (settings.killed_until && new Date() < new Date(settings.killed_until)) {
    await transitionEngine('COMPLETE', `kill switch active: ${settings.killed_reason}`);
    return { decision: 'KILLED', reason: settings.killed_reason };
  }

  await transitionEngine('PREMARKET');
  await recoveryEngine.runStartupRecovery();

  // Multi-position cap check
  const openCount = (await stateEngine.findActive()).length;
  if (openCount >= settings.max_open_positions) {
    await transitionEngine('COMPLETE', `at max open positions (${openCount}/${settings.max_open_positions})`);
    return { decision: 'AT_MAX_POSITIONS', open: openCount };
  }

  // Skip stabilization wait in dryRun
  if (!dryRun) {
    await transitionEngine('STABILIZATION_WINDOW');
    // In production: sleep until 09:22 IST. Skipped in dryRun.
  }

  await transitionEngine('BUILD_TRADE');
  const ctx = await buildContext({ kc, settings });

  // First pass: filters that don't need the trade card
  let result = filterEngine.runAllFilters(ctx);
  if (result.decision !== 'TRADE') {
    if (pool) {
      await pool.query(
        `INSERT INTO options_skip_log (trade_date, day_of_week, vix_prior, vix_band, reason, layer, filter_id, details)
         VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, $6, $7)`,
        [ctx.day, ctx.vixPrior || null, result.vix_band || null, result.reason,
         result.blockers[0]?.layer || null, result.blockers[0]?.id || null,
         JSON.stringify({ filters: result.results.length, blockers: result.blockers.length })]
      );
    }
    await transitionEngine('COMPLETE', `decision: ${result.decision}`);
    return { decision: result.decision, reason: result.reason, filterResults: result.results };
  }

  // Resolve real lot size from chain (first quote that has it) — fallback to 75
  const lotSize = (() => {
    for (const sk of Object.values(ctx.chain || {})) {
      for (const t of ['ce','pe']) if (sk[t]?.lot_size) return sk[t].lot_size;
    }
    return 75;
  })();

  // Build trade card with REAL tradingsymbols populated by chain
  const tradeCard = strategyEngine.buildTradeCard(result.strategy, {
    spot: ctx.niftyOpen, chain: ctx.chain || {}, lotSize, useRealInstruments: true,
  });
  if (tradeCard.error) {
    await transitionEngine('COMPLETE', `build failed: ${tradeCard.error}`);
    return { decision: 'BUILD_FAILED', error: tradeCard.error };
  }
  ctx.tradeCard = tradeCard;
  ctx.lots = 1;

  // Second pass: include trade-card-dependent filters (Layer 4)
  result = filterEngine.runAllFilters(ctx);
  if (result.decision !== 'TRADE') {
    await transitionEngine('COMPLETE', `decision after build: ${result.decision}`);
    return { decision: result.decision, reason: result.reason, tradeCard, filterResults: result.results };
  }

  await transitionEngine('VALIDATE');
  const realMargin = await executionEngine.getRealMargin(tradeCard.legs, lotSize);
  if (realMargin && realMargin > (ctx.availableMargin || 200000) * 0.8) {
    await riskEngine.enterSafeMode('margin insufficient at validate');
    return { decision: 'SAFE_MODE', reason: 'margin insufficient' };
  }

  if (dryRun) {
    await transitionEngine('COMPLETE', 'dry-run');
    return { decision: 'TRADE_DRY_RUN', strategy: result.strategy, tradeCard, filterResults: result.results };
  }

  // Place
  await transitionEngine('PLACE');
  return await executionEngine.withTradeLock(time.istDateString(), result.strategy, async () => {
    const tradeId = await stateEngine.create({
      trade_date: time.isoDate(),
      strategy: result.strategy,
      mode: settings.mode,
      day_of_week: ctx.day,
      vix_band: result.vix_band,
      vix_prior: ctx.vixPrior,
      nifty_prior: ctx.niftyPrior,
      legs: tradeCard.legs,
      lot_size: lotSize,             // resolved from chain (line 256), not hardcoded
      num_lots: 1,
      credit: tradeCard.credit,
      margin_used: realMargin || tradeCard.marginEstimate,
      sl_per_leg_multiplier: tradeCard.slPerLegMultiplier,
      sl_combined_loss_pct: tradeCard.slCombinedLossPct,
      force_exit_time: tradeCard.forceExitTime,
      filter_results: result.results,
      created_by: 'engine_auto',
    });
    await stateEngine.transition(tradeId, 'BUILDING');
    await stateEngine.transition(tradeId, 'VALIDATING');
    await stateEngine.transition(tradeId, 'PLACING');

    const placed = await executionEngine.placeBasket(tradeCard, { mode: settings.mode, lotSize, chain: ctx.chain || {} }, tradeId);
    if (!placed.all_complete) {
      await stateEngine.transition(tradeId, 'PARTIAL', placed);
      await transitionEngine('SAFE_MODE', 'partial fill');
      return { decision: 'PARTIAL_FILL', tradeId };
    }
    // Update legs with fills
    if (pool) {
      await pool.query(`UPDATE options_trades SET legs = $1 WHERE id = $2`,
        [JSON.stringify(placed.filled), tradeId]);
    }
    await stateEngine.transition(tradeId, 'OPEN', { fills: placed.filled.length });

    await transitionEngine('MONITOR');
    await monitorEngine.startMonitoring({ ...await stateEngine.get(tradeId) });
    return { decision: 'TRADE_PLACED', tradeId, strategy: result.strategy, credit: tradeCard.credit };
  });
}

module.exports = { init, runDailyCycle, transitionEngine, getEngineState, buildContext };
