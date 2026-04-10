#!/usr/bin/env node
/**
 * Stock Picks v2 — Invariant Test Suite  (plan §14)
 * =====================================================================
 * Three load-bearing invariants that must not regress:
 *
 *   1. FA/TA separation       — scoreV2 depends ONLY on fundamentals.
 *                               Flipping technical signals must NOT change
 *                               scoreV2 or any sub-score. Technicals may
 *                               change timingOverlay.label and timingScore;
 *                               nothing else.
 *
 *   2. Snapshot idempotency   — writeDailySnapshots uses ON CONFLICT DO
 *                               UPDATE; running it twice on the same day
 *                               must not duplicate rows.
 *
 *   3. LLM cap short-circuit  — once the daily LLM budget is exhausted,
 *                               callAIModel must return
 *                               { skipped: true, error: 'llm-cap-exceeded' }
 *                               rather than making a real API call.
 *
 * These invariants are guarded against regression; if they ever fail, the
 * user either stops trusting scoreV2 (#1), pays for duplicate storage /
 * writes (#2), or blows through LLM spend in production (#3).
 *
 * -----------------------------------------------------------------------
 * Running:
 *
 *   1. Start the server with the test hooks enabled:
 *        V2_TEST_HOOKS=1 node kite-server.js
 *
 *   2. In a second shell, with the server up:
 *        node test/v2-invariants.js
 *
 *      Options:
 *        HOST=http://localhost:3001   (default)
 *        SYMBOL=INFY                  (symbol to use for test #1, default TCS)
 *        TOKEN=xxxxxxxx               (session token; required when the
 *                                      server sits behind authMiddleware,
 *                                      e.g. a Railway deploy. Sent as a
 *                                      Bearer header on every request.)
 *
 * Each test is independent; a failure in one does not stop the others.
 * Exit code is 0 if every test passed, 1 otherwise.
 * =====================================================================
 */

const http  = require('http');
const https = require('https');
const { URL } = require('url');

const HOST   = process.env.HOST   || 'http://localhost:3001';
const SYMBOL = (process.env.SYMBOL || 'TCS').toUpperCase();
const TOKEN  = process.env.TOKEN  || '';

let passed = 0;
let failed = 0;
const failures = [];

// ── Lightweight HTTP helper (no deps, no axios) ─────────────────────────
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, HOST);
    const isHttps = u.protocol === 'https:';
    const headers = { 'Content-Type': 'application/json' };
    if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + u.search,
      headers,
    };
    const payload = body ? JSON.stringify(body) : null;
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);
    const transport = isHttps ? https : http;
    const req = transport.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(cond, msg) {
  if (cond) return;
  throw new Error(msg);
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  if (ak.length !== bk.length) return false;
  if (ak.join(',') !== bk.join(',')) return false;
  return ak.every(k => deepEqual(a[k], b[k]));
}

async function runTest(name, fn) {
  process.stdout.write(`  ${name} ... `);
  try {
    await fn();
    console.log('\x1b[32mPASS\x1b[0m');
    passed++;
  } catch (e) {
    console.log('\x1b[31mFAIL\x1b[0m');
    console.log(`     ↳ ${e.message}`);
    failed++;
    failures.push({ name, error: e.message });
  }
}

// ── Pre-flight: make sure the server is up and hooks are enabled ────────
async function preflight() {
  let health;
  try {
    health = await request('GET', '/api/health/stockrec');
  } catch (e) {
    console.error(`✖ Cannot reach server at ${HOST}: ${e.message}`);
    console.error(`  Start with: V2_TEST_HOOKS=1 node kite-server.js`);
    process.exit(2);
  }
  if (health.status === 401) {
    console.error('✖ Server returned 401 Authentication required.');
    console.error('  The deploy is behind authMiddleware. Pass a session token:');
    console.error('    TOKEN=<your-session-token> HOST=' + HOST + ' node test/v2-invariants.js');
    console.error('  Get the token from your browser devtools (cookie "session_token").');
    process.exit(2);
  }
  const hookProbe = await request('GET', '/api/test/snapshot-count');
  if (hookProbe.status === 404) {
    console.error('✖ V2_TEST_HOOKS is NOT enabled on the server.');
    console.error('  Restart with: V2_TEST_HOOKS=1 node kite-server.js');
    console.error('  (On Railway: Dashboard → Variables → add V2_TEST_HOOKS=1 → redeploy)');
    process.exit(2);
  }
  if (hookProbe.status === 401) {
    console.error('✖ Test hooks returned 401. TOKEN is missing or expired.');
    process.exit(2);
  }
  console.log(`✓ Server reachable at ${HOST}`);
  console.log(`✓ V2_TEST_HOOKS enabled`);
  console.log(`✓ Auth:  ${TOKEN ? 'Bearer token sent' : 'none (localhost mode)'}`);
  console.log(`✓ Health status: ${health.body?.status || 'unknown'}`);
  console.log('');
}

