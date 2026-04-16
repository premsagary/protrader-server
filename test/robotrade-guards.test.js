/**
 * test/robotrade-guards.test.js
 *
 * Hermetic unit tests for the four new Stocks RoboTrade guards:
 *   1. checkDailyLossCap   — hard stop on today's realized loss
 *   2. checkTradeCountCap  — hard cap on entries per calendar day (over-trading)
 *   3. shouldTimeExit      — position-age exit (pure function, no DB)
 *   4. loadHwmFromDb / persistHwm — trailing stop survives restarts
 *
 * Run: node test/robotrade-guards.test.js
 * Exits non-zero on any failure.
 */

'use strict';

const assert = require('assert');
const g = require('../robotrade-guards');

// ── Minimal pg-pool mock — responds to the exact SQL shapes the guards use ──
function mockPool(overrides = {}) {
  const state = {
    closedPnlToday: overrides.closedPnlToday != null ? overrides.closedPnlToday : 0,
    tradesOpenedToday: overrides.tradesOpenedToday != null ? overrides.tradesOpenedToday : 0,
    openTrades: overrides.openTrades || [],
    hwmUpdates: [],
  };
  return {
    state,
    async query(sql, params = []) {
      // Daily PnL query
      if (/FROM paper_trades\s+WHERE status = 'CLOSED'[\s\S]*exit_time::date = CURRENT_DATE/i.test(sql)) {
        return { rows: [{ realized: state.closedPnlToday }] };
      }
      // Trades opened today
      if (/FROM paper_trades\s+WHERE entry_time::date = CURRENT_DATE/i.test(sql)) {
        return { rows: [{ n: state.tradesOpenedToday }] };
      }
      // HWM load
      if (/FROM paper_trades\s+WHERE status = 'OPEN' AND hwm_price IS NOT NULL/i.test(sql)) {
        return { rows: state.openTrades.filter(t => t.hwm_price != null) };
      }
      // HWM update
      if (/UPDATE paper_trades SET hwm_price/i.test(sql)) {
        const [hwm, id] = params;
        state.hwmUpdates.push({ id, hwm: Number(hwm) });
        return { rowCount: 1 };
      }
      return { rows: [] };
    },
  };
}

// ── test runner ─────────────────────────────────────────────────────────────
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

// ── Group 1: daily loss cap ─────────────────────────────────────────────────
console.log('\n▶ Group 1 — daily loss cap');

tcase('no losses → not tripped', async () => {
  const pool = mockPool({ closedPnlToday: 0 });
  const r = await g.checkDailyLossCap(pool, 100000, { DAILY_LOSS_CAP_PCT: 0.02 });
  assert.strictEqual(r.tripped, false);
  assert.strictEqual(r.realizedToday, 0);
  assert.strictEqual(r.cap, -2000);
});

tcase('loss below cap → not tripped', async () => {
  const pool = mockPool({ closedPnlToday: -1500 });
  const r = await g.checkDailyLossCap(pool, 100000, { DAILY_LOSS_CAP_PCT: 0.02 });
  assert.strictEqual(r.tripped, false);
  assert.strictEqual(r.realizedToday, -1500);
});

tcase('loss equal to cap → tripped', async () => {
  const pool = mockPool({ closedPnlToday: -2000 });
  const r = await g.checkDailyLossCap(pool, 100000, { DAILY_LOSS_CAP_PCT: 0.02 });
  assert.strictEqual(r.tripped, true);
  assert.ok(r.reason.includes('daily_loss_cap_hit'));
});

tcase('loss past cap → tripped', async () => {
  const pool = mockPool({ closedPnlToday: -2500 });
  const r = await g.checkDailyLossCap(pool, 100000, { DAILY_LOSS_CAP_PCT: 0.02 });
  assert.strictEqual(r.tripped, true);
});

tcase('profit → never tripped, regardless of size', async () => {
  const pool = mockPool({ closedPnlToday: 5000 });
  const r = await g.checkDailyLossCap(pool, 100000, { DAILY_LOSS_CAP_PCT: 0.02 });
  assert.strictEqual(r.tripped, false);
});

tcase('missing equity → not tripped (safe fallback)', async () => {
  const pool = mockPool({ closedPnlToday: -5000 });
  const r = await g.checkDailyLossCap(pool, 0, { DAILY_LOSS_CAP_PCT: 0.02 });
  assert.strictEqual(r.tripped, false);
  assert.strictEqual(r.reason, 'missing_inputs');
});

tcase('disabled → not tripped', async () => {
  const pool = mockPool({ closedPnlToday: -10000 });
  const r = await g.checkDailyLossCap(pool, 100000, { DAILY_LOSS_CAP_PCT: 0.02, ENABLED: false });
  assert.strictEqual(r.tripped, false);
  assert.strictEqual(r.reason, 'disabled');
});

// ── Group 2: trade count cap ────────────────────────────────────────────────
console.log('\n▶ Group 2 — trade count cap (over-trading)');

tcase('zero trades → not tripped', async () => {
  const pool = mockPool({ tradesOpenedToday: 0 });
  const r = await g.checkTradeCountCap(pool, { MAX_TRADES_PER_DAY: 8 });
  assert.strictEqual(r.tripped, false);
  assert.strictEqual(r.countToday, 0);
});

tcase('under cap → not tripped', async () => {
  const pool = mockPool({ tradesOpenedToday: 7 });
  const r = await g.checkTradeCountCap(pool, { MAX_TRADES_PER_DAY: 8 });
  assert.strictEqual(r.tripped, false);
});

tcase('at cap → tripped', async () => {
  const pool = mockPool({ tradesOpenedToday: 8 });
  const r = await g.checkTradeCountCap(pool, { MAX_TRADES_PER_DAY: 8 });
  assert.strictEqual(r.tripped, true);
  assert.ok(r.reason.includes('trade_count_cap_hit'));
});

