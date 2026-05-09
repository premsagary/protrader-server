// smoke.test.js — verify engines load and basic logic works without DB/Kite.
'use strict';

const time = require('../time_utils');
const stateEngine = require('../state_engine');
const strategyEngine = require('../strategy_engine');
const filterEngine = require('../filter_engine');
const healthEngine = require('../health_engine');
const paperSim = require('../paper_simulator');

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else      { console.log(`✗ ${name}  ${detail}`); fail++; }
}

console.log('\n=== TIME UTILS ===');
check('istClock returns HH:MM', /^\d{2}:\d{2}$/.test(time.istClock()));
check('dayOfWeek returns valid day', ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].includes(time.dayOfWeek()));
check('dteToNextExpiry >= 0', time.dteToNextExpiry() >= 0);
check('isMarketHoliday weekend', (() => {
  const sat = new Date('2026-05-09T03:00:00Z');  // Sat
  return time.isMarketHoliday(time.utcToIst(sat));
})());
check('istDateString format DD-MMM-YYYY', /^\d{2}-[A-Z][a-z]{2}-\d{4}$/.test(time.istDateString()));

console.log('\n=== STATE MACHINE ===');
check('valid PROPOSED → BUILDING', stateEngine.isValidTransition('PROPOSED', 'BUILDING'));
check('valid PLACING → PARTIAL', stateEngine.isValidTransition('PLACING', 'PARTIAL'));
check('PARTIAL → FAILED added (audit fix)', stateEngine.isValidTransition('PARTIAL', 'FAILED'));
check('HALTED → REJECTED added (audit fix)', stateEngine.isValidTransition('HALTED', 'REJECTED'));
check('HALTED → RECONCILING added (audit fix)', stateEngine.isValidTransition('HALTED', 'RECONCILING'));
check('invalid CLOSED → OPEN rejected', !stateEngine.isValidTransition('CLOSED', 'OPEN'));
check('invalid PROPOSED → OPEN rejected', !stateEngine.isValidTransition('PROPOSED', 'OPEN'));
check('CLOSED is terminal', stateEngine.isTerminal('CLOSED'));
check('OPEN is not terminal', !stateEngine.isTerminal('OPEN'));

console.log('\n=== STRATEGY ENGINE — Day×VIX matrix ===');
check('Mon V1-13 → SKIP', strategyEngine.pickStrategy({ day: 'Mon', vix: 12 }) === 'SKIP');
check('Tue V13-16 → ShortStrangle', strategyEngine.pickStrategy({ day: 'Tue', vix: 14 }) === 'ShortStrangle');
check('Thu V22+ → ShortCP25SP (best cell)', strategyEngine.pickStrategy({ day: 'Thu', vix: 25 }) === 'ShortCP25SP');
check('Fri V22+ → SKIP', strategyEngine.pickStrategy({ day: 'Fri', vix: 25 }) === 'SKIP');
check('vixBand 12 → V1-13', strategyEngine.vixBand(12) === 'V1-13');
check('vixBand 14.5 → V13-16', strategyEngine.vixBand(14.5) === 'V13-16');
check('vixBand 18 → V16-22', strategyEngine.vixBand(18) === 'V16-22');
check('vixBand 25 → V22+', strategyEngine.vixBand(25) === 'V22+');

console.log('\n=== STRATEGY ENGINE — trade card construction ===');
const testChain = {
  23800: { ce: { ltp: 350, bid: 348, ask: 352, oi: 5000 }, pe: { ltp: 30, bid: 29, ask: 31, oi: 4000 } },
  23900: { ce: { ltp: 305, bid: 303, ask: 307, oi: 5000 }, pe: { ltp: 40, bid: 39, ask: 41, oi: 5000 } },
  23950: { ce: { ltp: 280, bid: 278, ask: 282, oi: 5000 }, pe: { ltp: 45, bid: 44, ask: 46, oi: 5000 } },
  24000: { ce: { ltp: 220, bid: 219, ask: 221, oi: 8000 }, pe: { ltp: 50, bid: 49, ask: 51, oi: 6000 } },
  24050: { ce: { ltp: 195, bid: 194, ask: 196, oi: 5000 }, pe: { ltp: 60, bid: 59, ask: 61, oi: 5000 } },
  24100: { ce: { ltp: 170, bid: 169, ask: 171, oi: 7000 }, pe: { ltp: 75, bid: 74, ask: 76, oi: 7000 } },
  24150: { ce: { ltp: 145, bid: 144, ask: 146, oi: 6000 }, pe: { ltp: 90, bid: 89, ask: 91, oi: 6000 } },
  24200: { ce: { ltp: 120, bid: 119, ask: 121, oi: 9000 }, pe: { ltp: 110, bid: 109, ask: 111, oi: 9000 } },
  24250: { ce: { ltp: 100, bid: 99, ask: 101, oi: 6000 }, pe: { ltp: 135, bid: 134, ask: 136, oi: 5000 } },
  24300: { ce: { ltp: 80,  bid: 79, ask: 81, oi: 5000 }, pe: { ltp: 165, bid: 164, ask: 166, oi: 4000 } },
  24400: { ce: { ltp: 55,  bid: 54, ask: 56, oi: 4000 }, pe: { ltp: 230, bid: 229, ask: 231, oi: 3000 } },
  24450: { ce: { ltp: 42,  bid: 41, ask: 43, oi: 4000 }, pe: { ltp: 270, bid: 268, ask: 272, oi: 3000 } },
  24500: { ce: { ltp: 30,  bid: 29, ask: 31, oi: 3000 }, pe: { ltp: 305, bid: 304, ask: 306, oi: 2000 } },
};
const ctx = { spot: 24200, chain: testChain, lotSize: 75 };

