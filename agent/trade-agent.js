/**
 * trade-agent.js — deterministic filter chain + structured proposal builder.
 *
 * Input  : picks (from _dayTradeCache) + verified state
 * Output : array of proposals, each with strict schema:
 *   {
 *     sym, side, entry_type, trigger_price, entry_price, quantity,
 *     stop_loss, target, rr_ratio, confidence_score,
 *     passed_filters: [codes...], failed_filter: null | code,
 *     _pickSnapshot  // frozen reference to the source pick for audit
 *   }
 *
 * NO natural-language outputs. Every reason is an enum code.
 * NO randomness. Same (picks, state) → same proposals.
 *
 * The agent does NOT call Kite. It does NOT place orders. It produces
 * structured proposals that the constraint engine either approves or rejects.
 */

'use strict';

const { FILTERS, CONSTRAINTS, PAPER_CAPITAL_RUPEES } = require('./agent-config');

// Filter codes — stable enum used in logs and state_snapshot.
// When a code is in passed_filters[], that filter was evaluated and passed.
const FILTER_CODES = Object.freeze({
  SCORE: 'F_MIN_SCORE',
  VOLUME: 'F_VOL_RATIO',
  TREND: 'F_TREND_ALIGN',
  VOLATILITY: 'F_ATR_IN_BAND',
  SQUEEZE: 'F_NOT_SQUEEZED',
  STRUCTURE: 'F_STRUCTURE_DISTANCE',
  TIME_OPEN: 'F_AFTER_OPEN_BUFFER',
  TIME_CLOSE: 'F_BEFORE_ENTRY_CUTOFF',
  LIQUIDITY: 'F_LIQUIDITY',
  HAS_RISK_LEVELS: 'F_HAS_SL_TGT',
  RR: 'F_RR_MIN',
  SETUP_ALLOWED: 'F_SETUP_ALLOWED',
});

// Setup whitelist — all four Varsity setups are allowed; keep as config so we
// can blacklist specific ones later without touching the filter chain.
const ALLOWED_SETUPS = new Set(['VWAP_RECLAIM', 'GAP_AND_GO', 'BREAKOUT', 'OVERSOLD_BOUNCE']);

// Most ProTrader picks are LONG-biased (scoreDayTrade currently scores bullish
// setups only). We codify this and leave room for shorts in Phase 2.
function inferSide(pick) {
  // OVERSOLD_BOUNCE and VWAP_RECLAIM and BREAKOUT and GAP_AND_GO (up) are all BUY
  // in the current scorer. Shorts would require a sign flag on the pick.
  return 'BUY';
}

