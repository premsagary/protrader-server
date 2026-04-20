/**
 * trading-rules.js — Deterministic rule-based intraday trading system.
 *
 * Distilled from:
 *   • Zerodha Varsity — Module 2 (Technical Analysis), Module 9 (Risk & Trading Psychology)
 *   • "How to Day Trade for a Living"  — Andrew Aziz
 *   • "Trading in the Zone"             — Mark Douglas
 *   • "Technical Analysis of the Financial Markets" — John Murphy
 *   • "Reading Price Charts Bar by Bar" — Al Brooks (price action)
 *   • Generic professional momentum / breakout / pullback frameworks
 *
 * Philosophy: every concept is expressed as a PREDICATE or a FORMULA.
 * No vague advice. No "consider" / "maybe". Inputs in → verdict out.
 *
 * Layering w.r.t. the existing ProTrader pipeline:
 *   Layer A — FILTERS (5-min scanner)       → agent-config.FILTERS + scoreDayTrade
 *   Layer B — VARSITY BINARY GATE (12 items) → scoreDayTrade.varsityChecklist
 *   Layer C — BOOK-RULES (this module)      → diagnostic today, gateable via flag
 *   Layer D — HARD CONSTRAINTS / RISK       → agent-config.CONSTRAINTS + constraint-engine
 *
 * Designed to be pure — no I/O, no side effects. Caller builds a `ctx` from
 * pick payload + account state and receives a deterministic verdict.
 *
 * To promote to a gate: flip agent-config.FILTERS.ENFORCE_BOOK_RULES_GATE=true
 * or wire evaluateAll() into scoreDayTrade to return null on fail.
 */

'use strict';

const VERSION = '1.1.0-book-rules-gate';

// ═══════════════════════════════════════════════════════════════════════════
// 0. UTIL
// ═══════════════════════════════════════════════════════════════════════════
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function isFiniteNum(n)   { return typeof n === 'number' && Number.isFinite(n); }

// ═══════════════════════════════════════════════════════════════════════════
// 1. MARKET REGIME DETECTION
// ═══════════════════════════════════════════════════════════════════════════
// Inputs (ctx):
//   adx                 — 5-min ADX(14)
//   emaFast/Mid/Slow    — EMA9, EMA20, EMA50 (last values)
//   bbWidthPctile       — Bollinger-band width percentile (0..100, last 60 bars)
//   atrPct              — ATR% of price (last)
//   vix                 — India VIX level (null if unavailable)
//   niftyFastMovePct    — |NIFTY%| over last 15 min
//   minutesSinceOpen    — minutes since 09:15 IST
//   minutesToClose      — minutes until 15:30 IST
//   isCircuitSession    — true if stock hit upper/lower circuit in last 2 days
//   isEarningsSession   — true if earnings announced today / in last 2 sessions
//   stateAgeSec         — freshness of underlying state snapshot
//
const REGIME = Object.freeze({
  TRENDING_UP:   'TRENDING_UP',
  TRENDING_DOWN: 'TRENDING_DOWN',
  SIDEWAYS:      'SIDEWAYS',
  VOLATILE:      'VOLATILE',
  NO_TRADE:      'NO_TRADE',
});

const REGIME_RULES = Object.freeze({
  NO_TRADE: {
    MAX_STATE_AGE_SEC:       5,
    MAX_VIX:                 25,   // whipsaw regime
    MAX_NIFTY_FAST_MOVE_PCT: 1.5,  // 15-min move
    OPEN_BUFFER_MINS:        10,
    CLOSE_BUFFER_MINS:       30,
  },
  TRENDING: {
    MIN_ADX:            25,
    EMA_STACK_REQUIRED: true,      // 9>20>50 (up) or 9<20<50 (down)
  },
  SIDEWAYS: {
    MAX_ADX:             20,
    MAX_BB_WIDTH_PCTILE: 30,
  },
  VOLATILE: {
    MIN_ATR_PCT:      3.0,         // wild
    MIN_BB_WIDTH_PCTILE: 80,
  },
});

