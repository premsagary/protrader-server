/**
 * test/agent-auto-schedule.test.js
 *
 * Hermetic unit tests for the auto-schedule state machine in agent-config.js.
 * The full cron firing + DB persistence path is tested via integration
 * manually; this file just proves the state transitions and validation are
 * correct, since those are the easy places to introduce bugs.
 *
 * Run with:
 *     node test/agent-auto-schedule.test.js
 */

'use strict';

const assert = require('assert');

const cfg = require('../agent/agent-config');

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

// Helpers to reset state between tests — agent-config has module-level
// mutable state so we explicitly reset to a known baseline.
function resetAuto() {
  cfg.setAutoSchedule({ enabled: false, targetMode: 'paper' });
}

console.log('▶ auto-schedule state machine');

tcase('default auto-schedule is disabled with paper target', () => {
  resetAuto();
  const s = cfg.getAutoSchedule();
  assert.strictEqual(s.enabled, false);
  assert.strictEqual(s.targetMode, 'paper');
});

tcase('enable + set target paper', () => {
  resetAuto();
  const r = cfg.setAutoSchedule({ enabled: true, targetMode: 'paper' });
  assert.strictEqual(r.current.enabled, true);
  assert.strictEqual(r.current.targetMode, 'paper');
  assert.strictEqual(cfg.getAutoSchedule().enabled, true);
});

tcase('legacy dry_run targetMode coerces to paper', () => {
  // dry_run was removed 2026-04-17 but may still live in persisted config
  resetAuto();
  cfg.setAutoSchedule({ enabled: true, targetMode: 'dry_run' });
  assert.strictEqual(cfg.getAutoSchedule().targetMode, 'paper');
});

tcase('invalid target (off) rejected', () => {
  resetAuto();
  assert.throws(() => cfg.setAutoSchedule({ enabled: true, targetMode: 'off' }),
    /targetMode must be one of/);
  // Previous state untouched
  assert.strictEqual(cfg.getAutoSchedule().targetMode, 'paper');
});

tcase('invalid target (live) rejected — Phase 3 not unlocked', () => {
  resetAuto();
  assert.throws(() => cfg.setAutoSchedule({ enabled: true, targetMode: 'live' }),
    /targetMode must be one of/);
});

tcase('invalid target (gibberish) rejected', () => {
  resetAuto();
  assert.throws(() => cfg.setAutoSchedule({ enabled: true, targetMode: 'hax0r' }));
});

tcase('setAutoSchedule without targetMode preserves previous target', () => {
  resetAuto();
  cfg.setAutoSchedule({ enabled: true, targetMode: 'paper' });
  cfg.setAutoSchedule({ enabled: false });  // no targetMode
  assert.strictEqual(cfg.getAutoSchedule().targetMode, 'paper');
  assert.strictEqual(cfg.getAutoSchedule().enabled, false);
});

tcase('listAutoTargets returns paper only (dry_run removed)', () => {
  const t = cfg.listAutoTargets();
  assert.deepStrictEqual(t, ['paper']);
});

tcase('enable=truthy coerces to bool', () => {
  resetAuto();
  cfg.setAutoSchedule({ enabled: 1, targetMode: 'paper' });
  assert.strictEqual(cfg.getAutoSchedule().enabled, true);
  cfg.setAutoSchedule({ enabled: 0 });
  assert.strictEqual(cfg.getAutoSchedule().enabled, false);
});

tcase('previous snapshot returned correctly', () => {
  resetAuto();
  cfg.setAutoSchedule({ enabled: true, targetMode: 'paper' });
  const r = cfg.setAutoSchedule({ enabled: false, targetMode: 'paper' });
  assert.strictEqual(r.prev.enabled, true);
  assert.strictEqual(r.prev.targetMode, 'paper');
  assert.strictEqual(r.current.enabled, false);
  assert.strictEqual(r.current.targetMode, 'paper');
});

runAll();
