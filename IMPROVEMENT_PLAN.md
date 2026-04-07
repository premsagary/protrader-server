# Plan: Upgrade ProTrader Ranking & Recommendation System

## Context

The existing ProTrader system at `kite-server.js` has a solid foundation — 7 TA strategies, regime-adaptive scanning, a Varsity-inspired fundamental scorer (`scoreOneStock` with 4 pillars totaling ~90 pts), a Fallen Angel detector, and MiroFish AI (5-agent debate). But after analyzing the ~18K lines of Varsity knowledge base we just compiled, there are significant gaps between what Varsity teaches and what the system actually implements. These gaps reduce signal quality, risk management, and recommendation accuracy.

**Goal:** Make the system reliable enough that the user can invest real money based on its recommendations.

---

## Gap Analysis: Current System vs Varsity Knowledge

### What's Working Well
- Regime detection (ADX + BB + RSI + volume) is sound
- 7 strategies cover the main regimes
- `scoreOneStock` has good pillar structure with peer percentile ranking
- Fallen Angel scoring is sophisticated (5 pillars + size-aware gates)
- MiroFish AI debate framework is well-designed

### Critical Gaps Found

| Area | Gap | Varsity Reference |
|------|-----|-------------------|
| **TA** | No candlestick pattern recognition (Doji, Hammer, Engulfing, Morning Star) | Module 2 Ch 5-11 |
| **TA** | No multi-timeframe analysis — only 5min for scans, daily for scoring | Module 2 Ch 18 |
| **TA** | No Fibonacci retracement/extension levels | Module 2 Ch 16 |
| **TA** | MACD used only as filter, not standalone strategy | Module 2 Ch 15 |
| **TA** | ADX computed as single value — +DI/-DI crossover signals ignored | Module 2 Ch 21 |
| **FA** | No ROCE (Varsity says it's the #1 capital efficiency metric) | Module 3 Ch 8 |
| **FA** | No Free Cash Flow analysis or CFO/PAT ratio (earnings quality) | Module 3 Ch 10-11 |
| **FA** | No intrinsic value via DCF model | Module 13 Ch 7-9 |
| **FA** | No DuPont decomposition of ROE | Module 3 Ch 8 |
| **FA** | No sector-specific KPIs (NIM for banks, clinker for cement, etc.) | Module 15 |
| **FA** | Only 1Y growth — no 3Y/5Y consistency checks | Module 3 Ch 13 |
| **Risk** | Fixed position size (₹7,500) — no volatility or Kelly-based sizing | Module 9 Ch 11-14 |
| **Risk** | Fixed stop-loss % — no ATR-based dynamic stops | Module 9 Ch 11 |
| **Risk** | No portfolio correlation check — could hold 10 correlated stocks | Module 9 Ch 4-5 |
| **Risk** | No drawdown circuit breaker | Module 9 Ch 6 |
| **Risk** | No sector concentration limit | Module 9 Ch 8 |
| **Risk** | No portfolio-level Sharpe/Sortino tracking | Module 9 Ch 10 |
| **Reco** | No composite rank (TA + FA + risk-adjusted) | Module 10 |
| **Reco** | No conviction tiers — everything is just sorted by signal_score | Module 10 Ch 5 |
| **Reco** | No time horizon differentiation (intraday/swing/positional) | Module 10 Ch 4 |
| **Reco** | No sector diversification in recommendations | Module 9 Ch 8 |
| **Reco** | No Open Interest analysis for sentiment confirmation | Module 4 Ch 12 |

---

## Implementation Plan — 6 Phases

### Phase 1: Enhanced Technical Indicators & Signals
**Files:** `kite-server.js` (indicator functions + new strategies)

**1a. Add Missing Indicators**
- `macd(closes, fast=12, slow=26, signal=9)` → returns {macdLine, signalLine, histogram}
  - Currently MACD is computed inside `computeTechnicals` but not as a reusable function
- `fibonacci(high, low)` → returns retracement levels {0.236, 0.382, 0.5, 0.618, 0.786}
- `stochastic(candles, kPeriod=14, dPeriod=3)` → returns {K, D} (currently computed but not exposed)
- `ichimoku(candles)` → {tenkan, kijun, senkouA, senkouB, chikou} — Varsity M2 Ch 21

**1b. Candlestick Pattern Recognition** (Varsity Module 2 Ch 5-11)
- `detectCandlePatterns(candles)` function returning array of detected patterns:
  - Single: Marubozu, Spinning Top, Doji, Paper Umbrella (Hammer/Hanging Man)
  - Double: Bullish/Bearish Engulfing, Piercing/Dark Cloud Cover, Harami
  - Triple: Morning Star, Evening Star, Three White Soldiers, Three Black Crows
- Each pattern returns: `{pattern, type: "bullish"|"bearish", reliability: 1-3, candle_index}`
- Integrate as confirmation filter in existing strategies (not standalone — Varsity says patterns need context)

**1c. MACD Crossover Strategy** (new `stratMACDCrossover`)
- Signal line crossover + histogram reversal
- Combine with zero-line cross for trend confirmation
- Add as option in TRENDING regime alongside EMA crossover

**1d. Multi-Timeframe Confirmation**
- In `selectAndRunStrategy()`: before generating BUY signal on 5min, check daily trend direction
- Daily trend bullish + 5min BUY = higher conviction
- Daily trend bearish + 5min BUY = lower conviction (reduce score by 30%)
- Use existing daily candle data from `refreshAllFundamentals()`

---

### Phase 2: Upgraded Fundamental Scoring
**Files:** `kite-server.js` (`scoreOneStock`, `refreshAllFundamentals`, Screener import)

**2a. Add Missing FA Metrics** (data already partially available from Screener.in)
- **ROCE** = EBIT / Capital Employed — Varsity M3 Ch 8: "ROCE > 15% = generating real returns above cost of capital"
  - Add to Screener import pipeline + `scoreOneStock` Pillar 1 (6 pts)
- **Free Cash Flow** = CFO - Capex — Varsity M3 Ch 10: "Positive FCF = business generates real cash"
  - FCF/PAT ratio > 0.8 = high quality earnings (3 pts bonus)
  - Negative FCF for 3+ years = red flag (-5 pts penalty)
- **DuPont Decomposition**: ROE = Net Margin × Asset Turnover × Equity Multiplier
  - Identify HOW ROE is generated (margin-led vs leverage-led vs turnover-led)
  - Leverage-led ROE with D/E > 2 = fragile quality → reduce ROE pillar by 30%

**2b. Growth Consistency Checks** (Varsity M3 Ch 13)
- Replace single-year growth with multi-year framework:
  - `epsGr1y`, `epsGr5y` (already imported from Screener) — check both
  - `salesGr1y`, `salesGr5y` — same
  - Consistency bonus: if both 1Y and 5Y EPS growth > 10%, add 3 pts
  - Inconsistency penalty: if 1Y growth > 30% but 5Y < 5%, flag as "cyclical spike" (-2 pts)
- ROE consistency: compare `roe` vs `roe3yAvg` vs `roe5yAvg` (all available from Screener)
  - Improving ROE trend = +2 pts, deteriorating = -2 pts

**2c. Sector-Specific Scoring** (Varsity Module 15)
- Create `SECTOR_KPI_WEIGHTS` map:
  - **Banking:** Primary metric = NIM, CAR, GNPA/NNPA, CASA ratio (P/B > P/E for valuation)
  - **IT:** Revenue in CC terms, order book, utilization rate
  - **Cement:** Capacity utilization, freight cost/ton, EBITDA/ton
  - **Auto:** Realization per unit, EV transition readiness
  - **Steel:** EBITDA/ton, captive mine %
  - **Insurance:** Combined ratio, solvency ratio, VNB margin
- When sector matches, apply sector-specific weights in `scoreOneStock` instead of generic thresholds
- For banking: use P/B instead of P/E in Valuation pillar, NIM as quality signal

**2d. Simplified Intrinsic Value Estimate** (Varsity Module 13)
- Not full DCF (needs too much manual input), but a growth-based fair value:
  - `Fair PE = EPS Growth Rate × 1.5` (PEG-based, Varsity M3)
  - `Intrinsic Value = Fair PE × TTM EPS`
  - `Margin of Safety = (Intrinsic Value - CMP) / Intrinsic Value × 100`
  - Margin of Safety > 25% = +5 pts in Valuation pillar
  - Trading above intrinsic value by > 30% = -3 pts (overvalued)

---

### Phase 3: Risk Management Overhaul
**Files:** `kite-server.js` (`CONFIG`, `scanAndTrade`, new risk functions)

**3a. Volatility-Based Position Sizing** (Varsity M9 Ch 11-13)
- Replace fixed `CAPITAL_PER_TRADE: 7500` with:
  ```
  Position Size = (Account × Risk%) / (Entry - StopLoss)
  Risk% = min(2%, Kelly/2)  // half-Kelly for safety
  Kelly = WinRate - (LossRate / AvgWin÷AvgLoss)
  ```
- Compute Kelly from last 50 closed trades (rolling window)
- Floor: 0.5% of capital per trade, Ceiling: 3%

**3b. ATR-Based Dynamic Stop-Losses** (Varsity M9 Ch 11)
- Replace fixed SL percentages (1.5%-2%) with:
  - `Stop Loss = Entry - (ATR(14) × multiplier)`
  - Multiplier by regime: TRENDING=2.5, RANGING=1.5, BREAKOUT=2.0, MOMENTUM=2.0
- Target = Entry + (ATR × multiplier × risk_reward_ratio)
  - Default risk_reward = 2.0 (Varsity: minimum acceptable)
- Trailing stop: once trade is 1 ATR in profit, trail stop at 1.5 ATR from high

**3c. Portfolio Correlation Guard** (Varsity M9 Ch 4-5)
- Before opening new position, compute correlation with existing open positions:
  - Use last 20 daily returns for each stock pair
  - If correlation > 0.7 with any open position, skip or flag
- Sector concentration limit: max 3 positions in same sector
- Max portfolio beta: 1.5 (computed as weighted average of individual betas)

**3d. Drawdown Circuit Breaker** (Varsity M9 Ch 6)
- Track equity curve of paper trading account
- If drawdown from peak > 10%, reduce position sizes by 50%
- If drawdown > 15%, pause new entries for 24 hours
- If drawdown > 20%, halt all trading and alert user
- Recovery rule: resume normal sizing only after equity recovers to -5% from peak

**3e. Portfolio Metrics Dashboard** (Varsity M9 Ch 10)
- Compute and expose via `/paper-trades/stats`:
  - Sharpe Ratio = (Avg Return - Risk Free) / StdDev of Returns
  - Sortino Ratio = (Avg Return - Risk Free) / Downside StdDev
  - Max Drawdown and recovery time
  - Win rate, average win/loss ratio, expectancy
  - Profit Factor = Gross Wins / Gross Losses

---

### Phase 4: Composite Ranking & Recommendation Engine
**Files:** `kite-server.js` (`/api/stocks/recommendations` endpoint)

**4a. Composite Score Formula**
Replace current "sort by signal_score" with a multi-factor composite:
```
Composite = (FA_Score × 0.35) + (TA_Score × 0.25) + (Momentum_Score × 0.20) + (Risk_Score × 0.20)
```
Where:
- `FA_Score` = existing `scoreOneStock` output (0-100)
- `TA_Score` = normalized signal from `selectAndRunStrategy` (map -10..+10 → 0..100)
- `Momentum_Score` = price momentum factor:
  - 52-week return percentile rank (30%)
  - 6-month return (30%)
  - 1-month return (20%)
  - Relative strength vs Nifty 50 (20%)
- `Risk_Score` = inverse of risk (lower risk = higher score):
  - 100 - (Beta × 20) - (Annual Volatility percentile × 0.3) - (D/E percentile × 0.2)
  - Capped at 0-100

**4b. Conviction Tiers** (Varsity M10 Ch 5)
Based on composite score + signal agreement:
- **Strong Buy (Tier 1):** Composite > 75, FA > 60, TA BUY signal, above 200 DMA, healthy RSI
- **Buy (Tier 2):** Composite > 60, FA > 50, TA BUY or NEUTRAL-positive
- **Accumulate (Tier 3):** Composite > 50, FA > 45, fallen angel candidate
- **Watch (Tier 4):** Composite 40-50, mixed signals
- **Avoid:** Composite < 40 or any red flag active

**4c. Time Horizon Differentiation**
Three recommendation lists from one engine:
- **Intraday:** Pure TA signals from 5min scan (existing `scanAndTrade`)
- **Swing (1-4 weeks):** Daily TA + momentum — use daily candles, RSI oversold bounce, BB squeeze
- **Positional (1-12 months):** FA-heavy composite + trend (above 200DMA, golden cross, strong fundamentals)

**4d. Sector-Diversified Output**
- Recommendations must include max 2 stocks per sector
- If 5 banking stocks are top-scored, only show top 2 + next best from other sectors
- Final output: top 10 recommendations, diversified across at least 4 sectors

**4e. OI-Based Sentiment Layer** (Varsity M4 Ch 12)
For stocks with F&O data (Nifty 50 + F&O stocks):
- Fetch Open Interest from Kite API
- Apply OI interpretation framework:
  - Price ↑ + OI ↑ = Long buildup (bullish confirmation) → +1 conviction
  - Price ↑ + OI ↓ = Short covering (weak rally) → -1 conviction  
  - Price ↓ + OI ↑ = Short buildup (bearish) → -1 conviction
  - Price ↓ + OI ↓ = Long unwinding (weak decline) → neutral
- Put-Call Ratio: PCR > 1.2 = bullish, PCR < 0.7 = bearish

---

### Phase 5: Enhanced MiroFish AI Integration
**Files:** `kite-server.js` (MiroFish agent prompts + synthesis)

**5a. Feed Composite Score to AI Agents**
- Currently agents receive raw data — add composite score + conviction tier
- Add sector-specific context from Module 15 to agent prompts
- Add historical accuracy of past predictions (feedback loop)

**5b. Backtest Validation Agent (New — Agent #6)**
- Before final synthesis, run a "Backtest" agent that:
  - Checks if similar setups in the past (same regime + strategy + score range) were profitable
  - Uses paper trade history as training data
  - Returns confidence multiplier (0.5x to 1.5x) based on historical hit rate

**5c. Macro Context Agent Enhancement**
- Feed current market regime (from `detectRegime`) to all agents
- Add Nifty 50 trend direction as context
- Add VIX level (India VIX from Kite) as fear/greed indicator
- Add FII/DII flow direction if available

---

### Phase 6: Backtesting & Validation Framework
**Files:** new function `backtestStrategy()` in `kite-server.js`

**6a. Walk-Forward Backtester** (Varsity M10 Ch 7-8)
- For each strategy, backtest on last 1 year of daily data:
  - Split: 70% in-sample (train), 30% out-of-sample (validate)
  - Track: win rate, avg win/loss, max drawdown, Sharpe ratio, profit factor
- Auto-disable strategies that show < 45% win rate or Sharpe < 0.5 in out-of-sample
- Expose results via `/api/backtest/results`

**6b. Strategy Performance Leaderboard**
- Track each strategy's real-time paper trading performance
- Adjust strategy weights in `selectAndRunStrategy` based on recent performance:
  - Top performer in last 30 days gets 60% weight (up from 50%)
  - Worst performer gets 10% (down from 20%)
- Auto-adapt: regime detection + performance feedback = self-improving system

**6c. Recommendation Accuracy Tracking**
- For every recommendation emitted, track:
  - Was it profitable after 1 day, 1 week, 1 month?
  - What was the max adverse excursion (MAE)?
  - What was the max favorable excursion (MFE)?
- Expose hit rate by conviction tier: "Strong Buy was right 72% of the time"
- Use this data to calibrate conviction thresholds

---

## Implementation Priority

| Priority | Phase | Impact | Effort |
|----------|-------|--------|--------|
| 1 | Phase 3 (Risk Management) | **Critical** — without this, real money is dangerous | Medium |
| 2 | Phase 4 (Composite Ranking) | **High** — transforms signal noise into clear recommendations | Medium |
| 3 | Phase 2 (FA Upgrade) | **High** — quality scoring directly affects recommendation quality | Medium |
| 4 | Phase 1 (TA Indicators) | **Medium** — adds confirmation signals but current TA is decent | Medium |
| 5 | Phase 6 (Backtesting) | **Medium** — validates everything and enables self-improvement | High |
| 6 | Phase 5 (MiroFish) | **Low-Medium** — nice-to-have polish on already-working AI system | Low |

---

## Critical Files to Modify

- **`kite-server.js`** — all changes go here (monolithic architecture)
  - Lines 728-805: indicator functions (Phase 1)
  - Lines 811-862: `detectRegime` (Phase 1d)
  - Lines 868-1091: strategy library + selector (Phase 1)
  - Lines 1097-1106: `CONFIG` object (Phase 3)
  - Lines 1116-1200: `scanAndTrade` (Phase 3, 4)
  - Lines 3006-3156: `refreshAllFundamentals` (Phase 2)
  - Lines 3790-3983: `scoreOneStock` (Phase 2)
  - Lines 4004-4299: `scoreFallenAngel` (Phase 2)
  - Lines 5514-5598: `/api/stocks/recommendations` (Phase 4)
  - Lines 6802-7014: MiroFish agents (Phase 5)

## Verification Plan

1. **Unit test each new indicator** against known values (e.g., RSI of NIFTY should match TradingView)
2. **Run scoring before/after** on 10 known stocks — verify scores make sense
3. **Paper trade for 1 week** with new risk management — verify position sizes, stops, correlation guards work
4. **Compare recommendations** old vs new — new should be more diversified and conviction-tiered
5. **Backtest validation** — run Phase 6 backtester, confirm strategies perform in out-of-sample
6. **Check all existing endpoints** still work (`/paper-trades`, `/api/stocks/score`, `/api/stocks/recommendations`, `/api/mirofish/*`)