function detectRegime(ctx) {
  const R = REGIME_RULES;
  // NO-TRADE gates (in priority order)
  if (isFiniteNum(ctx.stateAgeSec)   && ctx.stateAgeSec > R.NO_TRADE.MAX_STATE_AGE_SEC)                 return REGIME.NO_TRADE;
  if (isFiniteNum(ctx.vix)           && ctx.vix > R.NO_TRADE.MAX_VIX)                                    return REGIME.NO_TRADE;
  if (isFiniteNum(ctx.niftyFastMovePct) && Math.abs(ctx.niftyFastMovePct) > R.NO_TRADE.MAX_NIFTY_FAST_MOVE_PCT) return REGIME.NO_TRADE;
  if (isFiniteNum(ctx.minutesSinceOpen) && ctx.minutesSinceOpen < R.NO_TRADE.OPEN_BUFFER_MINS)          return REGIME.NO_TRADE;
  if (isFiniteNum(ctx.minutesToClose)   && ctx.minutesToClose  < R.NO_TRADE.CLOSE_BUFFER_MINS)          return REGIME.NO_TRADE;
  if (ctx.isCircuitSession === true)                                                                     return REGIME.NO_TRADE;
  if (ctx.isEarningsSession === true)                                                                    return REGIME.NO_TRADE;

  // VOLATILE — high ATR% AND wide BB → directionless chop or news-driven spasm
  if (isFiniteNum(ctx.atrPct) && ctx.atrPct >= R.VOLATILE.MIN_ATR_PCT &&
      isFiniteNum(ctx.bbWidthPctile) && ctx.bbWidthPctile >= R.VOLATILE.MIN_BB_WIDTH_PCTILE) {
    return REGIME.VOLATILE;
  }

  // TRENDING — ADX high AND EMA stack monotonic
  const stackUp   = ctx.emaFast > ctx.emaMid && ctx.emaMid > ctx.emaSlow;
  const stackDown = ctx.emaFast < ctx.emaMid && ctx.emaMid < ctx.emaSlow;
  if (isFiniteNum(ctx.adx) && ctx.adx >= R.TRENDING.MIN_ADX && stackUp)   return REGIME.TRENDING_UP;
  if (isFiniteNum(ctx.adx) && ctx.adx >= R.TRENDING.MIN_ADX && stackDown) return REGIME.TRENDING_DOWN;

  // SIDEWAYS — ADX low OR tight BB
  if ((isFiniteNum(ctx.adx) && ctx.adx < R.SIDEWAYS.MAX_ADX) ||
      (isFiniteNum(ctx.bbWidthPctile) && ctx.bbWidthPctile < R.SIDEWAYS.MAX_BB_WIDTH_PCTILE)) {
    return REGIME.SIDEWAYS;
  }

  return REGIME.SIDEWAYS;  // conservative default — better to sit out than force
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. ENTRY SYSTEM  (long-only — ProTrader intraday is cash-segment long)
// ═══════════════════════════════════════════════════════════════════════════
// All thresholds are Varsity-sourced and book-consistent. Every failure is a
// HARD reject — no "soft" entries.
const ENTRY_RULES = Object.freeze({
  MIN_VOL_RATIO:           1.5,    // current-bar vol / 20-bar avg
  BREAKOUT_BAR_MIN_VOL_RATIO: 1.5, // breakout bar specifically
  MIN_ADX:                 18,
  MIN_RR_GROSS:            1.5,
  MIN_RR_NET:              1.5,    // after brokerage + slippage
  MAX_RSI_FOR_LONG:        70,
  MIN_RSI_FOR_LONG:        40,     // bullish momentum zone (Aziz)
  BREAKOUT_CONFIRM_BPS:    5,      // close ≥ breakout + 0.05%
  PULLBACK_EMA_ATR_BAND:   0.30,   // price within ±0.30×ATR of EMA20
  MIN_DISTANCE_ATR:        0.5,    // price must be ≥0.5×ATR from nearest level
  MAX_CHASE_ATR:           0.30,   // never enter >0.30×ATR above trigger
  MAX_BARS_SINCE_TRIGGER:  3,      // Al Brooks — "miss it, skip it"
  OPEN_BUFFER_MINS:        10,
  ENTRY_CUTOFF_MINS:       345,    // 14:30 IST
  REQUIRE_ABOVE_VWAP:      true,
  REQUIRE_CANDLE_CONFIRM:  true,
});

// Breakout entry — Murphy Ch 5, Varsity M2 Ch16
function checkBuyBreakout(ctx) {
  const fail = [];
  if (ctx.regime !== REGIME.TRENDING_UP)                         fail.push('regime_not_trending_up');
  if (ctx.close < ctx.breakoutLevel * (1 + ENTRY_RULES.BREAKOUT_CONFIRM_BPS / 10000)) fail.push('candle_not_confirmed');
  if (ctx.breakoutBarVolRatio < ENTRY_RULES.BREAKOUT_BAR_MIN_VOL_RATIO) fail.push('breakout_bar_thin_vol');
  if (ctx.volRatio < ENTRY_RULES.MIN_VOL_RATIO)                  fail.push('volume_thin');
  if (ctx.adx < ENTRY_RULES.MIN_ADX)                             fail.push('adx_weak');
  if (ctx.rsi > ENTRY_RULES.MAX_RSI_FOR_LONG)                    fail.push('rsi_overbought');
  if (ctx.rsi < ENTRY_RULES.MIN_RSI_FOR_LONG)                    fail.push('rsi_weak');
  if (ctx.netRR < ENTRY_RULES.MIN_RR_NET)                        fail.push('rr_low');
  if (ctx.distToLevelInATR < ENTRY_RULES.MIN_DISTANCE_ATR)       fail.push('stuck_at_level');
  if (ENTRY_RULES.REQUIRE_ABOVE_VWAP && ctx.price <= ctx.vwap)   fail.push('below_vwap');
  if (ctx.entryOffsetFromTriggerATR > ENTRY_RULES.MAX_CHASE_ATR) fail.push('chasing');
  if (ctx.barsSinceTrigger > ENTRY_RULES.MAX_BARS_SINCE_TRIGGER) fail.push('late_entry');
  if (ctx.minutesSinceOpen < ENTRY_RULES.OPEN_BUFFER_MINS)       fail.push('within_open_buffer');
  if (ctx.minutesSinceOpen > ENTRY_RULES.ENTRY_CUTOFF_MINS)      fail.push('after_entry_cutoff');
  return { pass: fail.length === 0, failures: fail, setup: 'BREAKOUT' };
}

// Pullback entry — Aziz Ch 8, Brooks "pullback to MA"
function checkBuyPullback(ctx) {
  const fail = [];
  if (ctx.regime !== REGIME.TRENDING_UP)                             fail.push('regime_not_trending_up');
  if (!(ctx.emaFast > ctx.emaMid && ctx.emaMid > ctx.emaSlow))       fail.push('ema_stack_not_up');
  const band = ctx.atr * ENTRY_RULES.PULLBACK_EMA_ATR_BAND;
  if (!(Math.abs(ctx.price - ctx.emaMid) <= band))                   fail.push('not_at_ema20');
  if (!ctx.bullishReversalCandle)                                    fail.push('no_bull_reversal_candle');
  if (ctx.pullbackLegVolRatio >= 1.0)                                fail.push('pullback_vol_too_high'); // should dry up
  if (ctx.reversalBarVolRatio < 1.0)                                 fail.push('reversal_vol_thin');
  if (ctx.rsi > ENTRY_RULES.MAX_RSI_FOR_LONG)                        fail.push('rsi_overbought');
  if (ctx.rsi < 35)                                                   fail.push('rsi_too_weak_for_uptrend');
  if (ctx.netRR < ENTRY_RULES.MIN_RR_NET)                            fail.push('rr_low');
  if (ctx.minutesSinceOpen < ENTRY_RULES.OPEN_BUFFER_MINS)           fail.push('within_open_buffer');
  if (ctx.minutesSinceOpen > ENTRY_RULES.ENTRY_CUTOFF_MINS)          fail.push('after_entry_cutoff');
  return { pass: fail.length === 0, failures: fail, setup: 'PULLBACK' };
}

// Short-side entries deliberately blocked — cash segment is long-only.
function checkSellEntry(/*ctx*/) {
  return { pass: false, failures: ['short_disabled_cash_segment'], setup: 'SHORT' };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. EXIT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
// Three-layer exit: hard SL / hard TP / trailing logic / time stop.
// Murphy: "The stop defines the trade, not the target."
const EXIT_RULES = Object.freeze({
  SL_ATR_MULT:                   1.0,   // SL = entry − 1×ATR (min)
  SL_MIN_PCT:                    0.5,   // floor: 0.5% of entry
  TP_ATR_MULT:                   1.5,   // TP = entry + 1.5×ATR (min)
  BREAKEVEN_AT_R:                1.0,   // move SL→BE when +1R reached
  TRAIL_START_R:                 2.0,   // begin ATR trail at +2R
  TRAIL_ATR_MULT:                0.75,  // trail SL 0.75×ATR below recent swing low
  TIME_EXIT_IF_NOT_1R_MINS:      60,    // scratch if no +1R within 60 min
  HARD_SQUAREOFF_HHMM_IST:       1515,  // all flat by 15:15
});

function computeExits(entry, atr) {
  const slDist = Math.max(atr * EXIT_RULES.SL_ATR_MULT, entry * EXIT_RULES.SL_MIN_PCT / 100);
  const tpDist = Math.max(atr * EXIT_RULES.TP_ATR_MULT, slDist * 1.5);  // enforce R:R≥1.5
  return {
    sl:    +(entry - slDist).toFixed(2),
    tp:    +(entry + tpDist).toFixed(2),
    rr:    +(tpDist / slDist).toFixed(2),
    slDist: +slDist.toFixed(2),
    tpDist: +tpDist.toFixed(2),
  };
}

// Trailing logic — run on every poll while position open.
// Returns { newSL, action } where action ∈ {hold, breakeven, trail, timeExit, squareOff}.
function updateTrailingStop(posCtx) {
  // posCtx: { entry, currentPrice, currentSL, atr, initialRisk, swingLow, minutesInTrade,
  //          minutesSinceOpen, hhmmIST }
  const move  = posCtx.currentPrice - posCtx.entry;
  const rMove = posCtx.initialRisk > 0 ? move / posCtx.initialRisk : 0;

  // Hard square-off at 15:15
  if (posCtx.hhmmIST >= EXIT_RULES.HARD_SQUAREOFF_HHMM_IST) {
    return { newSL: posCtx.currentSL, action: 'squareOff', reason: 'session_squareoff_1515' };
  }

  // Time-scratch if stale at 0R
  if (posCtx.minutesInTrade >= EXIT_RULES.TIME_EXIT_IF_NOT_1R_MINS && rMove < 1.0) {
    return { newSL: posCtx.currentSL, action: 'timeExit', reason: 'no_1R_in_60min' };
  }

  // Trail at +2R → 0.75×ATR below recent swing low
  if (rMove >= EXIT_RULES.TRAIL_START_R) {
    const trailSL = Math.max(posCtx.swingLow - posCtx.atr * EXIT_RULES.TRAIL_ATR_MULT, posCtx.entry);
    if (trailSL > posCtx.currentSL) return { newSL: +trailSL.toFixed(2), action: 'trail', reason: `${rMove.toFixed(1)}R: ATR trail` };
    return { newSL: posCtx.currentSL, action: 'hold', reason: 'trail_would_lower_sl' };
  }

  // Breakeven at +1R
  if (rMove >= EXIT_RULES.BREAKEVEN_AT_R && posCtx.currentSL < posCtx.entry) {
    return { newSL: +posCtx.entry.toFixed(2), action: 'breakeven', reason: '+1R reached' };
  }

  return { newSL: posCtx.currentSL, action: 'hold', reason: `${rMove.toFixed(1)}R` };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. RISK MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════
const RISK_RULES = Object.freeze({
  MAX_RISK_PER_TRADE_PCT:    1.0,   // Varsity M9 + Aziz Ch 5
  MAX_DAILY_LOSS_PCT:        2.0,
  HALVE_AT_DAILY_LOSS_PCT:   1.5,
  MAX_POSITION_PCT_EQUITY:   30,    // single-position concentration cap
  MAX_CONCURRENT:            3,
  MAX_TRADES_PER_DAY:        5,
  COOLDOWN_AFTER_N_LOSSES:   2,
  COOLDOWN_MINS:             30,
  DRAWDOWN_TIERS: [
    { thresholdPct: 10, action: 'HALVE_SIZE'   },
    { thresholdPct: 15, action: 'QUARTER_SIZE' },
    { thresholdPct: 20, action: 'HARD_STOP'    },
  ],
});

// Position-size formula (Aziz Ch 5, Varsity M9).
function positionSize({ capital, entry, sl, dailyDrawdownPct }) {
  if (!(capital > 0) || !(entry > 0) || !(sl > 0) || !(sl < entry)) return 0;
  let riskPct = RISK_RULES.MAX_RISK_PER_TRADE_PCT;
  if (isFiniteNum(dailyDrawdownPct) && dailyDrawdownPct >= RISK_RULES.HALVE_AT_DAILY_LOSS_PCT) riskPct = riskPct / 2;
  const riskRupees = capital * (riskPct / 100);
  const perShare   = Math.max(entry - sl, 0.01);
  let qty = Math.floor(riskRupees / perShare);
  // Concentration cap
  const maxNotional = capital * (RISK_RULES.MAX_POSITION_PCT_EQUITY / 100);
  const maxQtyByCap = Math.floor(maxNotional / entry);
  qty = Math.min(qty, maxQtyByCap);
  return Math.max(1, qty);
}

function drawdownAction(equityDrawdownPct) {
  for (let i = RISK_RULES.DRAWDOWN_TIERS.length - 1; i >= 0; i--) {
    const t = RISK_RULES.DRAWDOWN_TIERS[i];
    if (equityDrawdownPct >= t.thresholdPct) return t.action;
  }
  return 'NORMAL';
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. TRADE FILTERING — REJECTION rules (hard no-trade)
// ═══════════════════════════════════════════════════════════════════════════
const REJECTION_CODES = Object.freeze({
  LOW_VOL:           'volume<1.5x_avg',
  WEAK_TREND:        'adx<18',
  DEAD_ATR:          'atrPct<0.4',
  WILD_ATR:          'atrPct>3.0',
  POOR_RR:           'netRR<1.5',
  STUCK_AT_LEVEL:    'dist_to_level<0.5_atr',
  EARLY_SESSION:     'within_open_buffer',
  LATE_SESSION:      'after_entry_cutoff',
  CIRCUIT_HIT:       'stock_circuit_recent',
  EARNINGS_DAY:      'earnings_session',
  RSI_EXTENDED:      'rsi>80',
  STALE_STATE:       'state_age>5s',
  BELOW_VWAP:        'price<=vwap',
  COUNTER_DAILY:     'daily_downtrend',
  WIDE_SPREAD:       'bid_ask_spread>0.25pct',
});

function reject(ctx) {
  const codes = [];
  if (ctx.volRatio < 1.5)                                           codes.push(REJECTION_CODES.LOW_VOL);
  if (ctx.adx < 18)                                                 codes.push(REJECTION_CODES.WEAK_TREND);
  if (isFiniteNum(ctx.atrPct) && ctx.atrPct < 0.4)                  codes.push(REJECTION_CODES.DEAD_ATR);
  if (isFiniteNum(ctx.atrPct) && ctx.atrPct > 3.0)                  codes.push(REJECTION_CODES.WILD_ATR);
  if (ctx.netRR < 1.5)                                              codes.push(REJECTION_CODES.POOR_RR);
  if (isFiniteNum(ctx.distToLevelInATR) && ctx.distToLevelInATR < 0.5) codes.push(REJECTION_CODES.STUCK_AT_LEVEL);
  if (isFiniteNum(ctx.minutesSinceOpen) && ctx.minutesSinceOpen < 10) codes.push(REJECTION_CODES.EARLY_SESSION);
  if (isFiniteNum(ctx.minutesSinceOpen) && ctx.minutesSinceOpen > 345) codes.push(REJECTION_CODES.LATE_SESSION);
  if (ctx.isCircuitSession === true)                                codes.push(REJECTION_CODES.CIRCUIT_HIT);
  if (ctx.isEarningsSession === true)                               codes.push(REJECTION_CODES.EARNINGS_DAY);
  if (isFiniteNum(ctx.rsi) && ctx.rsi > 80)                         codes.push(REJECTION_CODES.RSI_EXTENDED);
  if (isFiniteNum(ctx.stateAgeSec) && ctx.stateAgeSec > 5)          codes.push(REJECTION_CODES.STALE_STATE);
  if (isFiniteNum(ctx.price) && isFiniteNum(ctx.vwap) && ctx.price <= ctx.vwap) codes.push(REJECTION_CODES.BELOW_VWAP);
  if (ctx.dailyTrend === 'DOWNTREND')                               codes.push(REJECTION_CODES.COUNTER_DAILY);
  if (isFiniteNum(ctx.bidAskSpreadPct) && ctx.bidAskSpreadPct > 0.25) codes.push(REJECTION_CODES.WIDE_SPREAD);
  return { rejected: codes.length > 0, codes };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. PSYCHOLOGY → SYSTEM CONSTRAINTS  (Douglas — Trading in the Zone)
// ═══════════════════════════════════════════════════════════════════════════
// "The system must enforce what the trader's emotions will not."
const PSYCH_RULES = Object.freeze({
  MAX_TRADES_PER_DAY:                5,   // overtrading guard
  BLOCK_AFTER_N_CONSECUTIVE_LOSSES:  2,   // revenge-trading guard
  BLOCK_DURATION_MINS:               30,
  NEVER_WIDEN_SL:                    true, // fear-of-loss guard
  NEVER_AVERAGE_DOWN:                true, // hope guard
  NEVER_REMOVE_STOP:                 true,
  LUNCH_BLOCK_IF_MORNING_LOSSES:     true, // if ≥2 losses before 11:30, block lunch window
  LUNCH_START_HHMM_IST:              1130,
  LUNCH_END_HHMM_IST:                1330,
  AFTER_TP_COOLDOWN_MINS:            5,   // euphoria guard — don't instantly re-stack
  MIN_MINUTES_BETWEEN_TRADES:        2,
});

function psychBlock(stateCtx) {
  // stateCtx: { tradesTodayCount, consecutiveLosses, minutesSinceLastTrade,
  //             minutesSinceLastLoss, morningLossCount, hhmmIST, lastTpMinutesAgo }
  const blocks = [];
  if (stateCtx.tradesTodayCount >= PSYCH_RULES.MAX_TRADES_PER_DAY) blocks.push('overtrading_cap');
  if (stateCtx.consecutiveLosses >= PSYCH_RULES.BLOCK_AFTER_N_CONSECUTIVE_LOSSES &&
      stateCtx.minutesSinceLastLoss < PSYCH_RULES.BLOCK_DURATION_MINS) blocks.push('revenge_block');
  if (stateCtx.minutesSinceLastTrade < PSYCH_RULES.MIN_MINUTES_BETWEEN_TRADES) blocks.push('rapid_restack');
  if (isFiniteNum(stateCtx.lastTpMinutesAgo) && stateCtx.lastTpMinutesAgo < PSYCH_RULES.AFTER_TP_COOLDOWN_MINS) blocks.push('post_tp_euphoria');
  if (PSYCH_RULES.LUNCH_BLOCK_IF_MORNING_LOSSES &&
      stateCtx.morningLossCount >= 2 &&
      stateCtx.hhmmIST >= PSYCH_RULES.LUNCH_START_HHMM_IST &&
      stateCtx.hhmmIST <= PSYCH_RULES.LUNCH_END_HHMM_IST) blocks.push('lunch_post_losses');
  return { blocked: blocks.length > 0, codes: blocks };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. TRADE QUALITY SCORING (0–100)
// ═══════════════════════════════════════════════════════════════════════════
// Weights (sum = 100):
//   trend 30 · volume 25 · volatility quality 15 · structure 15 · MTF alignment 15
// This is a CLASS score — not a gate. The gate is the Varsity binary checklist.
function tradeQualityScore(ctx) {
  const trendStrength  = clamp(ctx.adx,      0, 50) / 50;              // 0..1
  const volumeStrength = clamp((ctx.volRatio - 1) / 2, 0, 1);           // 1→0, 3→1
  const volQuality     =
    (ctx.atrPct >= 0.8 && ctx.atrPct <= 2.0) ? 1.0 :
    (ctx.atrPct >= 0.4 && ctx.atrPct <= 3.0) ? 0.5 : 0.0;
  const structure      = clamp((ctx.distToLevelInATR || 0) / 1.5, 0, 1); // ≥1.5 ATR = 1
  const mtfAligned     = ctx.dailyAligned ? 1 : 0;
  const score =
    trendStrength  * 30 +
    volumeStrength * 25 +
    volQuality     * 15 +
    structure      * 15 +
    mtfAligned     * 15;
  const grade =
    score >= 80 ? 'A+' :
    score >= 70 ? 'A'  :
    score >= 60 ? 'B'  :
    score >= 50 ? 'C'  : 'D';
  return {
    score: +score.toFixed(1),
    grade,
    components: {
      trendStrength:  +trendStrength.toFixed(2),
      volumeStrength: +volumeStrength.toFixed(2),
      volQuality:     +volQuality.toFixed(2),
      structure:      +structure.toFixed(2),
      mtfAligned,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. COMMON LOSING PATTERNS → BLOCK conditions
// ═══════════════════════════════════════════════════════════════════════════
const LOSING_PATTERN_CODES = Object.freeze({
  CHASING:        'price>breakout+0.3_atr',
  LATE_ENTRY:     'bar>trigger+3',
  SIDEWAYS_TRADE: 'adx<20_and_bb_width<p30',
  VERTICAL_SPIKE: '>=3_green_without_pullback',
  THIN_BREAKOUT:  'breakout_bar_vol<1.5x',
  BIG_GAP_FADE_RISK: 'gapPct>2.0_and_bear_reversal',
  FIRST_BAR_TRADE:   'bar_index==0',
  AT_ROUND_NUMBER:   'price_within_0.05pct_of_round',
  COUNTER_EMA_STACK: 'long_but_ema9<ema20<ema50',
});

function blockLosingPattern(ctx) {
  const codes = [];
  if (isFiniteNum(ctx.entryOffsetFromTriggerATR) && ctx.entryOffsetFromTriggerATR > 0.30) codes.push(LOSING_PATTERN_CODES.CHASING);
  if (isFiniteNum(ctx.barsSinceTrigger) && ctx.barsSinceTrigger > 3)                      codes.push(LOSING_PATTERN_CODES.LATE_ENTRY);
  if (isFiniteNum(ctx.adx) && ctx.adx < 20 &&
      isFiniteNum(ctx.bbWidthPctile) && ctx.bbWidthPctile < 30)                            codes.push(LOSING_PATTERN_CODES.SIDEWAYS_TRADE);
  if (isFiniteNum(ctx.consecutiveGreenWithoutPullback) && ctx.consecutiveGreenWithoutPullback >= 3) codes.push(LOSING_PATTERN_CODES.VERTICAL_SPIKE);
  if (isFiniteNum(ctx.breakoutBarVolRatio) && ctx.breakoutBarVolRatio < 1.5)              codes.push(LOSING_PATTERN_CODES.THIN_BREAKOUT);
  if (isFiniteNum(ctx.gapPct) && ctx.gapPct > 2.0 && ctx.bearReversalOnGapBar === true)   codes.push(LOSING_PATTERN_CODES.BIG_GAP_FADE_RISK);
  if (ctx.barIndex === 0)                                                                  codes.push(LOSING_PATTERN_CODES.FIRST_BAR_TRADE);
  if (ctx.emaFast < ctx.emaMid && ctx.emaMid < ctx.emaSlow)                                codes.push(LOSING_PATTERN_CODES.COUNTER_EMA_STACK);
  if (isFiniteNum(ctx.roundNumberDistPct) && ctx.roundNumberDistPct < 0.05)               codes.push(LOSING_PATTERN_CODES.AT_ROUND_NUMBER);
  return { blocked: codes.length > 0, codes };
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. NON-NEGOTIABLE RULES — 20 hard constraints that MUST NEVER be broken
// ═══════════════════════════════════════════════════════════════════════════
// Each is a predicate that MUST evaluate TRUE. Any FALSE = trade rejected,
// regardless of score, Varsity checklist, or operator override.
const NON_NEGOTIABLE = Object.freeze([
  { id: 'NN01', rule: 'Never trade without a stop-loss',                  predicate: p => isFiniteNum(p.sl) && p.sl > 0 && p.sl < p.entry },
  { id: 'NN02', rule: 'Never risk > 1% of equity on a single trade',      predicate: p => isFiniteNum(p.riskPct) && p.riskPct <= 1.0 },
  { id: 'NN03', rule: 'Never exceed 2% daily loss',                       predicate: p => !isFiniteNum(p.dailyLossPct) || p.dailyLossPct < 2.0 },
  { id: 'NN04', rule: 'Never hold intraday position past 15:15 IST',      predicate: p => p.squareOffByHHMM === 1515 },
  { id: 'NN05', rule: 'Never average down a losing position',             predicate: p => p.averagingDownDisabled === true },
  { id: 'NN06', rule: 'Never widen SL once set',                          predicate: p => p.slWideningDisabled === true },
  { id: 'NN07', rule: 'Never enter within first 10 min of open',          predicate: p => !isFiniteNum(p.minutesSinceOpen) || p.minutesSinceOpen >= 10 },
  { id: 'NN08', rule: 'Never enter after 14:30 IST',                      predicate: p => !isFiniteNum(p.minutesSinceOpen) || p.minutesSinceOpen <= 345 },
  { id: 'NN09', rule: 'Never trade when ADX < 18',                        predicate: p => !isFiniteNum(p.adx) || p.adx >= 18 },
  { id: 'NN10', rule: 'Never trade when VIX > 25',                        predicate: p => !isFiniteNum(p.vix) || p.vix <= 25 },
  { id: 'NN11', rule: 'Never trade on thin volume (<1.5× avg)',           predicate: p => !isFiniteNum(p.volRatio) || p.volRatio >= 1.5 },
  { id: 'NN12', rule: 'Never re-enter same symbol within 30 min of SL',   predicate: p => !isFiniteNum(p.minutesSinceLastSLOnSymbol) || p.minutesSinceLastSLOnSymbol >= 30 },
  { id: 'NN13', rule: 'Never exceed 3 concurrent positions',              predicate: p => !isFiniteNum(p.concurrentOpen) || p.concurrentOpen <= 3 },
  { id: 'NN14', rule: 'Never exceed 5 trades per day',                    predicate: p => !isFiniteNum(p.tradesTodayCount) || p.tradesTodayCount < 5 },
  { id: 'NN15', rule: 'Never trade against the daily trend',              predicate: p => p.dailyTrend !== 'DOWNTREND' },
  { id: 'NN16', rule: 'Never trade during circuit-hit sessions',          predicate: p => p.isCircuitSession !== true },
  { id: 'NN17', rule: 'Never trade earnings-day stocks',                  predicate: p => p.isEarningsSession !== true },
  { id: 'NN18', rule: 'Never accept R:R < 1.5 (net of costs)',            predicate: p => !isFiniteNum(p.netRR) || p.netRR >= 1.5 },
  { id: 'NN19', rule: 'Never override the kill-switch mid-session',       predicate: p => p.killSwitchOverridden !== true },
  { id: 'NN20', rule: 'Never run LIVE without a tested paper session',    predicate: p => p.mode !== 'live' || p.paperTestPassed === true },
]);

function evaluateNonNegotiable(p) {
  const failures = NON_NEGOTIABLE
    .filter(r => { try { return !r.predicate(p); } catch (_) { return true; } })
    .map(r => ({ id: r.id, rule: r.rule }));
  return { pass: failures.length === 0, failures };
}

// ═══════════════════════════════════════════════════════════════════════════
// GATE SUBSET — net-new checks only (2026-04-20)
// ═══════════════════════════════════════════════════════════════════════════
// Why not use evaluateAll() as the gate?
// The Varsity 12-item binary checklist in scoreDayTrade already enforces most
// of what evaluateAll covers: volume ≥1.5x, ADX ≥18, RR ≥1.5, session window,
// VIX sane, daily trend not down, ATR band, EMA-stack via indicator alignment.
// Running evaluateAll after Varsity would reject on the same criteria twice
// (double-gating) and surface spurious rejections for ctx fields the caller
// legitimately cannot populate (e.g. pullback-leg vol ratio on a breakout).
//
// evaluateGateSubset runs ONLY the layers that are NET-NEW vs Varsity:
//   • regime = NO_TRADE (fast-move / circuit / earnings / state-stale)
//   • losing patterns subset (chasing / vertical-spike / counter-EMA / round
//     number / big-gap-fade) — each distinct from Varsity checks
//   • structural non-negotiables (SL present, 15:15 squareoff, avg-down &
//     widen-SL disabled, kill-switch not overridden, mode discipline)
//
// State-dependent psych / concurrency / daily-trade caps / cooldowns stay in
// agent/constraint-engine.js — they require runtime account state that
// scoreDayTrade does not see.
//
// Structural NN IDs kept in the gate:
//   NN01 — SL present and below entry
//   NN04 — 15:15 IST squareoff set
//   NN05 — average-down disabled
//   NN06 — SL widening disabled
//   NN19 — kill-switch not overridden
//   NN20 — live mode only after paper-test pass
//
// Skipped NN IDs (enforced elsewhere):
//   NN02 (1% risk), NN03 (2% daily loss), NN13 (concurrent cap),
//   NN14 (daily-trade cap), NN12 (SL-symbol cooldown) — constraint-engine
//   NN07 (open buffer), NN08 (entry cutoff), NN09 (ADX), NN10 (VIX),
//   NN11 (volume), NN15 (daily trend), NN16 (circuit), NN17 (earnings),
//   NN18 (netRR) — Varsity checklist / picks preflights
const GATE_STRUCTURAL_NN_IDS = Object.freeze(['NN01', 'NN04', 'NN05', 'NN06', 'NN19', 'NN20']);

function evaluateGateSubset(ctx, opts) {
  const o = Object.assign({ regime: true, losingPatterns: true, structuralNN: true }, opts || {});
  const failures = [];
  let regime = null;
  let losing = { blocked: false, codes: [] };
  let structuralNN = { pass: true, failures: [] };

  // ── Regime: block NO_TRADE only. SIDEWAYS/VOLATILE are not blocked here —
  //    the Varsity checklist (ADX≥18, ATR band) already prunes those cases
  //    where they matter. This keeps the gate narrow and predictable.
  if (o.regime) {
    regime = detectRegime(ctx);
    if (regime === REGIME.NO_TRADE) failures.push({ layer: 'regime', code: 'regime_no_trade' });
  }

  // ── Losing patterns subset (distinct from Varsity). Deliberately skip:
  //    LATE_ENTRY (session-window overlaps Varsity), SIDEWAYS_TRADE (ADX+BB
  //    overlaps Varsity), THIN_BREAKOUT (volume overlaps Varsity),
  //    FIRST_BAR_TRADE (first-bar rejects happen in picks preflight).
  if (o.losingPatterns) {
    const codes = [];
    if (isFiniteNum(ctx.entryOffsetFromTriggerATR) && ctx.entryOffsetFromTriggerATR > 0.30)                 codes.push(LOSING_PATTERN_CODES.CHASING);
    if (isFiniteNum(ctx.consecutiveGreenWithoutPullback) && ctx.consecutiveGreenWithoutPullback >= 3)        codes.push(LOSING_PATTERN_CODES.VERTICAL_SPIKE);
    if (isFiniteNum(ctx.emaFast) && isFiniteNum(ctx.emaMid) && isFiniteNum(ctx.emaSlow) &&
        ctx.emaFast < ctx.emaMid && ctx.emaMid < ctx.emaSlow)                                                codes.push(LOSING_PATTERN_CODES.COUNTER_EMA_STACK);
    if (isFiniteNum(ctx.gapPct) && ctx.gapPct > 2.0 && ctx.bearReversalOnGapBar === true)                   codes.push(LOSING_PATTERN_CODES.BIG_GAP_FADE_RISK);
    if (isFiniteNum(ctx.roundNumberDistPct) && ctx.roundNumberDistPct < 0.05)                                codes.push(LOSING_PATTERN_CODES.AT_ROUND_NUMBER);
    losing = { blocked: codes.length > 0, codes };
    for (const c of codes) failures.push({ layer: 'losing', code: c });
  }

  // ── Structural non-negotiables — SL/session/safety predicates the trader
  //    or the ops layer must enforce before a real order is ever placed.
  if (o.structuralNN) {
    const subset = NON_NEGOTIABLE.filter(r => GATE_STRUCTURAL_NN_IDS.includes(r.id));
    const fails = subset
      .filter(r => { try { return !r.predicate(ctx); } catch (_) { return true; } })
      .map(r => ({ id: r.id, rule: r.rule }));
    structuralNN = { pass: fails.length === 0, failures: fails };
    for (const f of fails) failures.push({ layer: 'nn', code: f.id });
  }

  return {
    version: VERSION,
    pass: failures.length === 0,
    failures,
    regime,
    losing,
    structuralNN,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSITE EVALUATION — one call returns the full verdict
// ═══════════════════════════════════════════════════════════════════════════
function evaluateAll(ctx) {
  const regime    = detectRegime(ctx);
  const rejection = reject(ctx);
  const losing    = blockLosingPattern(ctx);
  const quality   = tradeQualityScore(ctx);
  // Entry: try breakout first, else pullback
  const entryBreakout = checkBuyBreakout({ ...ctx, regime });
  const entryPullback = checkBuyPullback({ ...ctx, regime });
  const entry = entryBreakout.pass ? entryBreakout
               : entryPullback.pass ? entryPullback
               : { pass: false, failures: [...new Set([...entryBreakout.failures, ...entryPullback.failures])], setup: 'NONE' };
  const nonNeg = evaluateNonNegotiable(ctx);
  const psych  = ctx.psychCtx ? psychBlock(ctx.psychCtx) : { blocked: false, codes: [] };
  const pass =
    regime !== REGIME.NO_TRADE &&
    !rejection.rejected &&
    !losing.blocked &&
    entry.pass &&
    nonNeg.pass &&
    !psych.blocked;
  return {
    version: VERSION,
    pass,
    regime,
    rejection,
    losing,
    entry,
    quality,
    nonNeg,
    psych,
  };
}

module.exports = {
  VERSION,
  // regime
  REGIME, REGIME_RULES, detectRegime,
  // entry
  ENTRY_RULES, checkBuyBreakout, checkBuyPullback, checkSellEntry,
  // exit
  EXIT_RULES, computeExits, updateTrailingStop,
  // risk
  RISK_RULES, positionSize, drawdownAction,
  // rejection
  REJECTION_CODES, reject,
  // psychology
  PSYCH_RULES, psychBlock,
  // quality
  tradeQualityScore,
  // losing patterns
  LOSING_PATTERN_CODES, blockLosingPattern,
  // non-negotiables
  NON_NEGOTIABLE, evaluateNonNegotiable,
  // gate subset (net-new vs Varsity)
  GATE_STRUCTURAL_NN_IDS, evaluateGateSubset,
  // composite
  evaluateAll,
  // helpers
  clamp, isFiniteNum,
};