// ── Test 1: FA/TA separation ────────────────────────────────────────────
async function testFATaSeparation() {
  // Baseline: score with no overrides
  const base = await request('GET', `/api/test/scorev2?sym=${SYMBOL}`);
  assert(base.status === 200, `baseline score failed: ${base.status} ${JSON.stringify(base.body)}`);
  assert(base.body.scoreV2 != null, `baseline has no scoreV2 for ${SYMBOL}`);
  assert(base.body.subScores, `baseline has no subScores`);

  // Scenario A: "bullish" technicals — strong trend, above 200DMA, golden cross
  const qa = new URLSearchParams({
    sym: SYMBOL,
    tech_pctAbove200: '18',
    tech_goldenCross: 'true',
    tech_weeklyTrendConfirmed: 'true',
    tech_pctFromHigh: '-8',
    tech_rsi: '65',
    tech_macdBull: 'true',
  }).toString();
  const bull = await request('GET', `/api/test/scorev2?${qa}`);
  assert(bull.status === 200, `bull score failed: ${bull.status}`);

  // Scenario B: "bearish" technicals — below 200DMA, deep pullback, no golden cross
  const qb = new URLSearchParams({
    sym: SYMBOL,
    tech_pctAbove200: '-12',
    tech_goldenCross: 'false',
    tech_weeklyTrendConfirmed: 'false',
    tech_pctFromHigh: '-32',
    tech_rsi: '28',
    tech_macdBull: 'false',
  }).toString();
  const bear = await request('GET', `/api/test/scorev2?${qb}`);
  assert(bear.status === 200, `bear score failed: ${bear.status}`);

  // Invariant 1: scoreV2 must be identical in all three cases
  assert(
    base.body.scoreV2 === bull.body.scoreV2 && bull.body.scoreV2 === bear.body.scoreV2,
    `scoreV2 drifted with TA overrides: base=${base.body.scoreV2} bull=${bull.body.scoreV2} bear=${bear.body.scoreV2}`
  );

  // Invariant 2: every sub-score must be identical (each pillar must be pure FA)
  assert(
    deepEqual(base.body.subScores, bull.body.subScores),
    `subScores drifted bull: ${JSON.stringify(base.body.subScores)} vs ${JSON.stringify(bull.body.subScores)}`
  );
  assert(
    deepEqual(base.body.subScores, bear.body.subScores),
    `subScores drifted bear: ${JSON.stringify(base.body.subScores)} vs ${JSON.stringify(bear.body.subScores)}`
  );

  // Invariant 3: subScores must have EXACTLY the 4 fundamentals keys.
  // If anyone adds a timing-related key here, this test catches it immediately.
  const keys = Object.keys(base.body.subScores).sort();
  assert(
    keys.join(',') === 'business,growth,quality,valuation',
    `subScores has unexpected keys: ${keys.join(',')}`
  );

  // Invariant 4: timingOverlay should actually move between bull and bear
  // (confirms TA overrides are being applied at all — guards against a
  // false green where scoreV2 is stable because the overrides silently
  // didn't take effect).
  assert(
    bull.body.timingOverlay && bear.body.timingOverlay,
    `timingOverlay missing`
  );
  assert(
    bull.body.timingOverlay.timingScore !== bear.body.timingOverlay.timingScore,
    `timingOverlay.timingScore should change between bull and bear TA — got ${bull.body.timingOverlay.timingScore} for both`
  );
}

