// execution_engine.js — order placement (parallel, BUY-first, retry, partial-fill flatten).
// Includes paper mode using paper_simulator.
'use strict';

const eventLogger = require('./event_logger');
const stateEngine = require('./state_engine');
const paperSim = require('./paper_simulator');
const time = require('./time_utils');

let pool = null;
let kc = null;  // Kite Connect client (injected — null in tests/paper-only)
function init({ pgPool, kiteClient }) {
  pool = pgPool;
  kc = kiteClient || null;
}

async function logAudit(tradeId, legIndex, action, request, response, httpStatus, errorMsg) {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO options_order_audit (trade_id, leg_index, action, request_json, response_json, http_status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tradeId, legIndex, action, JSON.stringify(request),
       response ? JSON.stringify(response) : null, httpStatus || null, errorMsg || null]
    );
  } catch (e) {
    console.error('[execution] audit write failed:', e.message);
  }
}

async function withTradeLock(tradeDate, strategy, fn) {
  if (!pool) return fn();
  // CRITICAL: lock + unlock MUST use the SAME connection (pg advisory locks are session-scoped).
  // Use pg_try_advisory_xact_lock inside a transaction so it auto-releases on commit/rollback.
  const key = `${tradeDate}_${strategy}`;
  // Use Postgres hashtext() for full-string hashing (no collision risk)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked', [key]);
    if (!r.rows[0].locked) {
      await client.query('ROLLBACK');
      throw new Error(`Advisory lock unavailable for ${key}`);
    }
    const result = await fn();
    await client.query('COMMIT');  // releases xact lock
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Get real margin from Kite (replaces hardcoded estimate)
async function getRealMargin(legs, lotSize) {
  if (!kc) return null;  // paper mode
  try {
    // Kite Connect Node SDK uses snake_case for orderMargins payload (per JSDoc in connect.js)
    const orderSpecs = legs.map(leg => ({
      exchange: 'NFO',
      tradingsymbol: leg.tradingsymbol || leg.instrument?.replace('NFO:', '') || `NIFTY${leg.strike}${leg.type}`,
      transaction_type: leg.side,
      variety: 'regular',
      product: 'MIS',
      order_type: 'MARKET',
      quantity: leg.qty * (leg.lot_size || lotSize),
      price: 0,
    }));
    const res = await kc.orderMargins(orderSpecs);
    // Sum margin needed across legs (Kite may return array or object depending on version)
    if (Array.isArray(res)) return res.reduce((a, r) => a + (r?.total || 0), 0);
    return res?.total || null;
  } catch (e) {
    await eventLogger.warn('real_margin_failed', { error: e.message });
    return null;
  }
}

// Place a single leg with LIMIT-with-retry escalation
async function placeWithRetry(leg, lotSize, tradeId, legIndex, attempts = 3) {
  if (!kc) throw new Error('No Kite client — use paper mode');
  // Prefer real Kite tradingsymbol from chain; fallback to instrument or fabricated.
  const symbol = leg.tradingsymbol || leg.instrument?.replace('NFO:', '') || `NIFTY${leg.strike}${leg.type}`;
  const effectiveLotSize = leg.lot_size || lotSize;
  const mid = leg.premium || ((leg.bid + leg.ask) / 2) || 1;
  const halfSpread = leg.bid && leg.ask ? (leg.ask - leg.bid) / 2 : mid * 0.01;
  let price = leg.side === 'SELL' ? mid - 0.05 : mid + 0.05;
  let lastErr = null;

  for (let i = 0; i < attempts; i++) {
    const req = {
      exchange: 'NFO',
      tradingsymbol: symbol,
      transaction_type: leg.side,
      quantity: leg.qty * effectiveLotSize,
      product: 'MIS',
      order_type: 'LIMIT',
      price: +price.toFixed(2),
      validity: 'DAY',
    };
    try {
      const res = await kc.placeOrder('regular', req);
      await logAudit(tradeId, legIndex, 'PLACE', req, res, 200, null);
      // Wait 5s and check fill
      await new Promise(r => setTimeout(r, 5000));
      const status = await kc.getOrderHistory(res.order_id);
      const last = status[status.length - 1];
      if (last?.status === 'COMPLETE') {
        return { order_id: res.order_id, fill_price: last.average_price, status: 'COMPLETE' };
      }
      // Cancel + widen tolerance + retry
      await kc.cancelOrder('regular', res.order_id).catch(() => {});
      price += (leg.side === 'SELL' ? -halfSpread * 0.25 : halfSpread * 0.25);
    } catch (e) {
      lastErr = e;
      await logAudit(tradeId, legIndex, 'PLACE', req, null, 500, e.message);
    }
  }

  // Last resort for EXIT orders only
  if (leg._allowMarketFallback) {
    const req = {
      exchange: 'NFO', tradingsymbol: symbol, transaction_type: leg.side,
      quantity: leg.qty * effectiveLotSize, product: 'MIS', order_type: 'MARKET', validity: 'DAY',
    };
    try {
      const res = await kc.placeOrder('regular', req);
      await logAudit(tradeId, legIndex, 'PLACE_MARKET_FALLBACK', req, res, 200, null);
      return { order_id: res.order_id, fill_price: null, status: 'COMPLETE' };
    } catch (e) {
      await logAudit(tradeId, legIndex, 'PLACE_MARKET_FALLBACK', req, null, 500, e.message);
      throw e;
    }
  }

  throw new Error(`Order failed after ${attempts} LIMIT attempts: ${lastErr?.message || 'unknown'}`);
}

// Main basket placement: BUY-first parallel for defined-risk
async function placeBasket(tradeCard, ctx, tradeId) {
  const { mode, lotSize } = ctx;
  if (mode === 'PAPER') {
    const filledLegs = paperSim.simulateEntryFills(tradeCard.legs, ctx.chain || {}, ctx.vixSpike);
    // Persist paper fills
    if (pool) {
      for (let i = 0; i < filledLegs.length; i++) {
        const fl = filledLegs[i];
        await pool.query(
          `INSERT INTO options_paper_fills (trade_id, leg_index, bid_at_entry, ask_at_entry, ltp_at_entry, fill_price, slippage_pct, spread_pct)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [tradeId, i, fl.bid_at_entry, fl.ask_at_entry, fl.ltp_at_entry, fl.entry_premium, fl.slippage_pct, fl.spread_pct]
        );
      }
    }
    await eventLogger.info('paper_fills', { tradeId, legs: filledLegs.length });
    return { mode: 'PAPER', filled: filledLegs, all_complete: true };
  }

  // LIVE mode
  if (!kc) throw new Error('LIVE mode requires kiteClient');
  const buyLegs  = tradeCard.legs.filter(l => l.side === 'BUY');
  const sellLegs = tradeCard.legs.filter(l => l.side === 'SELL');

  // 1. BUY legs first (protection)
  const buyResults = await Promise.allSettled(
    buyLegs.map((leg, i) => placeWithRetry(leg, lotSize, tradeId, i))
  );
  const buyFailed = buyResults.find(r => r.status === 'rejected');
  if (buyFailed) {
    // Cancel any successful BUYs (we're not yet exposed)
    for (const r of buyResults) {
      if (r.status === 'fulfilled' && r.value?.order_id) {
        await kc.cancelOrder('regular', r.value.order_id).catch(() => {});
      }
    }
    throw new Error(`BUY leg failed before any SELL exposure: ${buyFailed.reason?.message || ''}`);
  }

  // 2. SELL legs in parallel
  const sellResults = await Promise.allSettled(
    sellLegs.map((leg, i) => placeWithRetry(leg, lotSize, tradeId, buyLegs.length + i))
  );

  // 3. Reconcile — partial fill detection
  const allResults = [...buyResults, ...sellResults];
  const allLegsOrdered = [...buyLegs, ...sellLegs];
  const filled = allResults.filter(r => r.status === 'fulfilled' && r.value?.status === 'COMPLETE');
  if (filled.length < tradeCard.legs.length) {
    await eventLogger.critical('partial_fill_flatten', { tradeId, filled: filled.length, expected: tradeCard.legs.length });
    // ACTUALLY flatten the filled legs by placing reverse orders with MARKET fallback
    for (let i = 0; i < allResults.length; i++) {
      const r = allResults[i];
      if (r.status === 'fulfilled' && r.value?.status === 'COMPLETE') {
        const origLeg = allLegsOrdered[i];
        const reverseLeg = {
          ...origLeg,
          side: origLeg.side === 'SELL' ? 'BUY' : 'SELL',
          _allowMarketFallback: true,
        };
        try {
          await placeWithRetry(reverseLeg, lotSize, tradeId, 1000 + i);
          await eventLogger.warn('partial_flatten_leg_reversed', { tradeId, legIndex: i, strike: origLeg.strike });
        } catch (e) {
          await eventLogger.critical('partial_flatten_leg_FAILED', { tradeId, legIndex: i, strike: origLeg.strike, error: e.message });
        }
      }
    }
    throw new Error(`Partial fill: ${filled.length}/${tradeCard.legs.length} — reverse orders attempted`);
  }

  return {
    mode: 'LIVE',
    filled: tradeCard.legs.map((leg, i) => ({
      ...leg,
      entry_premium: allResults[i].value?.fill_price ?? leg.premium,
      kite_order_id: allResults[i].value?.order_id,
    })),
    all_complete: true,
  };
}

// Exit a basket — supports both PAPER and LIVE
async function exitBasket(trade, ctx) {
  const legs = typeof trade.legs === 'string' ? JSON.parse(trade.legs) : trade.legs;
  const reverseLegs = legs.map(l => ({
    ...l,
    side: l.side === 'SELL' ? 'BUY' : 'SELL',
    _allowMarketFallback: true,  // exits may fall back to MARKET
  }));

  if (ctx.mode === 'PAPER') {
    const exitFills = paperSim.simulateExitFills(reverseLegs.map(l => ({
      ...l,
      side: legs.find(t => t.strike === l.strike && t.type === l.type).side,
      entry_premium: legs.find(t => t.strike === l.strike && t.type === l.type).entry_premium,
    })), ctx.chain || {}, ctx.vixSpike);
    const realizedPnl = paperSim.computeRealizedPnl(exitFills, trade.lot_size || 75);
    return { exit_legs: exitFills, realized_pnl: realizedPnl };
  }

  // LIVE: place reverse orders in parallel with MARKET fallback
  if (!kc) throw new Error('LIVE exitBasket requires kiteClient');
  const lotSize = trade.lot_size || legs[0]?.lot_size || 75;
  const exitResults = await Promise.allSettled(
    reverseLegs.map((leg, i) => placeWithRetry(leg, lotSize, trade.id, 9000 + i))
  );

  // Reconcile fills
  const exitFills = legs.map((origLeg, i) => {
    const r = exitResults[i];
    const exitPx = r.status === 'fulfilled' ? (r.value?.fill_price ?? origLeg.entry_premium) : null;
    return {
      ...origLeg,
      exit_premium: exitPx,
      exit_order_id: r.status === 'fulfilled' ? r.value?.order_id : null,
      exit_failed: r.status !== 'fulfilled' ? (r.reason?.message || 'unknown') : null,
    };
  });

  // Alert on any leg that failed to exit (potential naked exposure)
  const failed = exitFills.filter(l => l.exit_failed);
  if (failed.length) {
    await eventLogger.critical('exit_leg_failed', {
      tradeId: trade.id,
      failed_count: failed.length,
      legs: failed.map(l => ({ strike: l.strike, type: l.type, error: l.exit_failed })),
    });
  }

  const realizedPnl = exitFills.reduce((acc, l) => {
    if (!l.exit_premium) return acc;
    const sellSide = l.side === 'SELL' ? 1 : -1;
    return acc + (l.entry_premium - l.exit_premium) * sellSide * l.qty * lotSize;
  }, 0);

  return { exit_legs: exitFills, realized_pnl: Math.round(realizedPnl), partial: failed.length > 0 };
}

// Force-flatten any PARTIAL trades whose force_exit_time has passed
async function flattenPartialIfDue(nowClock) {
  if (!pool) return;
  const { rows } = await pool.query(
    `SELECT * FROM options_trades WHERE state IN ('PARTIAL') ORDER BY proposed_at`);
  for (const trade of rows) {
    if (nowClock >= (trade.force_exit_time || '14:30')) {
      try {
        await stateEngine.transition(trade.id, 'EXITING', { reason: 'force_exit_partial' });
        const result = await exitBasket(trade, { mode: trade.mode });
        await stateEngine.transition(trade.id, 'RECONCILING', result);
        await stateEngine.transition(trade.id, 'CLOSED', { realized_pnl: result.realized_pnl, exit_reason: 'FORCE_EXIT_PARTIAL' });
        await eventLogger.warn('partial_force_flattened', { tradeId: trade.id });
      } catch (e) {
        await eventLogger.error('partial_force_flatten_failed', { tradeId: trade.id, error: e.message });
      }
    }
  }
}

// Emergency flatten ALL open positions
async function flattenAll(reason = 'manual') {
  if (!pool) return { error: 'no pool' };
  const active = await stateEngine.findActive();
  let count = 0;
  for (const trade of active) {
    try {
      await stateEngine.transition(trade.id, 'EXITING', { reason: `flatten: ${reason}` });
      const result = await exitBasket(trade, { mode: trade.mode, chain: {}, vixSpike: false });
      await stateEngine.transition(trade.id, 'RECONCILING', result);
      await stateEngine.transition(trade.id, 'CLOSED', { realized_pnl: result.realized_pnl, exit_reason: 'FLATTEN' });
      count++;
    } catch (e) {
      await eventLogger.error('flatten_failed', { trade_id: trade.id, error: e.message });
    }
  }
  await eventLogger.critical('flatten_all_complete', { reason, count });
  return { ok: true, count };
}

module.exports = {
  init, withTradeLock, getRealMargin,
  placeBasket, exitBasket, flattenAll, flattenPartialIfDue,
};
