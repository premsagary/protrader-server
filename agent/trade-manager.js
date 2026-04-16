/**
 * trade-manager.js — position poller for open paper trades.
 *
 * Runs every POLL_INTERVAL_SEC (default 15s) during market hours.
 * For each open agent_trades row:
 *   1. Fetch current price (livePrices cache → Kite LTP fallback, via deps.getPrices).
 *   2. Evaluate in priority order: SL hit, TGT hit, time exit (15:15 IST).
 *   3. If still open and in profit, update trailing SL.
 *   4. Write agent_trade_events rows for every action.
 *
 * Exit pricing rules (deterministic for reproducible simulation):
 *   - SL_HIT     → exit at stop_loss level (worst-of conservative fill).
 *   - TARGET_HIT → exit at target level.
 *   - TIME_EXIT  → exit at current LTP.
 *
 * PnL = (exit - entry) × qty for BUY, flipped sign for SELL.
 *
 * Poller uses its own _polling guard so ticks never overlap. Interval fires
 * even during closed hours — the tick checks isMarketOpen() and bails
 * quickly if off-hours, so there's no wasted Kite call.
 */

'use strict';

const { MGMT } = require('./agent-config');
const { minsSinceOpenIST } = require('./agent-state');
const audit = require('./agent-audit');

const POLL_INTERVAL_MS = (MGMT.POLL_INTERVAL_SEC || 15) * 1000;

// In-process state
let _polling = false;
let _intervalId = null;
let _lastTick = null;
let _tickCount = 0;

// ── pnlFor() ────────────────────────────────────────────────────────────────
function pnlFor(trade, exitPrice) {
  const dir = trade.side === 'BUY' ? 1 : -1;
  const basis = Number(trade.fill_price || trade.planned_entry);
  const ret = (exitPrice - basis) * dir;
  const pnlRupees = +(ret * trade.quantity).toFixed(2);
  const pnlPct = basis > 0 ? +((ret / basis) * 100).toFixed(3) : 0;
  return { pnlRupees, pnlPct };
}

// ── exitTrade() ─────────────────────────────────────────────────────────────
async function exitTrade(pool, trade, { exitPrice, reason, runId }) {
  const { pnlRupees, pnlPct } = pnlFor(trade, exitPrice);
  await pool.query(
    `UPDATE agent_trades
        SET exit_at = NOW(), exit_price = $1, exit_reason = $2,
            pnl_rupees = $3, pnl_pct = $4
      WHERE id = $5 AND exit_at IS NULL`,
    [exitPrice, reason, pnlRupees, pnlPct, trade.id]
  );
  await audit.writeTradeEvent(pool, {
    agentTradeId: trade.id,
    runId,
    eventType: reason,
    payload: {
      exitPrice, pnlRupees, pnlPct,
      entry: trade.fill_price || trade.planned_entry,
      qty: trade.quantity,
    },
  });
  console.log(
    `🏁 agent: exit ${trade.sym} ${trade.side} @ ₹${exitPrice} `
    + `[${reason}] PnL ₹${pnlRupees.toFixed(0)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%) `
    + `trade_id=${trade.id}`
  );
  return { ok: true, pnlRupees, pnlPct, exitReason: reason };
}

// ── maybeTrailSL() ──────────────────────────────────────────────────────────
// Breakeven at 1R, ATR-based trail at 2R+. Monotonic (never moves against us).
async function maybeTrailSL(pool, trade, currentPrice, deps) {
  if (trade.side !== 'BUY') return { moved: false, reason: 'sell_trail_unimplemented' };

  const entry = Number(trade.fill_price || trade.planned_entry);
  const sl    = Number(trade.planned_stop_loss);
  const initialRisk = entry - sl;
  if (initialRisk <= 0) return { moved: false, reason: 'invalid_initial_risk' };

  const unrealizedR = (currentPrice - entry) / initialRisk;
  const beR  = MGMT.TRAIL_BREAKEVEN_R_MULTIPLE || 1.0;
  const atrR = MGMT.TRAIL_ATR_R_MULTIPLE || 2.0;
  if (unrealizedR < beR) return { moved: false, reason: `only_${unrealizedR.toFixed(2)}R` };

  let newSL = entry;
  let trailLabel = 'TRAIL_BREAKEVEN';

  if (unrealizedR >= atrR) {
    const atrPct = deps.getAtrPct ? (deps.getAtrPct(trade.sym) || 0) : 0;
    const atrAbs = currentPrice * (atrPct / 100);
    if (atrAbs > 0) {
      const atrSL = +(currentPrice - (MGMT.TRAIL_ATR_MULT || 0.75) * atrAbs).toFixed(2);
      if (atrSL > newSL) { newSL = atrSL; trailLabel = 'TRAIL_ATR'; }
    }
  }

  if (newSL <= sl + 0.01) return { moved: false, reason: 'no_improvement' };

  await pool.query(
    `UPDATE agent_trades SET planned_stop_loss = $1 WHERE id = $2`,
    [newSL, trade.id]
  );
  await audit.writeTradeEvent(pool, {
    agentTradeId: trade.id,
    runId: deps.runId,
    eventType: 'SL_MODIFIED',
    payload: {
      oldSL: sl, newSL, currentPrice,
      unrealizedR: +unrealizedR.toFixed(2),
      label: trailLabel,
    },
  });
  console.log(
    `📈 agent: trailed SL ${trade.sym} ₹${sl.toFixed(2)} → ₹${newSL.toFixed(2)} `
    + `(${trailLabel}, ${unrealizedR.toFixed(2)}R, trade_id=${trade.id})`
  );
  return { moved: true, oldSL: sl, newSL, label: trailLabel };
}