// ── Test 2: Snapshot idempotency ────────────────────────────────────────
async function testSnapshotIdempotency() {
  // Run 1
  const r1 = await request('POST', '/api/admin/snapshot/run');
  assert(r1.status === 200, `first snapshot run failed: ${r1.status} ${JSON.stringify(r1.body)}`);
  assert(r1.body.written != null, `first run has no written count`);

  const c1 = await request('GET', '/api/test/snapshot-count');
  assert(c1.status === 200, `count1 failed`);
  const count1 = c1.body.count;

  // Run 2 (same day) — ON CONFLICT DO UPDATE should leave row count flat
  const r2 = await request('POST', '/api/admin/snapshot/run');
  assert(r2.status === 200, `second snapshot run failed: ${r2.status}`);
  const c2 = await request('GET', '/api/test/snapshot-count');
  const count2 = c2.body.count;

  assert(
    count1 === count2,
    `snapshot count changed between runs: ${count1} → ${count2} (should be identical on same day)`
  );

  // Also: writeDailySnapshots should report the same written count each
  // time it ran — both runs saw the same fundamentals universe, so each
  // run should process the same number of rows.
  assert(
    r1.body.written === r2.body.written,
    `written count differs between runs: ${r1.body.written} vs ${r2.body.written}`
  );
}

// ── Test 3: LLM cap short-circuit ───────────────────────────────────────
async function testLLMCapShortCircuit() {
  // Clean slate so we know exactly what state we're in
  const reset = await request('POST', '/api/test/llm-budget/reset');
  assert(reset.status === 200, `reset failed`);

  // Force the cap for endpoint=default, modelId=gpt-nano (the cheapest model,
  // which is what callAIModel will fall back to in /api/test/llm-call)
  const force = await request(
    'POST',
    '/api/test/llm-budget/force-cap?endpoint=default&modelId=gpt-nano'
  );
  assert(force.status === 200, `force-cap failed: ${JSON.stringify(force.body)}`);
  assert(
    force.body.used > force.body.cap,
    `force-cap did not exceed cap: used=${force.body.used} cap=${force.body.cap}`
  );

  // Now call the LLM probe — it should short-circuit
  const call = await request('POST', '/api/test/llm-call?endpoint=default');
  assert(call.status === 200, `llm-call probe failed: ${call.status}`);
  assert(
    call.body.result && call.body.result.skipped === true,
    `LLM call was NOT short-circuited — got ${JSON.stringify(call.body.result)}`
  );
  assert(
    call.body.result.error === 'llm-cap-exceeded',
    `LLM call returned wrong error code: ${call.body.result.error}`
  );

  // Clean up so we don't leave the counter poisoned for the next test run
  await request('POST', '/api/test/llm-budget/reset');
}

// ── Entry point ─────────────────────────────────────────────────────────
(async () => {
  console.log('');
  console.log('═'.repeat(70));
  console.log('  Stock Picks v2 — Invariant Test Suite');
  console.log('═'.repeat(70));
  console.log(`  Host:   ${HOST}`);
  console.log(`  Symbol: ${SYMBOL}`);
  console.log('─'.repeat(70));

  await preflight();

  await runTest('FA/TA separation  — scoreV2 unchanged across TA overrides', testFATaSeparation);
  await runTest('Snapshot idempotency — same-day rerun is a no-op upsert ', testSnapshotIdempotency);
  await runTest('LLM cap short-circuit — callAIModel returns skipped:true', testLLMCapShortCircuit);

  console.log('');
  console.log('─'.repeat(70));
  if (failed === 0) {
    console.log(`  \x1b[32m✓ ${passed} passed\x1b[0m`);
    process.exit(0);
  } else {
    console.log(`  \x1b[32m✓ ${passed} passed\x1b[0m, \x1b[31m✖ ${failed} failed\x1b[0m`);
    for (const f of failures) console.log(`    - ${f.name}`);
    process.exit(1);
  }
})().catch(e => {
  console.error('\n✖ Test runner crashed:', e);
  process.exit(2);
});