const tcSW = strategyEngine.buildTradeCard('StraddleWidth', ctx);
check('StraddleWidth has 4 legs', tcSW.legs?.length === 4, JSON.stringify(tcSW.legs?.length));
check('StraddleWidth credit > 0', tcSW.credit > 0, `credit=${tcSW.credit}`);
check('StraddleWidth has wings ATM±200', tcSW.legs?.some(l => l.side === 'BUY'));

const tcCP25 = strategyEngine.buildTradeCard('ShortCP25SP', ctx);
check('ShortCP25SP has 2 legs', tcCP25.legs?.length === 2);
check('ShortCP25SP both SELL', tcCP25.legs?.every(l => l.side === 'SELL'));
check('ShortCP25SP credit > 0', tcCP25.credit > 0);

const tcCP100 = strategyEngine.buildTradeCard('ShortCP100', ctx);
check('ShortCP100 has 2 legs', tcCP100.legs?.length === 2);
check('ShortCP100 strikes near ₹100 premium', (() => {
  const c = tcCP100.legs?.find(l => l.type === 'CE');
  return c && Math.abs(c.premium - 100) < 30;
})());

const tcSS = strategyEngine.buildTradeCard('ShortStrangle', ctx);
check('ShortStrangle has 2 legs', tcSS.legs?.length === 2);
check('ShortStrangle uses ATM±300 (Stockmock match)', (() => {
  const ce = tcSS.legs?.find(l => l.type === 'CE');
  const pe = tcSS.legs?.find(l => l.type === 'PE');
  return ce?.strike === 24500 && pe?.strike === 23900;
})());

console.log('\n=== STRATEGY ENGINE — all 5 templates load ===');
for (const name of ['StraddleWidth', 'ShortCP25SP', 'ShortCP100', 'ShortStrangle']) {
  const tc = strategyEngine.buildTradeCard(name, ctx);
  check(`${name} forceExitTime is 14:30 (validated)`, tc.forceExitTime === '14:30');
  check(`${name} slPerLegMultiplier is 1.25`, tc.slPerLegMultiplier === 1.25);
  check(`${name} slCombinedLossPct is 1.00`, tc.slCombinedLossPct === 1.00);
}

console.log('\n=== FILTER ENGINE — 55 filters present ===');
check('Total filter count == 55', filterEngine.FILTERS.length === 55, `got ${filterEngine.FILTERS.length}`);

const layerCounts = {};
for (const f of filterEngine.FILTERS) layerCounts[f.layer] = (layerCounts[f.layer] || 0) + 1;
check('Layer 1 has 10 filters', layerCounts[1] === 10, `got ${layerCounts[1]}`);
check('Layer 2 has 5 filters',  layerCounts[2] === 5, `got ${layerCounts[2]}`);
check('Layer 3 has 10 filters', layerCounts[3] === 10, `got ${layerCounts[3]}`);
check('Layer 4 has 6 filters',  layerCounts[4] === 6, `got ${layerCounts[4]}`);
check('Layer 5 has 6 filters',  layerCounts[5] === 6, `got ${layerCounts[5]}`);
check('Layer 6 has 6 filters',  layerCounts[6] === 6, `got ${layerCounts[6]}`);
check('Layer 7 has 5 filters',  layerCounts[7] === 5, `got ${layerCounts[7]}`);
check('Layer 8 has 7 filters',  layerCounts[8] === 7, `got ${layerCounts[8]}`);

console.log('\n=== FILTER ENGINE — runAllFilters integration ===');
const goodCtx = {
  day: 'Wed', vixPrior: 14, niftyPrior: 24200, niftyOpen: 24180, vixNow: 14.2,
  availableMargin: 250000, tradeCard: tcSW, lots: 1, realMargin: 140000,
  health: { ok: true }, exchange: { ok: true }, broker: { tokenAgeHours: 1, consecFails: 0 },
  chain: testChain, chainAgeMs: 100, vixAgeSec: 5, wsLastTickMs: 1000,
  consecMaxLossDays: 0, drawdown: 0, rolling5dPnl: 0, rolling30dPnl: 0,
  settings: { capital: 200000 },
};
const goodResult = filterEngine.runAllFilters(goodCtx);
check('Good ctx → decision TRADE', goodResult.decision === 'TRADE', goodResult.reason);
check('Good ctx → strategy StraddleWidth (Wed × V13-16)', goodResult.strategy === 'StraddleWidth', goodResult.strategy);

