/**
 * test/agent-paper-fill.test.js
 *
 * Hermetic unit tests for the Phase 2 paper-fill engine + trade-manager.
 * No DB, no Kite. Uses a minimal in-memory pool stub so the audit layer
 * has something to write into. Run with:
 *
 *     node test/agent-paper-fill.test.js
 *
 * Prints pass/fail per assertion. Exit code is non-zero on any failure.
 */

'use strict';

const assert = require('assert');

// ── In-memory pg-pool mock ──────────────────────────────────────────────────
// Handles the exact SQL shapes the audit writers use; everything else is a
// no-op. Keeps state in a Map so we can verify what got written.
function mockPool() {
  const state = { decisions: [], trades: [], events: [], _seqD: 0, _seqT: 0 };
  return {
    state,
    async query(sql, params = []) {
      sql = sql.trim();
      // Tables-exist check — always say yes
      if (/information_schema\.tables/i.test(sql)) return { rows: [{ present: true }] };

      // INSERT INTO agent_decisions
      if (/^INSERT INTO agent_decisions/i.test(sql)) {
        state._seqD++;
        state.decisions.push({ id: state._seqD, params });
        return { rows: [{ id: state._seqD }] };
      }

      // INSERT INTO agent_trades
      if (/^INSERT INTO agent_trades/i.test(sql)) {
        state._seqT++;
        const [agent_decision_id, run_id, agent_mode, sym, side,
               entry_order_id, sl_order_id, target_order_id,
               planned_entry, planned_stop_loss, planned_target, quantity] = params;
        state.trades.push({
          id: state._seqT,
          agent_decision_id, run_id, agent_mode, sym, side,
          entry_order_id, sl_order_id, target_order_id,
          planned_entry: Number(planned_entry),
          planned_stop_loss: Number(planned_stop_loss),
          planned_target: Number(planned_target),
          quantity: Number(quantity),
          fill_price: null, filled_at: null,
          exit_at: null, exit_price: null, exit_reason: null,
          pnl_rupees: null, pnl_pct: null,
        });
        return { rows: [{ id: state._seqT }] };
      }

      // UPDATE agent_trades SET filled_at ... (paper fill)
      if (/^UPDATE agent_trades\s+SET filled_at/i.test(sql)) {
        const [fill_price, id] = params;
        const t = state.trades.find(x => x.id === id);
        if (t) { t.fill_price = Number(fill_price); t.filled_at = new Date(); }
        return { rowCount: 1 };
      }

      // UPDATE agent_trades SET exit_at ... (trade exit)
      if (/^UPDATE agent_trades\s+SET exit_at/i.test(sql)) {
        const [exit_price, exit_reason, pnl_rupees, pnl_pct, id] = params;
        const t = state.trades.find(x => x.id === id);
        if (t && !t.exit_at) {
          t.exit_at = new Date();
          t.exit_price = Number(exit_price);
          t.exit_reason = exit_reason;
          t.pnl_rupees = Number(pnl_rupees);
          t.pnl_pct = Number(pnl_pct);
        }
        return { rowCount: 1 };
      }

      // UPDATE agent_trades SET planned_stop_loss ... (trail)
      if (/^UPDATE agent_trades\s+SET planned_stop_loss/i.test(sql)) {
        const [new_sl, id] = params;
        const t = state.trades.find(x => x.id === id);
        if (t) t.planned_stop_loss = Number(new_sl);
        return { rowCount: 1 };
      }

      // INSERT INTO agent_trade_events
      if (/^INSERT INTO agent_trade_events/i.test(sql)) {
        const [agent_trade_id, run_id, event_type, payload] = params;
        state.events.push({ agent_trade_id, run_id, event_type, payload });
        return { rowCount: 1 };
      }

      // SELECT open paper trades — used by pollOpenTrades
      if (/FROM agent_trades\s+WHERE exit_at IS NULL AND agent_mode = 'paper'/i.test(sql)) {
        return { rows: state.trades.filter(t => t.exit_at === null && t.agent_mode === 'paper') };
      }

      return { rows: [] };
    },
  };
}

