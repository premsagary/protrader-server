// strategy_engine.js — 5 validated strategies + Day×VIX router.
// Matches Stockmock backtest exactly (28.5% OOS CAGR validated).
'use strict';

const time = require('./time_utils');

// ---------- Day × VIX matrix (validated by 7yr backtest) ----------
const ROUTING_MATRIX = {
  'Mon': { 'V1-13': 'SKIP',         'V13-16': 'ShortCP25SP',  'V16-22': 'ShortCP100',  'V22+': 'StraddleWidth' },
  'Tue': { 'V1-13': 'ShortCP25SP',  'V13-16': 'ShortStrangle','V16-22': 'SKIP',        'V22+': 'ShortCP100'    },
  'Wed': { 'V1-13': 'ShortStrangle','V13-16': 'StraddleWidth','V16-22': 'ShortStrangle','V22+': 'ShortCP25SP'   },
  'Thu': { 'V1-13': 'ShortCP100',   'V13-16': 'StraddleWidth','V16-22': 'ShortCP25SP', 'V22+': 'ShortCP25SP'   },
  'Fri': { 'V1-13': 'StraddleWidth','V13-16': 'ShortCP100',   'V16-22': 'ShortCP25SP', 'V22+': 'SKIP'          },
};

function vixBand(vix) {
  if (vix == null) return null;
  if (vix < 13) return 'V1-13';
  if (vix < 16) return 'V13-16';
  if (vix < 22) return 'V16-22';
  return 'V22+';
}

function pickStrategy({ day, vix, isExpiry = false } = {}) {
  // Tuesday expiry override
  if (isExpiry && day === time.currentWeeklyExpiryDay()) return 'ExpiryDay';
  const band = vixBand(vix);
  if (!day || !band || !ROUTING_MATRIX[day]) return 'SKIP';
  return ROUTING_MATRIX[day][band] || 'SKIP';
}

// ---------- Helpers ----------
function nearestStrike(spot, step = 50) {
  return Math.round(spot / step) * step;
}

function findStrikeByPremium(chain, type, targetPremium, atmStrike, direction = 'OTM') {
  const strikes = Object.keys(chain).map(Number).sort((a, b) => a - b);
  let best = null, bestDiff = Infinity;
  for (const s of strikes) {
    const isOtm = type === 'ce' ? s >= atmStrike : s <= atmStrike;
    if (direction === 'OTM' && !isOtm) continue;
    const ltp = chain[s]?.[type]?.ltp;
    if (!ltp || ltp <= 0) continue;
    const diff = Math.abs(ltp - targetPremium);
    if (diff < bestDiff) { bestDiff = diff; best = s; }
  }
  return best;
}

function buildLeg(side, strike, type, qty, chain, expirySymbol = '') {
  const c = chain[strike]?.[type.toLowerCase()] || {};
  const premium = c.ltp || 0;
  // Prefer real tradingsymbol from chain (set by buildLiveChain). Only fallback to fabricated for paper/test.
  const instrument = c.tradingsymbol ? `NFO:${c.tradingsymbol}` :
    (expirySymbol ? `NFO:NIFTY${expirySymbol}${strike}${type}` : null);
  return {
    side, strike, type, qty, premium,
    bid: c.bid, ask: c.ask, instrument,
    tradingsymbol: c.tradingsymbol || null,
    instrument_token: c.instrument_token || null,
    lot_size: c.lot_size || null,
  };
}

// ---------- Strategy templates ----------