// ────────────────────────────────────────────────────────────────────────────
// Filter primitives — each returns { passed: bool, value?: any }
// ────────────────────────────────────────────────────────────────────────────
function fScore(pick) {
  const v = Number(pick.dayTradeScore || 0);
  return { passed: v >= FILTERS.MIN_DAY_TRADE_SCORE, value: v };
}
function fVolume(pick) {
  const v = Number(pick.volRatio || 0);
  return { passed: v >= FILTERS.MIN_VOL_RATIO, value: v };
}
function fTrend(pick, state) {
  const ema9 = Number(pick.ema9 || 0);
  const ema20 = Number(pick.ema20 || 0);
  if (!ema9 || !ema20) return { passed: false, value: 'missing_ema' };
  const trendUp = ema9 > ema20;
  const niftyUp = state.niftyChangePct == null ? true : state.niftyChangePct >= 0;
  // BUY requires EMA trend up AND NIFTY not strongly negative
  const niftyNotAgainst = state.niftyChangePct == null
    ? true
    : state.niftyChangePct > -0.5;
  return { passed: trendUp && niftyNotAgainst, value: { ema9, ema20, niftyChangePct: state.niftyChangePct } };
}
function fVolatility(pick) {
  const v = Number(pick.atrPct || 0);
  return {
    passed: v >= FILTERS.MIN_ATR_PCT && v <= FILTERS.MAX_ATR_PCT,
    value: v,
  };
}
function fStructureDistance(pick) {
  // Compute min distance (in ATR) from entry price to PDH/PDL/orHigh/orLow/round.
  const px = Number(pick.price || 0);
  const atrAbs = px * (Number(pick.atrPct || 0) / 100);
  if (!px || !atrAbs) return { passed: false, value: 'no_atr' };

  const levels = [
    pick.pdHigh, pick.pdLow, pick.orHigh, pick.orLow, pick.roundNumber,
  ].map(Number).filter(v => v > 0);

  if (!levels.length) return { passed: true, value: 'no_levels' }; // don't block on missing data

  // For a BUY we care about nearest level ABOVE price (resistance).
  const above = levels.filter(l => l > px);
  if (!above.length) return { passed: true, value: 'clear_above' };

  const nearest = Math.min(...above.map(l => l - px));
  const distInATR = nearest / atrAbs;
  return {
    passed: distInATR >= FILTERS.STRUCTURE_MIN_ATR_DISTANCE,
    value: { distInATR: +distInATR.toFixed(2), nearestLevelGap: +nearest.toFixed(2) },
  };
}
function fTimeOpen(state) {
  return { passed: state.minsSinceOpen >= FILTERS.ENTRY_OPEN_BUFFER_MINS, value: state.minsSinceOpen };
}
function fTimeClose(state) {
  return { passed: state.minsSinceOpen < FILTERS.ENTRY_CLOSE_CUTOFF_MINS, value: state.minsSinceOpen };
}
function fHasRiskLevels(pick) {
  const sl = Number(pick.sl || 0), tgt = Number(pick.tgt || 0), px = Number(pick.price || 0);
  const ok = sl > 0 && tgt > 0 && px > 0 && sl < px && tgt > px;
  return { passed: ok, value: { sl, tgt, px } };
}
function fRR(pick) {
  const rr = Number(pick.rrRatio || 0);
  return { passed: rr >= CONSTRAINTS.MIN_RR_RATIO, value: rr };
}
function fSetupAllowed(pick) {
  return { passed: ALLOWED_SETUPS.has(pick.bestSetup), value: pick.bestSetup };
}

// Ordered chain — short-circuits on first fail.
const CHAIN = [
  [FILTER_CODES.SCORE,        (p, s) => fScore(p)],
  [FILTER_CODES.SETUP_ALLOWED,(p, s) => fSetupAllowed(p)],
  [FILTER_CODES.HAS_RISK_LEVELS, (p, s) => fHasRiskLevels(p)],
  [FILTER_CODES.RR,           (p, s) => fRR(p)],
  [FILTER_CODES.VOLUME,       (p, s) => fVolume(p)],
  [FILTER_CODES.VOLATILITY,   (p, s) => fVolatility(p)],
  [FILTER_CODES.TREND,        (p, s) => fTrend(p, s)],
  [FILTER_CODES.STRUCTURE,    (p, s) => fStructureDistance(p)],
  [FILTER_CODES.TIME_OPEN,    (p, s) => fTimeOpen(s)],
  [FILTER_CODES.TIME_CLOSE,   (p, s) => fTimeClose(s)],
];

function runFilterChain(pick, state) {
  const passed = [];
  const evidence = {};
  for (const [code, fn] of CHAIN) {
    let r;
    try { r = fn(pick, state); }
    catch (e) { return { accepted: false, failedAt: code, detail: `filter_error: ${e.message}`, passed, evidence }; }
    evidence[code] = r.value;
    if (!r.passed) {
      return { accepted: false, failedAt: code, detail: String(r.value), passed, evidence };
    }
    passed.push(code);
  }
  return { accepted: true, failedAt: null, detail: null, passed, evidence };
}

// ────────────────────────────────────────────────────────────────────────────
// Entry trigger & proposal construction
// ────────────────────────────────────────────────────────────────────────────
// Phase 1 (dry run): we propose on every cycle where filters pass — we don't
// maintain the armed-candidate state yet (that arrives in Phase 2 with the
// live fill path). The trigger_price is still computed so the output schema
// matches what Phase 2 will produce.
function computeTriggerPrice(pick) {
  const px = Number(pick.price || 0);
  const breakoutRef =
    pick.bestSetup === 'BREAKOUT'    ? Math.max(Number(pick.orHigh || px), Number(pick.pdHigh || 0), px) :
    pick.bestSetup === 'GAP_AND_GO'  ? Math.max(Number(pick.dayHigh || px), px) :
    pick.bestSetup === 'VWAP_RECLAIM'? Math.max(px, Number(pick.vwap || px)) :
    /* OVERSOLD_BOUNCE */              px;
  const buffer = breakoutRef * (FILTERS.CANDLE_CONFIRM_BPS / 10000);
  return +(breakoutRef + buffer).toFixed(2);
}