// ── Test runner (async-serial) ──────────────────────────────────────────────
let passed = 0, failed = 0;
const _queue = [];
function tcase(name, fn) {
  _queue.push(async () => {
    try {
      const r = fn();
      if (r && typeof r.then === 'function') await r;
      passed++; console.log(`  ✓ ${name}`);
    } catch (e) {
      failed++; console.log(`  ✗ ${name}: ${e.message}`);
    }
  });
}
async function runAll() {
  for (const fn of _queue) await fn();
  console.log(`\n${passed + failed} tests · ${passed} passed · ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

// ── Load modules AFTER path set up; `off` default is fine for unit tests ──
const paper = require('../agent/paper-fill-engine');
const tradeManager = require('../agent/trade-manager');
const { _internal: paperInt } = paper;
const { _internal: tmInt } = tradeManager;

// ────────────────────────────────────────────────────────────────────────────
// Group 1 — paper-fill-engine
// ────────────────────────────────────────────────────────────────────────────
console.log('\n▶ Group 1 — paper-fill-engine');

tcase('shouldTrigger: BUY above trigger → true', () => {
  assert.strictEqual(paperInt.shouldTrigger({ side: 'BUY', trigger_price: 100 }, 100.5), true);
});
tcase('shouldTrigger: BUY below trigger → false', () => {
  assert.strictEqual(paperInt.shouldTrigger({ side: 'BUY', trigger_price: 100 }, 99.5), false);
});
tcase('shouldTrigger: SELL below trigger → true', () => {
  assert.strictEqual(paperInt.shouldTrigger({ side: 'SELL', trigger_price: 100 }, 99.5), true);
});
tcase('shouldTrigger: zero/negative/NaN → false', () => {
  assert.strictEqual(paperInt.shouldTrigger({ side: 'BUY', trigger_price: 100 }, 0), false);
  assert.strictEqual(paperInt.shouldTrigger({ side: 'BUY', trigger_price: 100 }, NaN), false);
  assert.strictEqual(paperInt.shouldTrigger({ side: 'BUY', trigger_price: 0 }, 100), false);
});

tcase('computeFillPrice: BUY slippage is +5 bps', () => {
  const p = { side: 'BUY', trigger_price: 1000 };
  assert.strictEqual(paperInt.computeFillPrice(p), 1000.5);
});
tcase('computeFillPrice: SELL slippage is -5 bps', () => {
  const p = { side: 'SELL', trigger_price: 1000 };
  assert.strictEqual(paperInt.computeFillPrice(p), 999.5);
});

tcase('arm + evaluateArmed: trigger hit → writes trade + clears armed', async () => {
  paperInt._armed.clear();
  const pool = mockPool();
  const proposal = {
    sym: 'HDFCBANK', sector: 'Banking', side: 'BUY',
    entry_type: 'SL-M', trigger_price: 1600.80, entry_price: 1600,
    quantity: 10, stop_loss: 1585, target: 1625, rr_ratio: 1.5,
    confidence_score: 72, day_trade_score: 72, best_setup: 'BREAKOUT',
  };
  paper.arm(99, proposal, 'run-A');
  assert.strictEqual(paper.armedCount(), 1);

  const r = await paper.evaluateArmed({
    pool,
    getPrices: async () => ({ HDFCBANK: 1601.2 }),
    runId: 'run-A',
  });

  assert.strictEqual(r.filled.length, 1, 'should have filled one');
  assert.strictEqual(paper.armedCount(), 0, 'armed should be cleared');
  assert.strictEqual(pool.state.trades.length, 1, 'one trade row written');
  const t = pool.state.trades[0];
  assert.strictEqual(t.sym, 'HDFCBANK');
  assert.strictEqual(t.agent_mode, 'paper');
  // 1600.80 + 5 bps = 1600.80 + 0.8004 = 1601.60 (2dp)
  assert.strictEqual(t.fill_price, 1601.6, 'fill price = trigger + 5bps slippage');
});

tcase('arm + evaluateArmed: trigger not hit → armed persists', async () => {
  paperInt._armed.clear();
  const pool = mockPool();
  paper.arm(100, {
    sym: 'TCS', sector: 'IT', side: 'BUY',
    trigger_price: 3800, entry_price: 3798, quantity: 5,
    stop_loss: 3770, target: 3840, rr_ratio: 1.5,
  }, 'run-B');

  const r = await paper.evaluateArmed({
    pool,
    getPrices: async () => ({ TCS: 3795 }),   // below trigger
    runId: 'run-B',
  });

  assert.strictEqual(r.filled.length, 0);
  assert.strictEqual(r.armed, 1);
  assert.strictEqual(pool.state.trades.length, 0);
});

tcase('snapshotArmed returns safe structure', () => {
  paperInt._armed.clear();
  paper.arm(1, { sym: 'X', side: 'BUY', trigger_price: 100, stop_loss: 95, target: 110, quantity: 2 }, 'r');
  const snap = paper.snapshotArmed();
  assert.strictEqual(snap.length, 1);
  assert.strictEqual(snap[0].sym, 'X');
  assert.strictEqual(typeof snap[0].ageMins, 'number');
  paper.clearArmed();
});

// ────────────────────────────────────────────────────────────────────────────
// Group 2 — trade-manager: pnlFor
// ────────────────────────────────────────────────────────────────────────────
console.log('\n▶ Group 2 — trade-manager PnL math');

tcase('pnlFor: BUY winner', () => {
  const r = tmInt.pnlFor({ side: 'BUY', fill_price: 100, quantity: 10 }, 105);
  assert.strictEqual(r.pnlRupees, 50);
  assert.strictEqual(r.pnlPct, 5);
});
tcase('pnlFor: BUY loser', () => {
  const r = tmInt.pnlFor({ side: 'BUY', fill_price: 100, quantity: 10 }, 98);
  assert.strictEqual(r.pnlRupees, -20);
  assert.strictEqual(r.pnlPct, -2);
});
tcase('pnlFor: SELL winner (short)', () => {
  const r = tmInt.pnlFor({ side: 'SELL', fill_price: 100, quantity: 10 }, 95);
  assert.strictEqual(r.pnlRupees, 50);
  assert.strictEqual(r.pnlPct, 5);
});
tcase('pnlFor: fallback to planned_entry when fill_price missing', () => {
  const r = tmInt.pnlFor({ side: 'BUY', planned_entry: 100, quantity: 10 }, 103);
  assert.strictEqual(r.pnlRupees, 30);
});

// ────────────────────────────────────────────────────────────────────────────
// Group 3 — trade-manager: evaluateOne exit ordering
// ────────────────────────────────────────────────────────────────────────────
console.log('\n▶ Group 3 — trade-manager exit logic');

function mkTrade(over = {}) {
  return Object.assign({
    id: 1, agent_mode: 'paper', sym: 'HDFCBANK', side: 'BUY',
    fill_price: 1600, planned_entry: 1600,
    planned_stop_loss: 1585, planned_target: 1640, quantity: 10,
    filled_at: new Date(),
    exit_at: null, exit_price: null, exit_reason: null,
    pnl_rupees: null, pnl_pct: null,
  }, over);
}

// All trade-manager tests pin nowMins to 180 (mid-session) so time-exit
// doesn't fire when running in a sandbox outside IST market hours.
const MID_SESSION = { nowMins: 180 };

tcase('SL hit → exit at SL price (conservative)', async () => {
  const pool = mockPool();
  pool.state.trades.push(mkTrade());
  const r = await tmInt.evaluateOne(pool, pool.state.trades[0], 1584.5, { runId: 't', ...MID_SESSION });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.exitReason, 'SL_HIT');
  assert.strictEqual(pool.state.trades[0].exit_price, 1585);
  assert.strictEqual(pool.state.trades[0].pnl_rupees, -150);
});
tcase('Target hit → exit at target price', async () => {
  const pool = mockPool();
  pool.state.trades.push(mkTrade());
  const r = await tmInt.evaluateOne(pool, pool.state.trades[0], 1641, { runId: 't', ...MID_SESSION });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.exitReason, 'TARGET_HIT');
  assert.strictEqual(pool.state.trades[0].exit_price, 1640);
  assert.strictEqual(pool.state.trades[0].pnl_rupees, 400);
});
tcase('Price exactly at SL → exits (<=)', async () => {
  const pool = mockPool();
  pool.state.trades.push(mkTrade());
  const r = await tmInt.evaluateOne(pool, pool.state.trades[0], 1585, { runId: 't', ...MID_SESSION });
  assert.strictEqual(r.exitReason, 'SL_HIT');
});
tcase('Price between SL and TGT → no exit, no trail yet', async () => {
  const pool = mockPool();
  pool.state.trades.push(mkTrade());
  const r = await tmInt.evaluateOne(pool, pool.state.trades[0], 1605, { runId: 't', ...MID_SESSION });
  assert.strictEqual(r.moved, false);
  assert.strictEqual(pool.state.trades[0].exit_at, null);
});
tcase('Price at breakeven (+1R) → trails SL to entry', async () => {
  const pool = mockPool();
  pool.state.trades.push(mkTrade());
  const r = await tmInt.evaluateOne(pool, pool.state.trades[0], 1615, { runId: 't', ...MID_SESSION });
  assert.strictEqual(r.moved, true);
  assert.strictEqual(r.newSL, 1600, 'SL should move to entry (breakeven)');
  assert.strictEqual(r.label, 'TRAIL_BREAKEVEN');
});
tcase('Price at +2R with ATR → trails SL by 0.75×ATR', async () => {
  const pool = mockPool();
  pool.state.trades.push(mkTrade());
  // initial risk 15, +2R = 1630. ATR% = 1 → atrAbs at 1630 = 16.30
  // newSL = 1630 - 0.75*16.30 = 1617.78
  const r = await tmInt.evaluateOne(pool, pool.state.trades[0], 1630, {
    runId: 't', ...MID_SESSION, getAtrPct: () => 1.0,
  });
  assert.strictEqual(r.moved, true);
  assert.strictEqual(r.label, 'TRAIL_ATR');
  assert.ok(r.newSL > 1600 && r.newSL < 1630, `newSL=${r.newSL} should be between entry+buffer and price`);
});
tcase('Trail never moves SL backwards', async () => {
  const pool = mockPool();
  pool.state.trades.push(mkTrade({ planned_stop_loss: 1615 }));
  const r = await tmInt.evaluateOne(pool, pool.state.trades[0], 1615.1, { runId: 't', ...MID_SESSION });
  assert.strictEqual(r.moved, false);
  assert.strictEqual(pool.state.trades[0].planned_stop_loss, 1615);
});
tcase('Time-exit fires at or after cutoff mins', async () => {
  const pool = mockPool();
  pool.state.trades.push(mkTrade());
  const r = await tmInt.evaluateOne(pool, pool.state.trades[0], 1605, { runId: 't', nowMins: 360 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.exitReason, 'TIME_EXIT');
  assert.strictEqual(pool.state.trades[0].exit_price, 1605);
});

// ────────────────────────────────────────────────────────────────────────────
runAll();