function straddleWidth({ spot, chain, lotSize, expirySymbol = '' }) {
  const atm = nearestStrike(spot, 50);
  const wing = nearestStrike(spot * 0.01, 50) || 200;
  const legs = [
    buildLeg('SELL', atm, 'CE', 1, chain, expirySymbol),
    buildLeg('SELL', atm, 'PE', 1, chain, expirySymbol),
    buildLeg('BUY',  atm + wing, 'CE', 1, chain, expirySymbol),
    buildLeg('BUY',  atm - wing, 'PE', 1, chain, expirySymbol),
  ];
  if (legs.some(l => !l.premium)) return { error: 'Missing premium', strategy: 'StraddleWidth', legs };
  const credit = Math.round(legs.reduce((acc, l) =>
    acc + (l.side === 'SELL' ? l.premium : -l.premium) * l.qty * lotSize, 0));
  const maxLoss = Math.round(wing * lotSize - credit);
  return {
    strategy: 'StraddleWidth',
    legs,
    credit,
    maxProfit: credit,
    maxLoss,
    breakeven: [atm - credit / lotSize, atm + credit / lotSize],
    marginEstimate: 140000,  // estimate; replaced by kc.orderMargins() before placement
    slPerLegMultiplier: 1.25,
    slCombinedLossPct: 1.00,
    forceExitTime: '14:30',
    entryRules: [`Sell ATM straddle at ${atm}, wings at ATM ± ${wing}`],
    exitRules: ['Per-leg SL when premium up 25%', 'Combined SL at 100% loss of credit', 'Force exit 14:30 IST'],
    riskWarnings: [],
  };
}

function shortCP25SP({ spot, chain, lotSize, expirySymbol = '' }) {
  const atm = nearestStrike(spot, 50);
  const straddlePrem = (chain[atm]?.ce?.ltp || 0) + (chain[atm]?.pe?.ltp || 0);
  if (!straddlePrem) return { error: 'No ATM straddle premium', strategy: 'ShortCP25SP' };
  const target = straddlePrem * 0.25;
  const ceStrike = findStrikeByPremium(chain, 'ce', target, atm);
  const peStrike = findStrikeByPremium(chain, 'pe', target, atm);
  if (!ceStrike || !peStrike) return { error: 'No matching strike', strategy: 'ShortCP25SP' };
  const legs = [
    buildLeg('SELL', ceStrike, 'CE', 1, chain, expirySymbol),
    buildLeg('SELL', peStrike, 'PE', 1, chain, expirySymbol),
  ];
  const credit = Math.round(legs.reduce((acc, l) => acc + l.premium * l.qty * lotSize, 0));
  return {
    strategy: 'ShortCP25SP',
    legs,
    credit,
    maxProfit: credit,
    maxLoss: null,
    breakeven: [peStrike - credit / lotSize, ceStrike + credit / lotSize],
    marginEstimate: 140000,
    slPerLegMultiplier: 1.25,
    slCombinedLossPct: 1.00,
    forceExitTime: '14:30',
    entryRules: [`Sell CE @ ${ceStrike} (~₹${target.toFixed(0)}), Sell PE @ ${peStrike}`],
    exitRules: ['Per-leg SL 25%', 'Combined SL 100% credit', 'Force exit 14:30'],
    riskWarnings: ['Naked seller — no defined max loss'],
  };
}

function shortCP100({ spot, chain, lotSize, expirySymbol = '' }) {
  const atm = nearestStrike(spot, 50);
  const ceStrike = findStrikeByPremium(chain, 'ce', 100, atm);
  const peStrike = findStrikeByPremium(chain, 'pe', 100, atm);
  if (!ceStrike || !peStrike) return { error: 'No matching strike', strategy: 'ShortCP100' };
  const legs = [
    buildLeg('SELL', ceStrike, 'CE', 1, chain, expirySymbol),
    buildLeg('SELL', peStrike, 'PE', 1, chain, expirySymbol),
  ];
  const credit = Math.round(legs.reduce((acc, l) => acc + l.premium * l.qty * lotSize, 0));
  return {
    strategy: 'ShortCP100',
    legs,
    credit,
    maxProfit: credit,
    maxLoss: null,
    breakeven: [peStrike - credit / lotSize, ceStrike + credit / lotSize],
    marginEstimate: 140000,
    slPerLegMultiplier: 1.25,
    slCombinedLossPct: 1.00,
    forceExitTime: '14:30',
    entryRules: [`Sell CE @ ${ceStrike} (~₹100), Sell PE @ ${peStrike}`],
    exitRules: ['Per-leg SL 25%', 'Combined SL 100% credit', 'Force exit 14:30'],
    riskWarnings: ['Naked seller'],
  };
}