function computeQuantity(pick, state) {
  const px = Number(pick.price || 0);
  const sl = Number(pick.sl || 0);
  const risk = Math.max(px - sl, 0);
  if (!risk) return 0;
  const capital = state.capital || PAPER_CAPITAL_RUPEES;
  const riskBudget = capital * (CONSTRAINTS.MAX_RISK_PER_TRADE_PCT / 100);
  const raw = Math.floor(riskBudget / risk);
  // Concentration cap: position value <= MAX_POSITION_PCT_OF_CAPITAL of capital
  const maxByConcentration = Math.floor((capital * CONSTRAINTS.MAX_POSITION_PCT_OF_CAPITAL / 100) / px);
  return Math.max(0, Math.min(raw, maxByConcentration));
}

function buildProposal(pick, state, filterResult) {
  const px = Number(pick.price || 0);
  const side = inferSide(pick);
  const trigger = computeTriggerPrice(pick);
  const qty = computeQuantity(pick, state);
  return {
    sym: pick.sym,
    sector: pick.sector || null,
    side,
    entry_type: 'SL-M',                // stop-limit style: fire on break confirmation
    trigger_price: trigger,
    entry_price: px,                   // reference; actual fill will differ
    quantity: qty,
    stop_loss: +Number(pick.sl).toFixed(2),
    target: +Number(pick.tgt).toFixed(2),
    rr_ratio: +Number(pick.rrRatio).toFixed(2),
    confidence_score: Number(pick.dayTradeScore || 0),
    day_trade_score: Number(pick.dayTradeScore || 0),
    best_setup: pick.bestSetup || null,
    passed_filters: filterResult.passed,
    failed_filter: null,
    filter_evidence: filterResult.evidence,
    _pickSnapshot: Object.freeze({ ...pick }),
  };
}

function buildRejection(pick, filterResult) {
  return {
    sym: pick.sym,
    sector: pick.sector || null,
    side: inferSide(pick),
    entry_type: 'SL-M',
    trigger_price: null,
    entry_price: Number(pick.price || 0),
    quantity: 0,
    stop_loss: pick.sl ? +Number(pick.sl).toFixed(2) : null,
    target: pick.tgt ? +Number(pick.tgt).toFixed(2) : null,
    rr_ratio: pick.rrRatio ? +Number(pick.rrRatio).toFixed(2) : null,
    confidence_score: Number(pick.dayTradeScore || 0),
    day_trade_score: Number(pick.dayTradeScore || 0),
    best_setup: pick.bestSetup || null,
    passed_filters: filterResult.passed,
    failed_filter: filterResult.failedAt,
    filter_evidence: filterResult.evidence,
    _pickSnapshot: Object.freeze({ ...pick }),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Public entry point — propose({ picks, state }) → { proposals[], rejections[] }
// ────────────────────────────────────────────────────────────────────────────
function propose({ picks, state }) {
  const proposals  = [];
  const rejections = [];
  if (!Array.isArray(picks) || !picks.length) return { proposals, rejections };

  // Sort picks by day_trade_score desc to give best setups first crack at
  // sector/concurrency caps in the constraint layer.
  const sorted = [...picks]
    .filter(p => p && p.sym)
    .sort((a, b) => Number(b.dayTradeScore || 0) - Number(a.dayTradeScore || 0));

  for (const pick of sorted) {
    const result = runFilterChain(pick, state);
    if (result.accepted) proposals.push(buildProposal(pick, state, result));
    else                 rejections.push(buildRejection(pick, result));
  }

  return { proposals, rejections };
}

module.exports = {
  propose,
  FILTER_CODES,
  // Exposed for testing
  _internal: { runFilterChain, computeTriggerPrice, computeQuantity },
};
