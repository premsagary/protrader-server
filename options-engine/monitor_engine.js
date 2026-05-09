// monitor_engine.js — WebSocket tick-driven SL evaluation.
// Per-leg SL, combined SL, force exit at strategy.forceExitTime.
// Variable check frequency: 2s when near SL, 5s mid-zone, 30s safe.
'use strict';

const eventLogger = require('./event_logger');
const stateEngine = require('./state_engine');
const time = require('./time_utils');
const healthEngine = require('./health_engine');

const monitors = new Map();  // tradeId → { trade, currentPrices: {strike_type → ltp}, lastCheckAt }

let executionEngine = null;
let notificationEngine = null;
function init({ executionEngine: exec, notification }) {
  executionEngine = exec;
  notificationEngine = notification || null;
}

// Compute distance from SL trigger (0 = at SL, 1 = far away). Lower = check more often.
// SELL legs are the only ones with SL — BUY wings are protective and never auto-exit.
function distanceFromSL(trade, currentPrices) {
  const legs = typeof trade.legs === 'string' ? JSON.parse(trade.legs) : trade.legs;
  let minDist = 1.0;
  const slMult = trade.sl_per_leg_multiplier || 1.25;
  for (const leg of legs) {
    if (leg.side !== 'SELL') continue;
    const cur = currentPrices[`${leg.strike}_${leg.type}`];
    if (cur == null || !leg.entry_premium) continue;
    const trigger = leg.entry_premium * slMult;
    const headroom = (trigger - cur) / trigger;
    if (headroom < minDist) minDist = headroom;
  }
  return Math.max(0, minDist);
}

function checkIntervalMs(distance) {
  if (distance < 0.10) return 2000;
  if (distance < 0.30) return 5000;
  return 30000;
}

async function startMonitoring(trade) {
  monitors.set(trade.id, { trade, currentPrices: {}, started: Date.now(), lastCheckAt: 0, distance: 1.0 });
  await eventLogger.info('monitor_started', { tradeId: trade.id, strategy: trade.strategy });
}

// Subscribe to all leg instruments — caller wires this into broker WS subscribe
function getInstrumentsToSubscribe() {
  const symbols = new Set();
  for (const m of monitors.values()) {
    const legs = typeof m.trade.legs === 'string' ? JSON.parse(m.trade.legs) : m.trade.legs;
    for (const leg of legs) {
      if (leg.instrument) symbols.add(leg.instrument);
    }
  }
  return Array.from(symbols);
}

function stopMonitoring(tradeId) {
  monitors.delete(tradeId);
}

function getMonitorStatus(tradeId) {
  return monitors.get(tradeId) || null;
}

function getAllActiveMonitors() {
  return Array.from(monitors.entries()).map(([id, m]) => ({ tradeId: id, ...m }));
}

// Called on every WS tick from broker
async function evaluateOnTick(instrument, ltp) {
  healthEngine.recordTick();
  for (const [tradeId, m] of monitors.entries()) {
    const trade = m.trade;
    const legs = typeof trade.legs === 'string' ? JSON.parse(trade.legs) : trade.legs;
    let matchedLeg = null;
    for (const leg of legs) {
      if (leg.instrument === instrument || `NFO:NIFTY${leg.strike}${leg.type}` === instrument) {
        matchedLeg = leg;
        m.currentPrices[`${leg.strike}_${leg.type}`] = ltp;
        break;
      }
    }
    if (!matchedLeg) continue;

    // Update distance for variable freq — used to throttle expensive checks
    m.distance = distanceFromSL(trade, m.currentPrices);
    const intervalMs = checkIntervalMs(m.distance);
    const sinceLast = Date.now() - (m.lastCheckAt || 0);
    if (sinceLast < intervalMs && m.distance > 0.10) continue;  // throttle except critical
    m.lastCheckAt = Date.now();

    // Filter 38: per-leg SL on SELL legs only.
    // BUY legs (defined-risk wings) are PROTECTIVE — exiting them while shorts open creates
    // naked exposure. Wings naturally lose theta on quiet days; that's expected. Combined-SL
    // on the SELL legs is the real safety. Audit fix: BUY-leg SL was a profit-killer.
    const slMultiplier = trade.sl_per_leg_multiplier || 1.25;
    if (matchedLeg.side === 'SELL' && ltp >= matchedLeg.entry_premium * slMultiplier) {
      await triggerExit(tradeId, 'SL_LEG', { leg: matchedLeg, ltp });
      continue;
    }

    // Filter 39: combined SL — sum of all SELL leg current premiums
    const sellLegs = legs.filter(l => l.side === 'SELL');
    const combinedNow = sellLegs.reduce((a, l) => a + (m.currentPrices[`${l.strike}_${l.type}`] ?? l.entry_premium), 0);
    const entryCombined = sellLegs.reduce((a, l) => a + l.entry_premium, 0);
    const combinedThreshold = entryCombined * (1 + (trade.sl_combined_loss_pct || 1.0));
    if (combinedNow >= combinedThreshold) {
      await triggerExit(tradeId, 'SL_COMBINED', { combinedNow, threshold: combinedThreshold });
    }
  }
}