function shortStrangle({ spot, chain, lotSize, otmOffset = 300, expirySymbol = '' }) {
  const atm = nearestStrike(spot, 50);
  const ceStrike = atm + otmOffset;
  const peStrike = atm - otmOffset;
  const legs = [
    buildLeg('SELL', ceStrike, 'CE', 1, chain, expirySymbol),
    buildLeg('SELL', peStrike, 'PE', 1, chain, expirySymbol),
  ];
  if (legs.some(l => !l.premium)) return { error: `Missing premium @ ${ceStrike} or ${peStrike}`, strategy: 'ShortStrangle' };
  const credit = Math.round(legs.reduce((acc, l) => acc + l.premium * l.qty * lotSize, 0));
  return {
    strategy: 'ShortStrangle',
    legs,
    credit,
    maxProfit: credit,
    maxLoss: null,
    breakeven: [peStrike - credit / lotSize, ceStrike + credit / lotSize],
    marginEstimate: 140000,
    slPerLegMultiplier: 1.25,
    slCombinedLossPct: 1.00,
    forceExitTime: '14:30',
    entryRules: [`Sell CE @ ${ceStrike}, Sell PE @ ${peStrike} (ATM ± ${otmOffset})`],
    exitRules: ['Per-leg SL 25%', 'Combined SL 100% credit', 'Force exit 14:30'],
    riskWarnings: ['Naked OTM strangle'],
  };
}

function expiryDay({ spot, chain, lotSize, expirySymbol = '' }) {
  if (!time.isExpiryToday()) return { error: 'expiryDay requires today is weekly expiry', strategy: 'ExpiryDay' };
  const atm = nearestStrike(spot, 50);
  const legs = [
    buildLeg('SELL', atm, 'CE', 1, chain, expirySymbol),
    buildLeg('SELL', atm, 'PE', 1, chain, expirySymbol),
  ];
  if (legs.some(l => !l.premium)) return { error: 'Missing ATM premium', strategy: 'ExpiryDay' };
  const credit = Math.round(legs.reduce((acc, l) => acc + l.premium * l.qty * lotSize, 0));
  return {
    strategy: 'ExpiryDay',
    legs,
    credit,
    maxProfit: credit,
    maxLoss: null,
    breakeven: [atm - credit / lotSize, atm + credit / lotSize],
    marginEstimate: 140000,
    slPerLegMultiplier: 1.25,
    slCombinedLossPct: 1.00,
    forceExitTime: '14:30',
    entryRules: [`Sell ATM CE+PE @ ${atm} (expiry day)`],
    exitRules: ['Per-leg SL 25%', 'Combined SL 100% credit', 'Force exit 14:30 (STT trap)'],
    riskWarnings: ['STT trap on ITM legs at 15:30 expiry — must exit by 14:30'],
  };
}

const STRATEGY_FNS = {
  'StraddleWidth': straddleWidth,
  'ShortCP25SP':   shortCP25SP,
  'ShortCP100':    shortCP100,
  'ShortStrangle': shortStrangle,
  'ExpiryDay':     expiryDay,
};

function buildTradeCard(strategyName, ctx) {
  const fn = STRATEGY_FNS[strategyName];
  if (!fn) return { error: `Unknown strategy: ${strategyName}` };
  return fn(ctx);
}

module.exports = {
  ROUTING_MATRIX,
  vixBand,
  pickStrategy,
  buildTradeCard,
  STRATEGY_FNS,
  // Helpers exposed for testing
  nearestStrike, findStrikeByPremium,
};