tcase('over cap → tripped', async () => {
  const pool = mockPool({ tradesOpenedToday: 15 });
  const r = await g.checkTradeCountCap(pool, { MAX_TRADES_PER_DAY: 5 });
  assert.strictEqual(r.tripped, true);
  assert.strictEqual(r.countToday, 15);
  assert.strictEqual(r.cap, 5);
});

tcase('invalid cap rejected', async () => {
  const pool = mockPool({ tradesOpenedToday: 100 });
  const r = await g.checkTradeCountCap(pool, { MAX_TRADES_PER_DAY: 0 });
  assert.strictEqual(r.tripped, false);
  assert.strictEqual(r.reason, 'invalid_config');
});

// ── Group 3: time-decay exit ────────────────────────────────────────────────
console.log('\n▶ Group 3 — time-decay exit');

tcase('just opened → no exit', () => {
  const r = g.shouldTimeExit(
    { entry_time: new Date(Date.now() - 30 * 60000), strategy: 'BREAKOUT' },  // 30 min ago
    Date.now(), { MAX_HOLD_HOURS: 6 }
  );
  assert.strictEqual(r.exit, false);
  assert.ok(r.heldHours < 1);
});

tcase('held exactly at limit → exit', () => {
  const r = g.shouldTimeExit(
    { entry_time: new Date(Date.now() - 6 * 3600000), strategy: 'VWAP_RECLAIM' },
    Date.now(), { MAX_HOLD_HOURS: 6 }
  );
  assert.strictEqual(r.exit, true);
  assert.ok(r.reason.startsWith('time_exit_'));
});

tcase('held past limit → exit', () => {
  const r = g.shouldTimeExit(
    { entry_time: new Date(Date.now() - 8 * 3600000), strategy: 'VWAP_RECLAIM' },
    Date.now(), { MAX_HOLD_HOURS: 6 }
  );
  assert.strictEqual(r.exit, true);
});

tcase('per-setup override: BREAKOUT exits at 4h', () => {
  const r = g.shouldTimeExit(
    { entry_time: new Date(Date.now() - 4.5 * 3600000), strategy: 'BREAKOUT' },
    Date.now(),
    { MAX_HOLD_HOURS: 6, MAX_HOLD_HOURS_BY_SETUP: { BREAKOUT: 4 } }
  );
  assert.strictEqual(r.exit, true);
  assert.strictEqual(r.maxHours, 4);
});

tcase('per-setup override: BREAKOUT under 4h → no exit', () => {
  const r = g.shouldTimeExit(
    { entry_time: new Date(Date.now() - 3 * 3600000), strategy: 'BREAKOUT' },
    Date.now(),
    { MAX_HOLD_HOURS: 6, MAX_HOLD_HOURS_BY_SETUP: { BREAKOUT: 4 } }
  );
  assert.strictEqual(r.exit, false);
});

tcase('unknown setup falls back to default', () => {
  const r = g.shouldTimeExit(
    { entry_time: new Date(Date.now() - 5 * 3600000), strategy: 'WEIRD_STRATEGY' },
    Date.now(),
    { MAX_HOLD_HOURS: 6, MAX_HOLD_HOURS_BY_SETUP: { BREAKOUT: 4 } }
  );
  assert.strictEqual(r.exit, false);
  assert.strictEqual(r.maxHours, 6);
});

tcase('missing entry_time → no exit', () => {
  const r = g.shouldTimeExit({ strategy: 'BREAKOUT' }, Date.now());
  assert.strictEqual(r.exit, false);
});

tcase('entry in the future → no exit (clock skew safety)', () => {
  const r = g.shouldTimeExit(
    { entry_time: new Date(Date.now() + 60 * 60000), strategy: 'BREAKOUT' },
    Date.now()
  );
  assert.strictEqual(r.exit, false);
});

tcase('disabled → no exit', () => {
  const r = g.shouldTimeExit(
    { entry_time: new Date(Date.now() - 24 * 3600000), strategy: 'BREAKOUT' },
    Date.now(),
    { ENABLED: false }
  );
  assert.strictEqual(r.exit, false);
});

// ── Group 4: HWM persistence ────────────────────────────────────────────────
console.log('\n▶ Group 4 — HWM persistence');

tcase('loadHwmFromDb with no rows → empty map', async () => {
  const pool = mockPool({ openTrades: [] });
  const r = await g.loadHwmFromDb(pool);
  assert.deepStrictEqual(r, {});
});

tcase('loadHwmFromDb maps both id and symbol keys', async () => {
  const pool = mockPool({ openTrades: [
    { id: 42, symbol: 'HDFCBANK', hwm_price: 1620.5 },
    { id: 43, symbol: 'TCS',      hwm_price: null },   // skipped (null filter)
  ]});
  const r = await g.loadHwmFromDb(pool);
  assert.strictEqual(r['42'], 1620.5);
  assert.strictEqual(r['HDFCBANK'], 1620.5);
  assert.ok(!('TCS' in r));
});

tcase('persistHwm writes update', async () => {
  const pool = mockPool();
  await g.persistHwm(pool, 99, 1625.75);
  assert.strictEqual(pool.state.hwmUpdates.length, 1);
  assert.deepStrictEqual(pool.state.hwmUpdates[0], { id: 99, hwm: 1625.75 });
});

tcase('persistHwm silently ignores invalid inputs', async () => {
  const pool = mockPool();
  await g.persistHwm(pool, null, 1620);
  await g.persistHwm(pool, 1, 0);
  await g.persistHwm(pool, 1, NaN);
  await g.persistHwm(null, 1, 1620);
  assert.strictEqual(pool.state.hwmUpdates.length, 0);
});

runAll();