// Force exit timer (called by scheduler) — guarded so each trade only triggers once
const _forceExitFired = new Set();
async function checkForceExits() {
  const nowClock = time.istClock(new Date(), false);
  for (const [tradeId, m] of monitors.entries()) {
    if (_forceExitFired.has(tradeId)) continue;
    const exitTime = m.trade.force_exit_time || '14:30';
    if (nowClock >= exitTime) {
      _forceExitFired.add(tradeId);
      await triggerExit(tradeId, 'TIME', { clock: nowClock });
    }
  }
  // Also check PARTIAL trades not in monitor map
  if (executionEngine && executionEngine.flattenPartialIfDue) {
    await executionEngine.flattenPartialIfDue(nowClock);
  }
}

async function triggerExit(tradeId, reason, ctx) {
  const m = monitors.get(tradeId);
  if (!m) return;
  if (m._exiting) return;  // idempotency guard — already exiting
  m._exiting = true;
  await eventLogger.warn('exit_triggered', { tradeId, reason, ...ctx });
  try {
    await stateEngine.transition(tradeId, 'EXITING', { reason, ...ctx });
    if (executionEngine) {
      const result = await executionEngine.exitBasket(m.trade, { mode: m.trade.mode, chain: ctx.chain });
      await stateEngine.transition(tradeId, 'RECONCILING', { exit_legs: result.exit_legs });
      await stateEngine.transition(tradeId, 'CLOSED', { exit_reason: reason, realized_pnl: result.realized_pnl });
      await eventLogger.info('trade_closed', { tradeId, reason, pnl: result.realized_pnl });
      if (notificationEngine) await notificationEngine.tradeExited({ ...m.trade, realized_pnl: result.realized_pnl, exit_reason: reason });
    }
    stopMonitoring(tradeId);
  } catch (e) {
    await eventLogger.error('exit_failed', { tradeId, reason, error: e.message });
    // Always clean up monitor map even on failure (avoid memory leak)
    stopMonitoring(tradeId);
    if (m) m._exiting = false;  // allow retry
  }
}

// Snapshot for UI live P&L
function getLiveMonitorState() {
  return Array.from(monitors.entries()).map(([id, m]) => {
    const legs = typeof m.trade.legs === 'string' ? JSON.parse(m.trade.legs) : m.trade.legs;
    const sellLegs = legs.filter(l => l.side === 'SELL');
    const entrySum = sellLegs.reduce((a, l) => a + l.entry_premium * l.qty * (m.trade.lot_size || 75), 0);
    const currentSum = sellLegs.reduce((a, l) => {
      const cur = m.currentPrices[`${l.strike}_${l.type}`] ?? l.entry_premium;
      return a + cur * l.qty * (m.trade.lot_size || 75);
    }, 0);
    const unrealizedPnl = Math.round(entrySum - currentSum);
    return {
      tradeId: id,
      strategy: m.trade.strategy,
      currentPrices: m.currentPrices,
      distance: m.distance,
      checkIntervalMs: checkIntervalMs(m.distance),
      unrealizedPnl,
      timeMonitoring: Math.round((Date.now() - m.started) / 1000),
    };
  });
}

module.exports = {
  init, startMonitoring, stopMonitoring, getMonitorStatus, getAllActiveMonitors,
  evaluateOnTick, checkForceExits, triggerExit,
  getInstrumentsToSubscribe, getLiveMonitorState, distanceFromSL,
};