// ── evaluateOne() ───────────────────────────────────────────────────────────
async function evaluateOne(pool, trade, currentPrice, deps) {
  const sl  = Number(trade.planned_stop_loss);
  const tgt = Number(trade.planned_target);

  if (trade.side === 'BUY') {
    if (currentPrice <= sl)  return exitTrade(pool, trade, { exitPrice: sl,  reason: 'SL_HIT',     runId: deps.runId });
    if (currentPrice >= tgt) return exitTrade(pool, trade, { exitPrice: tgt, reason: 'TARGET_HIT', runId: deps.runId });
  } else {
    if (currentPrice >= sl)  return exitTrade(pool, trade, { exitPrice: sl,  reason: 'SL_HIT',     runId: deps.runId });
    if (currentPrice <= tgt) return exitTrade(pool, trade, { exitPrice: tgt, reason: 'TARGET_HIT', runId: deps.runId });
  }

  // Time exit — `deps.nowMins` is an optional injection point for tests.
  // In production, the real IST clock is used.
  const mins = typeof deps.nowMins === 'number' ? deps.nowMins : minsSinceOpenIST();
  if (mins >= (MGMT.TIME_EXIT_MINS || 360)) {
    return exitTrade(pool, trade, { exitPrice: currentPrice, reason: 'TIME_EXIT', runId: deps.runId });
  }

  return maybeTrailSL(pool, trade, currentPrice, deps);
}

// ── pollOpenTrades() ────────────────────────────────────────────────────────
async function pollOpenTrades(deps) {
  if (_polling) return { skipped: 'already_polling' };
  if (!deps || !deps.pool) return { skipped: 'no_pool' };

  _polling = true;
  try {
    const { rows } = await deps.pool.query(`
      SELECT id, sym, side, planned_entry, planned_stop_loss, planned_target,
             fill_price, quantity, filled_at, agent_decision_id
        FROM agent_trades
       WHERE exit_at IS NULL AND agent_mode = 'paper'
       ORDER BY id ASC
    `);
    _tickCount++;
    _lastTick = new Date().toISOString();
    if (!rows.length) return { ok: true, open: 0, actions: [] };

    const syms = [...new Set(rows.map(r => r.sym))];
    const prices = deps.getPrices ? await deps.getPrices(syms) : {};
    const actions = [];

    for (const t of rows) {
      const px = prices[t.sym];
      if (px == null || !Number.isFinite(Number(px)) || Number(px) <= 0) continue;
      const r = await evaluateOne(deps.pool, t, Number(px), deps);
      if (r && r.ok) actions.push({ sym: t.sym, tradeId: t.id, exit: r.exitReason, pnlRupees: r.pnlRupees });
      else if (r && r.moved) actions.push({ sym: t.sym, tradeId: t.id, trailedTo: r.newSL });
    }

    return { ok: true, open: rows.length, actions };
  } catch (e) {
    console.error(`✖  agent.trade-manager: poll error — ${e.message}`);
    return { ok: false, error: e.message };
  } finally {
    _polling = false;
  }
}

// ── startPoller() / stopPoller() ────────────────────────────────────────────
function startPoller(deps) {
  if (_intervalId) return { started: false, reason: 'already_running' };
  const tick = async () => {
    try {
      if (deps.isMarketOpen && !deps.isMarketOpen()) return;
      await pollOpenTrades(deps);
    } catch (e) { console.error('✖  agent.trade-manager tick:', e.message); }
  };
  _intervalId = setInterval(tick, POLL_INTERVAL_MS);
  console.log(`📊 agent.trade-manager: poller started (every ${POLL_INTERVAL_MS/1000}s)`);
  tick().catch(() => {});
  return { started: true, intervalMs: POLL_INTERVAL_MS };
}

function stopPoller() {
  if (_intervalId) { clearInterval(_intervalId); _intervalId = null; return { stopped: true }; }
  return { stopped: false };
}

function getStatus() {
  return {
    polling: _polling,
    running: Boolean(_intervalId),
    intervalMs: POLL_INTERVAL_MS,
    lastTick: _lastTick,
    tickCount: _tickCount,
  };
}

module.exports = {
  pollOpenTrades,
  startPoller,
  stopPoller,
  getStatus,
  _internal: { pnlFor, evaluateOne, maybeTrailSL, exitTrade },
};