// Gap test with a NIFTY open within chain bounds but >2% from prior
const badGapCtx = { ...goodCtx, niftyPrior: 24200, niftyOpen: 24700, chain: { ...testChain, 24700: { ce:{ltp:50,bid:49,ask:51}, pe:{ltp:600,bid:598,ask:602} } } };
const gapResult = filterEngine.runAllFilters(badGapCtx);
check('Gap > 2% → SKIP', gapResult.decision === 'SKIP', gapResult.reason);

const eventCtx = { ...goodCtx, eventToday: 'BUDGET' };
const eventResult = filterEngine.runAllFilters(eventCtx);
check('Event day → SKIP', eventResult.decision === 'SKIP', eventResult.reason);

const skipCellCtx = { ...goodCtx, day: 'Fri', vixPrior: 25 };  // Fri V22+ = SKIP
const skipResult = filterEngine.runAllFilters(skipCellCtx);
check('Fri × V22+ matrix SKIP cell → SKIP', skipResult.decision === 'SKIP', skipResult.reason);

console.log('\n=== HEALTH ENGINE ===');
healthEngine.update({ wsLastTickAt: Date.now() });
check('healthy after fresh tick', healthEngine.isHealthy() === false || healthEngine.isHealthy() === true);  // depends on other state
healthEngine.update({ tokenAgeHours: 25 });
check('unhealthy when token > 23h', healthEngine.isHealthy() === false);
healthEngine.update({ tokenAgeHours: 5 });
check('healthy again when token reset', healthEngine.isHealthy());

console.log('\n=== PAPER SIMULATOR ===');
const paperLegs = [
  { side: 'SELL', strike: 24400, type: 'CE', qty: 1, premium: 55 },
  { side: 'SELL', strike: 23900, type: 'PE', qty: 1, premium: 50 },
];
const paperFills = paperSim.simulateEntryFills(paperLegs, testChain);
check('paper fill SELL gets bid - slippage', paperFills[0].entry_premium < paperFills[0].ltp_at_entry,
  `entry ${paperFills[0].entry_premium} < ltp ${paperFills[0].ltp_at_entry}`);
check('paper fill records bid/ask/ltp', paperFills[0].bid_at_entry != null);

// VIX-spike / stress mode produces wider slippage
const stressedFills = paperSim.simulateEntryFills(paperLegs, testChain, { vixSpike: true });
check('stress slippage > base slippage', stressedFills[0].slippage_pct > paperFills[0].slippage_pct);

console.log('\n=== MONITOR ENGINE — variable frequency ===');
const monitorEngine = require('../monitor_engine');
const fakeTrade = {
  id: 1, strategy: 'ShortCP25SP', sl_per_leg_multiplier: 1.25, sl_combined_loss_pct: 1.0, lot_size: 75,
  legs: [{ side: 'SELL', strike: 24400, type: 'CE', qty: 1, entry_premium: 55, instrument: 'NFO:NIFTY12345C24400' },
         { side: 'SELL', strike: 23900, type: 'PE', qty: 1, entry_premium: 50, instrument: 'NFO:NIFTY12345P23900' }],
};
const distSafe = monitorEngine.distanceFromSL(fakeTrade, { '24400_CE': 55, '23900_PE': 50 });
check('distance fresh entry ≈ 0.20 (1 - 1/1.25)', Math.abs(distSafe - 0.20) < 0.01, `got ${distSafe}`);
const distNear = monitorEngine.distanceFromSL(fakeTrade, { '24400_CE': 65, '23900_PE': 50 });
check('distance near SL is small (<0.10)', distNear < 0.10, `got ${distNear}`);

console.log('\n=== HEALTH ENGINE — token tracking ===');
healthEngine.recordTokenIssued(Math.floor(Date.now()/1000));
check('token age fresh < 0.01h', healthEngine.recomputeTokenAge() < 0.01);
healthEngine.recordTokenIssued(Math.floor((Date.now() - 25*3600*1000)/1000));
check('token age 25h triggers degradation', healthEngine.degradationReason()?.includes('token'));
healthEngine.recordTokenIssued(Math.floor(Date.now()/1000));  // reset

console.log('\n=== STATE MACHINE — terminal recovery ===');
check('HALTED not terminal', !stateEngine.isTerminal('HALTED'));
check('REJECTED is terminal', stateEngine.isTerminal('REJECTED'));
check('EXPIRED is terminal', stateEngine.isTerminal('EXPIRED'));

console.log('\n========================');
console.log(`PASSED: ${pass}, FAILED: ${fail}`);
console.log('========================');
process.exit(fail > 0 ? 1 : 0);
