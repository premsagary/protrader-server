# The Intraday Trader's Playbook

A comprehensive reference synthesized from the documented methodologies of Linda Raschke, Al Brooks, Mark Fisher, Subasish Pani, P R Sundar, Mitesh Patel, Mark Minervini, William O'Neil, Stan Weinstein, Jesse Livermore, Stanley Druckenmiller, Paul Tudor Jones, Richard Dennis (Turtles), Van Tharp, Renaissance Technologies, and the academic literature on Auction Market Theory.

The goal: every detail a serious intraday trader needs, in one document.

---

# Part 1: Foundations

## 1.1 The 3 mental models

### 1.1.1 Probabilistic, not deterministic

Renaissance Technologies' Medallion Fund — the most profitable quantitative fund in history — wins on only **50.75% of trades**. They make money because they trade ~150,000 times per day and a tiny statistical edge × massive volume = ~$100B+ in profits.

The signal that "this trade will work" is **not** 90% confident. It's 51% confident. The pro internalizes this. The amateur thinks they need to be 80% sure to enter.

### 1.1.2 Asymmetric expectations

Paul Tudor Jones publicly states he requires a **5:1 reward-to-risk ratio**. With 5:1, a trader can be wrong 80% of the time and still break even.

Stanley Druckenmiller: *"It's not whether you're right or wrong that's important, but how much money you make when you're right and how much you lose when you're wrong."*

The math: high win-rate is a vanity metric. Edge per trade (R-multiple expectancy) is what pays.

### 1.1.3 Process IS the edge

A trade is not "good" because it made money. A trade is good if it followed your system's rules.

A losing trade that followed rules is a *correct* trade.
A winning trade that broke rules is a *wrong* trade — even though it paid.

This is the single hardest principle for amateurs to accept. Pros measure themselves on **rule-following %**, not P&L.

## 1.2 The 5-layer system

Every working intraday system has all 5 layers. Amateurs only have layers 2-3.

| # | Layer | Question it answers |
|---|-------|---------------------|
| 1 | Universe selection | What do I even look at? |
| 2 | Setup detection | When do conditions favor a trade? |
| 3 | Trigger confirmation | What's the specific moment to pull the trigger? |
| 4 | Position sizing | How much should I bet? |
| 5 | Exit construction | How and when do I get out? |

Van Tharp's research, replicated multiple times: **position sizing accounts for 91% of return variability** in tested systems. Entry signals account for ~5%.

## 1.3 What separates pros from amateurs

| Dimension | Amateur | Pro |
|---|---|---|
| Time spent on entries | 90% | 10% |
| Time spent on exits | 10% | 50% |
| Time spent on risk sizing | ~0% | 30% |
| Time spent on review | ~0% | 10% |
| Trades per day | Variable, often 10+ | 1-3 typically |
| Universe size | Whole market | 30-50 names, deeply known |
| Setup count | "Whatever looks good" | 2-4 specific patterns |
| Risk per trade | Whatever feels right | Pre-decided, never exceeded |

---

# Part 2: Pre-Market Routine (8:00 - 9:14 IST)

Every consistent intraday trader has a 30-60 minute pre-market ritual. Skipping it = trading blind.

## 2.1 The 8:30 IST checklist

```
[ ] Global cues
    [ ] US close (S&P, Nasdaq, Dow)
    [ ] Asian opens (Nikkei, Hang Seng, Shanghai)
    [ ] Currency moves (DXY, USD/INR)
    [ ] Crude oil overnight
    [ ] Bond yields (US 10Y, India 10Y)
    [ ] Geopolitical events (any breaking news)

[ ] Indian-specific
    [ ] Gift Nifty (formerly SGX Nifty) gap
    [ ] India VIX overnight % change
    [ ] FII/DII flows from D-1
    [ ] Sector indices D-1 closes

[ ] Today's calendar
    [ ] Earnings releases today (premarket / postmarket)
    [ ] Economic data scheduled (RBI, GDP, CPI, etc.)
    [ ] Stocks ex-dividend today
    [ ] Stocks in F&O ban today
    [ ] Stocks announced for index inclusion/exclusion

[ ] Yesterday's tape
    [ ] Top gainers / losers
    [ ] Highest volume names
    [ ] Sector that led / lagged
    [ ] Closing trend (last hour direction)
    [ ] Pivot levels for today (computed from D-1 H/L/C)

[ ] My state
    [ ] Yesterday's P&L (am I tilted from a loss / overconfident from a win?)
    [ ] Sleep quality (don't trade if <5 hours)
    [ ] Personal stress level
    [ ] Capital available
    [ ] Any positions still open from yesterday (BTST etc.)
```

## 2.2 Bias formation: the day_bias_score

Compose 4-6 inputs into a single -4 to +4 directional bias for the day:

| Signal | Bullish (+1) | Bearish (-1) |
|--------|--------------|--------------|
| Gift Nifty gap | > +0.5% | < -0.5% |
| VIX overnight Δ | < -1% (risk-on) | > +2% (risk-off) |
| Yesterday FII flow | > +500 cr | < 0 cr |
| Yesterday DII flow | > +500 cr | < 0 cr |
| 3-day rolling pivot vs Nifty futures | Above pivot | Below pivot |
| Asian markets at 8:55 IST | Up > 0.3% | Down > 0.3% |

- Score ≥ +2 → BULL bias day (longs preferred, shorts only A+)
- Score in [-1, +1] → NEUTRAL day (both directions equal)
- Score ≤ -2 → BEAR bias day (shorts preferred, longs only A+)

## 2.3 Pre-open call auction (9:00 - 9:08 IST)

The order book during this 8-minute window is the single most under-utilized data source in retail trading.

**What you can read:**
- Equilibrium price (where most volume would clear)
- Buy/sell imbalance ratio per stock
- Stocks gapping > 2% with strong imbalance = high-conviction directional bets by institutions
- Stocks with thin pre-open volume = avoid (illiquid open)

**Action:**
- Note 5-10 stocks with strongest pre-open conviction
- Mark which side (buy or sell imbalance)
- These become your watchlist for first 30 min of session

## 2.4 Watchlist construction (9:10 IST)

Final list of 5-15 stocks you'll actively monitor today:

1. **News-driven** (3-5): stocks with overnight catalysts
2. **Pre-open conviction** (3-5): from call auction
3. **Sector leaders** (2-3): top stocks in today's strongest pre-open sector
4. **Setup carriers** (2-5): stocks that ended yesterday in known patterns (NR4, inside bar, near level)

Do NOT watch the whole market. The point of pre-market is to narrow.

---

# Part 3: Universe Selection

## 3.1 Mark Minervini's Trend Template (the gold standard for stock selection)

For any LONG entry, all 8 must be true:

1. Price above 150-day MA AND 200-day MA
2. 150-day MA above 200-day MA
3. 200-day MA trending up for at least 1 month (preferably 4-5 months)
4. 50-day MA above both 150-day and 200-day MA
5. Current price above 50-day MA
6. Current price at least 30% above 52-week low
7. Current price within 25% of 52-week high
8. Relative Strength rating ≥ 70 (top 30% of stocks)

If any fails, don't trade the long side. This filter alone eliminates ~95% of stocks at any time.

## 3.2 William O'Neil's CANSLIM

Each letter is a specific quantitative filter:

- **C** = Current quarterly earnings up at least 25% YoY
- **A** = Annual earnings up at least 25% in last 3 years; ROE > 17%
- **N** = New product, new management, or new high
- **S** = Supply/demand — float < 50M preferred; volume on up-days > 50% above avg
- **L** = Leader, not laggard — RS rating > 80
- **I** = Institutional sponsorship — 3-10 quality funds owning the stock
- **M** = Market direction — only buy when M is in confirmed uptrend

## 3.3 Stan Weinstein's 4-stage analysis (using 30-week MA)

The simplest and most durable framework in technical analysis.

| Stage | Description | 30-week MA | Action |
|-------|-------------|------------|--------|
| 1: Base | Sideways consolidation after downtrend | Flat | Watch, don't buy yet |
| 2: Advancing | Breakout above resistance with rising MA | Rising | **BUY** |
| 3: Distribution | Topping pattern, MA flattens | Flattening | Take profits / hold half |
| 4: Declining | Breakdown below support, MA falling | Falling | **NEVER OWN. EXIT.** |

**Iron rule**: never own a stock trading below a declining 30-week MA. Even if it's "cheap" or "value." Stage 4 stocks lose 50-90%.

## 3.4 Pani's intraday universe (Indian context)

~30-50 stocks total selected as:
- Nifty 50 + Bank Nifty constituents
- Plus 5-10 Next 50 names with strong daily ATR
- Excludes: stocks with daily ATR < 1% (no juice) or > 4% (too unpredictable)
- Excludes: stocks with < ₹50 cr daily turnover (illiquid)
- Excludes: F&O-ban list

## 3.5 Tier classification (A-list / B-list / SKIP)

Based on combining Minervini structural + Pani liquidity + day_bias alignment:

**A-list** (max ~5-15 names):
- ATR 1-4%, turnover ≥ ₹50 cr
- Sector strong (top 6 of 11 indices)
- Daily trend aligned with day_bias
- Optional: institutional ownership rising

**B-list** (~15-30 names):
- ATR + turnover criteria met
- Either sector OR trend aligned, not both

**SKIP**: anything else (don't waste cycles)

---

# Part 4: The Complete Setup Library

## 4.1 Linda Raschke — the queen of intraday patterns

Raschke's full pattern catalog. She trades 50-200 trades/year discretionary, all intraday-to-3-day max hold.

### 4.1.1 Holy Grail (her signature setup)

**Logic**: strong trends pull back to 20-EMA and resume. Highest probability setup in trending markets.

**Rules**:
1. ADX(14) > 30 (trend confirmed)
2. +DI above -DI (longs); -DI above +DI (shorts)
3. Price retraces and TOUCHES 20-EMA in trend direction
4. Wait for one bar that touches but does NOT close beyond the 20-EMA
5. Entry: above the high of that touch bar (long) / below low (short)
6. Stop: below recent swing low (long) / above swing high (short)
7. Target: minimum 1.5R; ideal hold until ADX drops below 25

**Win rate research**: ~65-70% when ADX > 30; drops to ~45% when ADX < 25.

### 4.1.2 Turtle Soup (mean reversion at extremes)

**Logic**: ~70% of new 20-day breakouts FAIL. Catch the failure.

**Rules**:
1. Today makes a NEW 20-day low
2. The low has at least 4 calendar-day separation from previous 20-day low
3. The low forms in the LATTER half of the trading day
4. Price closes back above the previous 20-day low within same day or next day
5. Entry: long, just above prior 20-day low
6. Stop: 1 cent below today's new low
7. Target: middle of recent range; trail rest

Inverse "Turtle Soup Plus" for fading new 20-day highs.

### 4.1.3 80-20 (next-day reversal)

**Logic**: when a session opens at one extreme of its range and closes at the other, momentum is exhausted.

**Rules**:
1. Today's open in the bottom 20% of today's range
2. Today's close in the TOP 80% (or higher) of today's range
3. Tomorrow: wait for price to trade 5-15 ticks BELOW today's low
4. When price trades back above today's low, enter long
5. Stop: just below today's low
6. Target: 50% retracement of today's range

### 4.1.4 Anti (counter-trend setup)

**Logic**: in a bigger trend, a counter-trend pullback eventually fails.

**Rules**:
1. Strong trend (ADX > 30) on higher timeframe
2. Pullback against the trend on lower timeframe creates a counter-trend "wave"
3. When pullback shows exhaustion (lower volume, narrower bars), trend resumes
4. Entry: when price breaks out of pullback consolidation in trend direction
5. Stop: opposite side of pullback range
6. Target: minimum 2R, trail with prior swing structure

### 4.1.5 3 Little Indians

**Logic**: 3 successive small advances without a real correction = exhaustion top.

**Rules**:
1. Identify 3 consecutive higher pivot highs of similar size
2. Each "Indian" advance is smaller than 100% of the previous
3. Volume should be declining on each successive Indian
4. Enter short on confirmed reversal (lower low or close below last pivot)
5. Stop above the highest Indian
6. Target: midpoint of the formation, then trail

### 4.1.6 2B Reversal (Sperandeo)

**Logic**: marginal new high/low followed by failure = strongest reversal pattern.

**Rules**:
1. New high of recent range (or new low for short)
2. Failure to extend significantly (< 1% beyond)
3. Price closes back inside range
4. Entry: opposite direction
5. Stop: at the marginal extreme
6. Target: opposite side of range

### 4.1.7 VWAP Fade (Raschke's intraday version)

**Logic**: in ranging session, fade extension from VWAP back toward VWAP.

**Rules**:
1. VWAP slope flat (range day signal)
2. Price stretches > 2% from VWAP
3. RSI extreme (>70 for fade-short, <30 for fade-long)
4. Reversal candle forms
5. Entry: in direction back toward VWAP
6. Stop: just beyond extreme high/low of day
7. Target: VWAP

## 4.2 Al Brooks — Price Action System

Brooks famously trades ES (S&P E-mini) on 5-min charts with ONE indicator: 20-EMA. His complete system:

### 4.2.1 The H1, H2, H3, H4 / L1, L2, L3, L4 setups

**Logic**: in trending or sideways market, pullbacks have characteristic shapes.

- **H1 (High 1)**: First bar in upward correction whose high is above prior bar's high. Lowest probability.
- **H2**: After H1, price makes a lower high, then another bar with high above prior. **Highest probability in trend.**
- **H3**: Third instance. Slightly weaker.
- **H4**: Fourth instance. Trend likely exhausted; consider counter-trend.

**Entry**: buy 1 tick above H2 bar's high.
**Stop**: 1 tick below the prior swing low.
**Target**: 2× signal bar height, or recent swing high.

Inverse: L1, L2, L3, L4 for shorts.

### 4.2.2 Always-In Position

Brooks teaches that 5-min charts have only 3 modes:
- **Always-In Long**: likely next move is up
- **Always-In Short**: likely next move is down
- **Trading Range**: unclear, skip

Rule: if you can't identify Always-In direction, don't trade. Most amateur losses come from trading the trading-range mode pretending it's trending.

### 4.2.3 First-Bar Entry

If the first 5-min bar of the day forms a strong trend bar (close in top/bottom 20% of bar's range), enter at bar close in that direction. SL at opposite extreme.

### 4.2.4 Failure Rule

If entry doesn't see follow-through within 3 bars, exit at breakeven.

### 4.2.5 Two-legged pullback

In a strong trend, wait for 2 pullback waves before entering. The first pullback often reverses; the second is more reliable.

### 4.2.6 Wedge / Final Flag

Three pushes in trend direction with each successively shorter. Enter counter-trend on break.

### 4.2.7 Trading-Range fades

Inside a clear range, fade extreme touches:
- Buy near range low when bullish reversal candle forms
- Sell near range high when bearish reversal candle forms

## 4.3 Mark Fisher — ACD Method

The most rigorous opening-range system. Used by hedge funds.

### 4.3.1 Setup
- **Opening Range (OR)**: first 5, 15, or 30 minutes (Fisher uses 15 min for equities, 5 for futures)
- **A-up**: breakout above OR high by a noise filter (typically 0.10-0.15× OR range)
- **A-down**: breakdown below OR low by similar filter
- **B-up**: failure point. If price came back into OR after going A-up, it's a failed A-up — short at B level
- **C-up**: continuation level above A. After successful A-up, entering C confirms trend
- **D**: stop level. Opposite of C

### 4.3.2 The 4 Trading Zones

Once OR is established:
1. **Above C**: strong long trend. Buy pullbacks to A.
2. **Between A and C**: consolidating. Range-trade A to C.
3. **Inside OR**: chop. Don't trade.
4. **Below B**: strong short trend. Sell rallies to D.

### 4.3.3 Pivot Range (Fisher's 3-day rolling)

The 3-day rolling pivot: simple average of last 3 days' (H+L+C)/3.
- Above 3-day pivot: market value rising → bullish bias
- Below: bearish bias
- Crosses 3-day pivot: regime change signal

### 4.3.4 The "Failed A" Rubber Band Trade

When price reaches A but reverses without holding:
- A-up breaks but reverses below A within first 2 bars after breaking → short with stop above A high
- Highest-probability trade in ACD because trapped longs fuel the fade

## 4.4 Subasish Pani — 12 Setups (Indian intraday)

The most documented Indian intraday system.

### 4.4.1 Opening Range Breakout (ORB)

1. Mark 9:15-9:30 H/L
2. Wait for 5-min close beyond OR with vol > 1.5× avg
3. Stop at OR midpoint; Target = OR width projected
4. Skip if no break by 11:00

### 4.4.2 5 EMA Strategy

1. Daily chart: only trade with 50-EMA direction
2. Intraday 15-min: wait for 5-EMA pullback
3. Enter on candle that closes back toward EMA direction
4. Stop below pullback low
5. Trail with 5-EMA

### 4.4.3 Inside Candle / NR4

1. Identify candle whose entire range is INSIDE previous candle's range
2. Or NR4: smallest range candle of last 4
3. Wait for breakout above inside candle's high (long) or below low (short)
4. Volume on breakout > 1.5× avg
5. Stop at opposite side of inside candle
6. Target: 1.5R minimum

### 4.4.4 Traffic Light Setup

1. Look for one green + one red candle pair (or vice versa) on 15-min
2. Mark high and low of that pair
3. Enter on 5-min close beyond high or low
4. Stop at opposite side of pair

### 4.4.5 NR21 + VWAP

1. 21-bar narrowest range candle
2. Combined with VWAP context for direction bias
3. Entry: break in VWAP direction
4. Stop: opposite extreme

### 4.4.6 Reversal at Resistance

1. Failed breakout at major level
2. Reversal candle at level
3. Enter counter-trend
4. Stop above level (for shorts)
5. Target mid-range

### 4.4.7 9:20 Short Straddle (Pani's options income)

1. At 9:20 AM, identify ATM strike of Bank Nifty (or Nifty)
2. Sell 1 lot CE + 1 lot PE at the same ATM strike
3. Stop-loss: 30% of premium collected on EITHER side
4. Target: 50% of premium decay
5. Time exit: square off by 3:15 PM regardless

Win rate ~65-70% over years. The 30% losing trades are often big.

### 4.4.8 BTST (Buy Today Sell Tomorrow)

1. Last 30 min strong close + sector strong
2. Volume above average in afternoon
3. Buy at 3:15 close
4. Sell next day at open
5. Stop: below day low

### 4.4.9 Volume Spike + Price Action

1. Volume > 2× avg + bullish/bearish candle
2. Entry beyond signal candle
3. Stop opposite side
4. Target 1.5R

### 4.4.10 Round Number Levels

1. Price reacts at psychological levels (100, 500, 1000, etc.)
2. Rejection at round number
3. Entry beyond level
4. Target next round number

### 4.4.11 Sector Rotation

1. Strong sector index + leader stock
2. Buy leader when sector breaks out
3. Stop below sector low
4. Hold while sector strong

### 4.4.12 Overnight Theta Decay

1. Sell out-of-money options before close (3:15 PM)
2. Buy back next morning
3. Capture theta decay overnight (especially Thursday-Monday for weeklies)

## 4.5 Jesse Livermore — Pivotal Points (1923, still works)

**Logic**: prices move in trends; pivotal points are where supply/demand have battled previously. Successful breakouts of pivots launch sustained moves.

### 4.5.1 The 7 Cardinal Rules

1. Trade only with the line of least resistance (the dominant trend)
2. Buy at pivotal points; sell at pivotal points
3. Wait for confirmation before entering — don't predict, react
4. Cut losses quickly (10% maximum)
5. Let winners run, scale up as they prove themselves
6. Never average down on losing positions
7. Sit on your hands when no clear setup exists

### 4.5.2 Pyramiding Rule

Initial position = 20% of intended total. As price moves favorably:
- +0.5R → add 20%
- +1R → add 20%
- +1.5R → add 20%
- +2R → add 20%

By full position, you're already in profit. Stop is moved up to entry on the next 1R move.

## 4.6 Mark Minervini — VCP (Volatility Contraction Pattern)

The single most reliable swing/positional pattern in equities.

### 4.6.1 Exact Rules

1. Stock must already be in Stage 2 (Trend Template passed)
2. Look for 2-4 progressive contractions:
   - Contraction 1: typically -25% to -35% from local high
   - Contraction 2: -15% to -20%
   - Contraction 3: -8% to -12%
   - Contraction 4: -3% to -8%
   Each contraction *less than half* of the previous
3. Volume DECLINES progressively during each contraction
4. Total base length: minimum 7 weeks, ideal 3-12 weeks
5. Pivot point = highest high of the most recent (tightest) consolidation
6. **Entry trigger**: price closes above pivot on volume **≥ 40% above 50-day average**
7. **Stop**: below the most recent (tightest) low — typically 5-8% below entry
8. **Position size**: up to 25% of capital on a single conviction trade

## 4.7 William O'Neil — Cup with Handle

### 4.7.1 Exact Rules

1. Prior uptrend of at least 30% over last 3-12 months
2. Cup formation: 12-30% pullback from top, U-shaped (not V-shaped)
3. Cup duration: minimum 7 weeks, typically 13-26 weeks
4. Volume during cup: low and decreasing on right side
5. Handle: forms in upper half of cup, slight downward drift, pulls back 8-12%
6. Handle duration: 1-2 weeks minimum
7. Volume during handle: dries up to multi-week lows
8. **Entry**: breakout above handle high
9. **Volume confirmation**: ≥ 50% above 50-day average
10. **Stop**: 7-8% below entry (O'Neil's hard rule)
11. **Target**: projected from cup depth (cup-bottom to pivot, projected up)

## 4.8 Stan Weinstein — Stage 2 Breakout

### 4.8.1 Exact Rules

1. Stock must complete Stage 1 base (sideways for ≥ 6 months minimum)
2. 30-week MA flattening or just turning up
3. Price breaks above the base resistance
4. Volume on breakout > 2× the recent average
5. Relative Strength rising relative to S&P/Nifty
6. **Entry**: at breakout
7. **Stop**: below recent base low
8. **Target**: hold while above 30-week MA (months to years)

## 4.9 Turtle Trading System 1 + System 2

### 4.9.1 System 1 (20-day breakout, short-term)

1. **Entry**: buy when price breaks above 20-day high (long); sell short below 20-day low
2. **Skip filter**: if previous 20-day breakout was a winner, skip the next one. Use System 2 (55-day) as failsafe
3. **Position size in N units**:
   - N = 20-day exponential moving average of True Range (~ATR)
   - 1 Unit = (1% of account) / (N × point value)
   - Maximum 4 units per market, 6 units across correlated markets
4. **Initial stop**: 2N below entry (long) / 2N above entry (short)
5. **Pyramid**: add another unit every 0.5N favorable move, raising stop on prior unit by 0.5N
6. **Exit**: 10-day low (long) / 10-day high (short)

### 4.9.2 System 2 (55-day breakout, long-term)

Same as System 1 but uses 55-day breakouts and 20-day exit. No skip filter.

## 4.10 Market Profile / Auction Market Theory

The framework used by floor traders since the 1980s. Originated by Peter Steidlmayer at the CBOT.

### 4.10.1 Initial Balance (IB)

The first hour of trading = "initial balance":
- **Narrow IB (< 0.5× ADR)**: trend day signal — institutions are quiet because they're about to push
- **Normal IB**: balanced day, range-trade
- **Wide IB (> 1.5× ADR)**: bracketed day, fade extremes

### 4.10.2 The 4 Day Types

| Day Type | Profile shape | Strategy |
|---|---|---|
| **Normal** | Bell-shaped, balanced | Range-trade IB extremes |
| **Trend** | Elongated thin profile, IB tiny | Buy IB break in trend direction; trail wide |
| **Neutral** | Two peaks, breaks IB both sides | Avoid; chop kills you |
| **Double Distribution** | Two distinct ranges with gap | Trade the range you're in |

### 4.10.3 Value Area (VA)

Value Area = 70% of volume traded around the day's POC (Point of Control = highest-volume price).
- **VAH (Value Area High)**: acts as resistance
- **VAL (Value Area Low)**: acts as support

**Setup**: when price returns to VAH or VAL after extending out, fade back to POC.

### 4.10.4 Auction Theory Principles

- Imbalanced markets seek to restore balance
- Time + volume building at edge of balance → likely push through
- Time + volume building inside balance → range continuation
- "Value" is dynamic; what was overvalued yesterday may be undervalued today

## 4.11 Order Flow / Tape Reading

The most professional intraday method. Used by prop firms.

### 4.11.1 Footprint Charts

Each candle shows VOLUME at each price level (bid vs ask).

- **Absorption**: price stays flat despite huge volume hitting one side. Strong hands absorbing aggressive orders. Reversal often follows.
  - Example: stock at 1000, 10K contracts hitting bid at 999.95, price doesn't drop. Buyers absorbing. Bullish.

- **Imbalance**: ratio of buy:sell volume at a price > 3:1. Indicates aggression.

- **Stacked Imbalances**: 3+ price levels in a row showing same-direction imbalance = sustained aggression. Trend continuation likely.

### 4.11.2 Time & Sales Tape Reading

- Large prints at bid = retail dumping, institutions absorbing → bullish
- Large prints at ask = institutions buying → continuation
- Slow tape with rising price = quiet accumulation
- Fast tape with multiple small fills = retail churn → fade

### 4.11.3 Iceberg Detection

Institutions hide large orders by splitting into small visible chunks. Signs:
- Same price level keeps refreshing visible bid/offer
- Volume printing way above visible depth
- Price stalls at the level despite strong attempts to break it

When detected, iceberg level becomes strong support/resistance.

## 4.12 Indian Options-Specific

### 4.12.1 P R Sundar — Short Strangle

**Logic**: options buyers lose 70% of the time; sellers win 70%. Catch is 30% losses are bigger than 70% wins.

**Rules**:
1. Identify support and resistance for the day/week
2. Sell OTM Call at resistance, sell OTM Put at support
3. Premium collected = profit if price stays between strikes at expiry
4. Position sizing: total margin ≤ 2× net worth
5. Adjustment rule: if price approaches a sold strike, ROLL or hedge
6. Exit at 50-70% of max premium captured

### 4.12.2 P R Sundar — Iron Fly (best for expiry day)

1. Sell ATM Call + ATM Put (the "fly body")
2. Buy OTM Call + OTM Put (the "wings")
3. Net credit = profit if price stays inside body strikes
4. Maximum loss capped by wings
5. Best deployed expiry day morning, exit by 2 PM

### 4.12.3 Mitesh Patel — Directional Selling

1. Bank Nifty F&O focus
2. 3-min candles + RSI(14) + Volume + Open Interest
3. **Bullish setup**: price above day's VWAP + RSI cross above 50 + OI rising on upside
4. **Action**: SELL ATM PUT (collect premium, profit if stays above strike)
5. **Stop**: if Bank Nifty futures break previous low
6. **Target**: 50% premium decay
7. **Sizing**: Day 1 of expiry = 30% capital; Day 5-6 = 100% capital (theta accelerates)

### 4.12.4 9:20 Short Straddle (the famous Indian intraday trade)

Documented win rate ~65-70% over multiple years.

1. At 9:20 AM, identify ATM strike of Bank Nifty / Nifty
2. Sell 1 lot CE + 1 lot PE at same ATM strike
3. Premium collected = sum of both
4. Stop-loss: 30% of premium on EITHER side
5. Target: 50% of premium decay
6. Time exit: square off by 3:15 PM regardless

---

# Part 5: Position Sizing

## 5.1 Van Tharp R-multiples (the universal language)

- **R = your risk on the trade** = (entry − stop) × position size
- Every trade outcome expressed in units of R
- A trade that lost = -1R. A trade that made 2× your risk = +2R.

This decouples results from rupee amounts. A ₹50K win on ₹25K risk = +2R. A ₹100K win on ₹50K risk = also +2R. Same quality of trade.

## 5.2 Expectancy formula

```
Expectancy = (Win% × Avg Win in R) − (Loss% × Avg Loss in R)
```

Examples:
- 50% win rate, 2R wins, 1R losses → E = +0.5R per trade
- 30% win rate, 5R wins, 1R losses → E = +0.5R per trade (same!)
- 70% win rate, 1R wins, 1R losses → E = +0.4R per trade
- 40% win rate, 3R wins, 1R losses → E = **+0.6R per trade** (best)

**Insight**: higher win-rate ≠ higher expectancy. The math favors low-win-rate, high-R-multiple systems.

## 5.3 System Quality Number (SQN)

```
SQN = (mean_R / stddev_R) × √N
```

Where N is number of trades (capped at 100 per Tharp).

| SQN | System quality |
|---|---|
| < 1.6 | Below average — most amateur systems |
| 1.6 - 2.4 | Average |
| 2.4 - 3.0 | Good (pros target this) |
| 3.0 - 5.0 | Excellent |
| 5.0 - 7.0 | Superb (rare) |
| > 7.0 | Holy grail / suspect for overfitting |

A profitable system with SQN of 1.2 is too inconsistent — you'll quit during drawdowns.

## 5.4 Fixed Fractional Sizing

Every trade risks exactly P% of current capital:
```
Position size = (Capital × Risk%) / (Entry − Stop)
```

This makes position sizes adapt to volatility AND drawdowns automatically.

**Compound result examples**:
- Risk 1%, win-rate 50%, avg win 2R, avg loss 1R → +0.5R/trade = ~+100% per year (200 trades)
- Risk 2% same params → ~+200% per year BUT max drawdown nearly doubles

This is why pros stop scaling risk above 2%. Drawdown cost dominates.

## 5.5 Volatility-Adjusted Sizing (Turtles' N-units)

```
N = 20-day EMA of True Range (basically ATR)
1 Unit = (1% of account) / (N × point value)
```

Position size scales inversely with volatility. High-ATR stocks → smaller positions automatically.

## 5.6 Concentration vs Diversification (Druckenmiller)

**Druckenmiller's approach**:
- 3-5 ideas hold 70-80% of capital
- Up to 30% in single position IF risk/reward is 5:1+
- Otherwise max 10% per position
- Scales up only as trade proves itself
- Cuts immediately if initial small position goes wrong

**Why concentration works**: in ANY backtest of ANY strategy, the top-performing trades are vastly fewer than the average ones. Diversifying away from your best ideas dilutes returns more than it reduces risk.

## 5.7 Pyramiding Rules (Livermore + Druckenmiller)

The OPPOSITE of averaging down (which kills amateurs):
- Initial position: small (typically 25% of intended)
- If trade moves favorably 1R → add 0.5× of original
- Another 1R → add 0.5× of original
- Continue scaling until target or stop hit
- **By the time fully positioned, you're already profitable**
- Stop is moved up to ensure no full position can take you back to breakeven

---

# Part 6: Risk Management

## 6.1 Per-trade risk caps

| Trader profile | Risk per trade |
|---|---|
| Beginner | 0.25-0.5% |
| Experienced retail | 0.5-1% |
| Pros (Pani, Patel) | 0.5-2% by conviction |
| Institutional | 0.1-0.5% (size accounts force smaller %) |

**Never above 2% intraday** — math doesn't support it.

## 6.2 Daily Risk Budget — 4-Tier (prop firm standard)

| Tier | Loss level | Action |
|---|---|---|
| **Yellow** | -1% daily | Reduce position size 50% |
| **Orange** | -2% daily | Reduce 75%, A+ only |
| **Red** | -3% daily | One last "perfect" trade allowed; otherwise stop |
| **Black** | -4% daily | **STOP TRADING for the day** |

Rationale: tilt management. After first big loss, decision quality degrades 40-60%. Cutting size reduces tilt damage.

## 6.3 Weekly Risk Budget

- Max weekly loss: 5-7% of capital
- If hit, take 1 full trading day off (Friday or Monday)
- Review the week before resuming

## 6.4 Monthly Risk Budget

- Max monthly drawdown: 10-15%
- If hit, halt trading for ≥ 1 week
- Mandatory system review before resuming
- Consider whether system has structurally broken

## 6.5 Circuit Breakers Beyond Daily

- 3 consecutive losing days → reduce size 25%
- 5 consecutive losing days → halt 1 week
- 10 days with no winning trade → halt, full system review
- Drawdown > backtested max → halt, system likely broken

## 6.6 Correlation Limits

- Max 70% correlation with any existing position
- Practical: if you own RELIANCE, don't also buy ONGC or IOC same day
- Sector indices help: max 2 stocks from same NSE sector index

## 6.7 Sector Concentration Caps

- Max 2-3 positions in same NSE sector index
- Max 50% of total exposure in single sector
- Prevents sector-specific catastrophic loss

## 6.8 Position-Level Concentration

- Max single position: 20-25% of capital
- Max single industry: 30-40%
- Min 3 positions for any meaningful diversification
- For intraday: fewer positions (3-5) is BETTER than more

---

# Part 7: Exit Construction

Pros say: *"Amateurs work on entries. Pros work on exits."*

## 7.1 Initial Stop — 4 placement methods

### 7.1.1 Structural (preferred for swing)
- Below swing low (long) / above swing high (short)
- Below moving average / VWAP
- Below trendline support
- Used by: Minervini, O'Neil, Pani

### 7.1.2 Volatility-Based
- N × ATR below entry
- Turtles use 2N (2× ATR)
- Used by: Turtles, Pani

### 7.1.3 Percentage-Based
- Fixed % below entry (typically 7-8%)
- O'Neil's hard cap rule
- Simple but ignores stock-specific volatility

### 7.1.4 Time-of-Day Based
- For intraday: end of day exit always
- For first-bar entries: opposite extreme of bar

## 7.2 Time Stop (the secret weapon most miss)

**The rule**: if trade hasn't moved +0.5R in 60 min → exit at breakeven.

**Why**: trades that "go nowhere" statistically have 70% probability of ending as losses. Cut them early.

Variations by setup:
- Scalping: 5-15 min time stop
- Day-trade: 30-60 min
- Swing: 2-3 days
- Position: 5-7 days

## 7.3 Trailing Stop — 5 methods

### 7.3.1 ATR Trail (most robust)
- 2× ATR(14) trail
- Used by Pani, Turtles

### 7.3.2 Percentage Trail
- Fixed % below highest price since entry
- Simple but rigid

### 7.3.3 Below n-day Low Trail
- Turtles System 1: 10-day low
- Turtles System 2: 20-day low

### 7.3.4 Moving Average Trail
- Below 5-EMA on 15-min (Pani)
- Below 20-EMA on 5-min (Brooks)
- Below 30-week MA (Weinstein)

### 7.3.5 Structural Trail
- Below previous swing low on each new high
- Most discretionary; needs judgment

## 7.4 Partial Profit-Taking (mathematical optimum)

The most under-utilized exit rule:
- At +1.5R: take 50% off
- Move stop on remaining 50% to entry (breakeven)
- Trail remainder

**Why**: locks profit while keeping a runner. Mathematically optimal in nearly every backtested system.

## 7.5 Catastrophic Exit

Pre-defined "if X happens, exit immediately regardless of stop":
- Major news event against position
- VIX spike of 30%+ in a session
- Underlying index breaks key support
- Earnings released during hold (for swing trades)
- Stock circuit-broken

## 7.6 Time-of-Day Exits (intraday-specific)

| Time IST | Action |
|---|---|
| 14:30 | Stop adding to positions; no new entries |
| 15:00 | Tighten trailing stop to 1× ATR |
| 15:15 | Square off all positions yourself |
| 15:20 | Zerodha auto-squareoff (slippage worse) |

---

# Part 8: Trade Management (during the trade)

## 8.1 Don't Move Stops Backward

The single most catastrophic amateur habit.

If your stop is hit, you exit. Period. "Giving the trade more room" is averaging down via the stop. Never do it.

## 8.2 The 1R Rule

Once trade moves +1R in your favor, move stop to breakeven. You can't lose money on this trade anymore.

## 8.3 Pyramiding Rules

Add to winners only:
- +1R move → add 0.5× original size
- +1.5R move → add 0.25× original size
- +2R move → consider exiting partial (per Section 7.4)

NEVER pyramid on losers. Never average down.

## 8.4 Reading the Tape During a Trade

- Volume on continuation moves should be ≥ entry-bar volume
- If volume drying up while price stalls → exit
- If price hits target but tape weak → exit early
- If price stalls at level + absorption → wait one more bar

## 8.5 Adjustment Decision Tree

For options sellers (Sundar/Patel):
- Price approaches sold strike with 30%+ stop hit → ROLL the threatened side OR hedge with futures
- Net premium remaining < 30% of original collected → close the trade
- Time decay favorable + far from strike → hold

---

# Part 9: Tilt and Psychology

## 9.1 The 6 Destructive Patterns

1. **Revenge trading** — taking a worse setup right after a loss to "make it back"
2. **FOMO entry** — chasing a stock that already moved without you
3. **Premature exit** — closing winners early because of fear
4. **Stop moving** — moving stop to "give the trade more room"
5. **Boredom trade** — taking a marginal setup because you haven't traded
6. **Overtrading on green days** — keep trading after 3 wins because "today I'm hot"

## 9.2 The 5-Min Reset

After every loss: 5 minutes away from screens. Mandatory.

Walk, drink water, breathe. The market will be there.

## 9.3 Pre-Mortem (before entering)

Ask: "what would make this trade fail?"
- If you can't answer, skip
- If your answer is "the market goes down" — that's not analysis, skip
- Look for specific structural failure modes

## 9.4 Post-Mortem (after every trade)

Mandatory 30-second journal:
- Did I follow the rules? Y/N
- Was the setup valid? Y/N
- What did I notice during the trade?
- Score: 1-5 on rule-following

P&L is irrelevant for this exercise. Process matters.

## 9.5 The Overconfidence Curve

After every 5-day winning streak, top traders REDUCE size 25-50%.

The behavior research is clear: 5-day winning streaks correlate with the worst trades in the next 10 days due to overconfidence.

## 9.6 Stop-After-3-Wins Rule (controversial)

Some pros stop trading after 3 consecutive winners on a single day. The logic:
- Success creates overconfidence
- Position-size creep
- Breaks rules
- Better to log the win and walk

## 9.7 The 3-Strike Rule (Pani)

- 3 consecutive losing trades → STOP for 1 hour
- 5 consecutive losing trades → STOP for the day
- This isn't superstition. After 3 losses, hit rate drops 20-30% statistically.

## 9.8 Journaling

Mandatory daily entries:
- Date, market regime
- Each trade: setup, entry, stop, target, exit, P&L in R, rule-following score
- Mistakes made (always identify ≥1)
- One thing to do better tomorrow
- Mental state going in / coming out

Weekly review:
- Per-setup performance (win%, avg R)
- Best trade and why
- Worst trade and why
- Patterns in your own behavior

Monthly review:
- System SQN by setup
- Drawdown analysis
- Setup pruning (kill what isn't working)
- Capital allocation review

---

# Part 10: Time-of-Day Playbook

## 10.1 Pre-open (9:00 - 9:08 IST)

- Watch only. No orders.
- Read order book imbalances.
- Build watchlist (5-15 names).
- Note opening price discovery.

## 10.2 Opening 15 minutes (9:15 - 9:30 IST) — AVOID

- 70% of opening gaps fill within the day
- Spreads widest of the entire session
- Algos hunt retail stops
- "Dumb money" reacts emotionally to overnight news

Pros do: nothing. Or just observe and mark levels.

## 10.3 Opening Drive (9:30 - 10:00 IST)

- Best window for ORB entries
- Volume peaks ~9:45-10:00
- Trends established here usually hold for the morning
- Look for: 5-min close beyond opening range with volume

## 10.4 Mid-Morning (10:00 - 12:00 IST) — best window for retail

- Trends established, structures clean
- Setup-based entries highest probability
- Volume still healthy
- This is where Pani says you should do your work

## 10.5 Lunch Lull (12:00 - 13:30 IST)

- Lowest volume of session
- False signals abundant
- Most professional traders DO NOT enter during this window
- If holding positions, manage them; otherwise, observe

## 10.6 Afternoon (13:30 - 15:00 IST)

- Trend resumption common
- Smart money positions for close
- Sector rotation often visible
- 14:30 = last entry window for intraday

## 10.7 Closing (15:00 - 15:30 IST)

- 15:00: Tighten stops on remaining positions
- 15:00-15:15: Last chance for momentum continuations
- 15:15: Square off intraday
- 15:20: Zerodha auto-squareoff (avoid)
- 15:30: Market closes

---

# Part 11: Indian Market Specifics

## 11.1 NSE Market Structure

- Cash market: 9:15-15:30 IST
- F&O: 9:15-15:30 IST (same hours)
- MCX (commodities): 9:00-23:30 IST (longer)
- Pre-open: 9:00-9:08 (call auction)
- Post-close: 15:40-16:00 (limited)

## 11.2 The 9:20 AM Phenomenon

Bank Nifty options have documented IV crush after first 5 minutes. Why "9:20 short straddle" works statistically — institutional crowd done positioning, IV starts decaying.

## 11.3 Sector Rotation by Time

| Time IST | Leaders |
|---|---|
| 9:15-10:00 | Banking + IT (FII flows hit first) |
| 10:00-12:00 | Auto, FMCG often catch up |
| 12:00-13:30 | Lunch lull, no clear leader |
| 13:30-15:00 | Mid/small-caps lead afternoon (retail) |
| 15:00-15:30 | Banking/index leaders dominate close |

## 11.4 F&O Expiry Effects

- Wednesday before Thursday expiry: unusual stock-specific moves due to OI unwinding
- Thursday morning (expiry): max volatility 9:15-11:30, calm 11:30-13:00, max again 14:00-15:30
- Thursday close: new monthly series picks up volume
- Avoid taking new positions on expiry day after 13:00 unless options-specific

## 11.5 FII/DII Flow Patterns

- FII selling concentrated 9:15-10:30 (overnight US/global cues)
- DII buying often 10:30-12:00 (pension/insurance inflows)
- Net flow data published EOD; previous day's data can hint at next day's bias
- Big-figure flows (>₹2000 cr net) tend to extend 2-3 days

## 11.6 Pre-Open Call Auction Mechanics

- 9:00-9:08: order entry
- 9:08-9:12: order matching at single-price discovery
- 9:12-9:15: 3-minute "buffer" for system reset
- The 9:08 imbalance ratio often predicts first 30-min direction with 60-70% accuracy

## 11.7 MIS Auto-Squareoff (Zerodha, others)

- 15:20 IST: brokers force-close all MIS positions
- Slippage typically 0.1-0.3% wider than market price
- Always exit YOURSELF by 15:15 to control fill
- If stuck in CNC, consider taking delivery rather than squaring off at 15:20

## 11.8 Brokerage and Tax Impact

Per round-trip on intraday equity:
- Brokerage: ₹20-40 per trade or 0.03-0.05%
- STT: 0.025% on sell side
- Exchange transaction charges: 0.0035%
- GST: 18% on brokerage + transaction charges
- SEBI fees: 0.0001%
- Stamp duty: 0.003% on buy side

Total round-trip cost: ~0.10-0.15% of trade value.

This is why pros aim for 1.5R+ trades. A 0.5R trade barely covers costs.

## 11.9 SEBI Regulations Affecting Intraday

- F&O ban list: stocks where market-wide OI > 95% of allowed limit
- Circuit limits: 2%/5%/10%/20% (varies by stock)
- T+0 settlement (introduced 2024): faster cash settlement for select stocks
- Margin requirements: 5x for intraday equity, less for F&O depending on volatility

---

# Part 12: Daily/Weekly/Monthly Review

## 12.1 End-of-Day Journal (mandatory, 15 min)

Template:
```
Date: 2026-MM-DD
Market: BULL/NEUTRAL/BEAR (day_bias_score)
Regime: TREND/BALANCED/BRACKETED (IB classification)

Trades:
1. [Symbol] [LONG/SHORT] [Setup]
   Entry: ₹X (R: ₹Y risk)
   Exit: ₹Z (Reason: ...)
   P&L: +/−Z R
   Rule following: 1-5
   What I noticed: ...

Mistakes today (must list ≥1): ...
Win pattern noticed: ...
Tomorrow's focus: ...
Mental state: 1-10
```

## 12.2 Weekly Performance Review

Every Saturday/Sunday:
- Trades by setup: count, win%, avg R
- SQN per setup
- Best 3 trades (study them — what made them work?)
- Worst 3 trades (study them — what failed?)
- Drawdown profile
- Day-of-week patterns
- Time-of-day patterns
- Overall P&L: in absolute and R terms

## 12.3 Monthly System Review

Every month-end:
- System SQN over rolling 100 trades
- Drawdown vs backtested max (alarm if >80% of max)
- Setup retirement decisions (kill SQN < 1.6 setups)
- Setup expansion decisions (boost SQN > 2.5 setups)
- Capital allocation review
- Mental health honest check

## 12.4 Drawdown Analysis

When in drawdown:
- Is this within statistical range? (compare to backtested max DD)
- Is the loss pattern clustered (one setup) or distributed?
- Has any market regime shifted?
- Are my emotions interfering?

Action thresholds:
- 50% of max DD: continue with normal sizing
- 75% of max DD: reduce size 50%
- 100% of max DD: halt, full system review
- 125% of max DD: stop trading entirely; system likely broken

## 12.5 Setup Attribution

Per-setup tracking is THE measurement that separates pros from amateurs.

For each setup:
- Trades count
- Win rate %
- Avg win R
- Avg loss R
- Expectancy (R per trade)
- SQN
- Max DD
- Average holding time

Action:
- SQN < 1.6 over 30+ trades → retire setup
- SQN > 2.5 over 30+ trades → increase risk allocation 25%
- SQN > 3.0 over 50+ trades → consider increasing further

## 12.6 The Rule-Following Metric

Most underutilized metric:
- Score every trade 1-5 on "did I follow my own rules?"
- Track weekly average
- Goal: 4.5+ consistently
- Below 4.0 = re-read rules, re-commit
- Below 3.5 = take a week off

---

# Part 13: Common Mistakes (and how pros avoid them)

| # | Mistake | How pros avoid |
|---|---------|----------------|
| 1 | Revenge trading | 5-min reset rule; 3-strike rule |
| 2 | FOMO entries | Pre-defined setups only |
| 3 | Premature exits | Pre-defined exit rules; trail discipline |
| 4 | Stop moving | Stop is sacred; never moved against you |
| 5 | Boredom trades | "No trade" is a successful day |
| 6 | Overtrading on green days | Size reduction after 3 wins |
| 7 | Averaging down | NEVER. Pyramid up only. |
| 8 | Trading too many instruments | 30-50 names, deeply known |
| 9 | No system | Written rules before any trade |
| 10 | Backtest data fitting | Out-of-sample test before deploying |
| 11 | Position size creep | Fixed % of capital, not "feeling" |
| 12 | Holding losers too long | Time stop; cut at -1R no exceptions |
| 13 | Cutting winners too soon | Partial at 1.5R, trail rest |
| 14 | Trading during major news | Catastrophic exit rule |
| 15 | Predicting vs reacting | Confirmation before entry, not prediction |
| 16 | "This time is different" | History repeats; respect base rates |
| 17 | Not journaling | Mandatory daily journal |
| 18 | Chasing losses on Friday | Weekly risk budget |
| 19 | Trading tired/sick/upset | Personal-state checklist |
| 20 | Comparing to others' P&L | Compare to your own SQN over time |

---

# Part 14: How the Legends Differ

| Trader | Bet count | Hold period | Edge source | Position size | Hit rate |
|---|---|---|---|---|---|
| Renaissance Tech | 150K/day | minutes | Tiny statistical anomalies | Micro per trade | ~51% |
| Druckenmiller | 3-5/quarter | 6-18 months | Macro thesis | 70-80% in top ideas | ~50% |
| Paul Tudor Jones | Few/week | days-weeks | 5:1 R:R + macro | 1% risk per | ~30-40% |
| Mark Minervini | 5-15/year | weeks-months | Stage 2 + VCP | Up to 25% per | ~50-60% |
| William O'Neil | 5-30/year | months | CANSLIM filter | Concentrated | ~50-60% |
| Stan Weinstein | 10-20/year | months-years | Stage 2 only | Diversified | ~60% |
| Linda Raschke | 50-200/year | days | Statistical patterns | 1-2% risk | ~55-65% |
| Subasish Pani | 1-3/day | minutes-hours | Multiple intraday setups | 0.5-1% risk | ~55% |
| Richard Dennis (Turtles) | 30-60/year | weeks | 20/55-day breakouts | 2% per N unit | ~30-40% |
| P R Sundar | Daily | hours | IV harvesting | 2x net worth margin | ~70% |
| Jesse Livermore | Few/quarter | months | Pivotal points | Pyramid 20→100% | ~50% |

**Key insight**: there is NO single "right" approach. There's only "internally consistent" approaches.

- Renaissance can run 51% win rate because volume forces consistency
- Druckenmiller can run 50% hit rate because winners are 5-10× losers and he scales aggressively
- Sundar runs 70% because options selling is statistically biased winning (but losses are big)

Each system is internally balanced.

---

# Part 15: Universal Truths (what they ALL agree on)

Despite divergent styles, every legend agrees on these:

1. **Risk management is paramount.** Capital preservation first, profits second.
2. **Stop-loss is non-negotiable.** Set before entering. Never moved against you.
3. **Have a system.** Discretion without rules is gambling.
4. **Track every trade.** Journal. Review. Find patterns in your own behavior.
5. **Don't trade your opinion. Trade the price.** The market is right; your view may not be.
6. **Wait for setups, don't force trades.** The next trade is always the most expensive.
7. **Volume confirms price.** No volume = no conviction = skip.
8. **Trade with the trend.** Multi-timeframe alignment = highest probability.
9. **Position size based on volatility.** High-volatility instruments → smaller positions.
10. **Be wrong fast, be right slow.** Cut losers in hours; hold winners in weeks.
11. **Don't average down.** Adding to losers turns small losses into big ones.
12. **Pyramid up.** Add to winners as they prove themselves.
13. **Concentration > diversification for active trading.** 3 deep > 10 shallow.
14. **Boredom is the enemy.** "No trade" days are successful days.
15. **The market doesn't owe you a trade today.**
16. **Performance is measured over 100+ trades.** One trade is meaningless.
17. **Drawdowns are math, not failure.**
18. **Backtest before deploying.** Anecdotes don't compound.
19. **Setup-driven, not predictive.** Wait for patterns, don't predict outcomes.
20. **Process > P&L.** Rule-following is the metric that compounds.

---

# Part 16: Mapping This Playbook to ProTrader v2

Here's how the bot currently implements vs. what's still gaps.

## What ProTrader v2 implements

### Universe (Section 3)
- ✅ 107-name Nifty 50 + Next 50 universe
- ✅ Tier classification A/B/SKIP (Section 3.5)
- ✅ ATR + turnover filtering (Pani's universe rules)
- ⚠️ Trend Template (Minervini Section 3.1) only loosely applied via daily MA/RS

### Pre-market (Section 2)
- ✅ 8:30 IST cron pulls Gift Nifty + VIX + 3-day pivot + FII/DII
- ✅ day_bias_score on -4 to +4 scale (Section 2.2)
- ⚠️ Pre-open call auction (Section 2.3) — only reads cached data, doesn't compute live

### Setups (Section 4)
- ✅ ORB+ (Pani 4.4.1 + Fisher ACD 4.3) synthesized
- ✅ VWAP_PULLBACK (Raschke Holy Grail 4.1.1 adapted)
- ✅ COMPRESSION (Pani NR4 4.4.3 + Brooks 4.2.1)
- ✅ Mirror short setups
- ❌ Doesn't implement: Turtle Soup, 80-20, Anti, 3 Indians, 2B, VWAP fade, all Brooks H/L variants, Mark Fisher A/B/C/D zones, all Pani 12 setups

### Position sizing (Section 5)
- ✅ R-multiple framework (Section 5.1)
- ✅ Per-tier risk (Section 5.4 — fixed fractional with tier adjustment)
- ✅ Max position cap (Section 5.6)
- ✅ Per-setup SQN endpoint (Section 5.3)
- ⚠️ Pyramiding (Section 5.7) — NOT implemented

### Risk management (Section 6)
- ✅ 4-tier daily DD breaker (Section 6.2)
- ✅ Tilt management 3/5-strike (Section 6.5)
- ✅ Sector concentration cap (Section 6.7)
- ✅ Correlation limit (Section 6.6)
- ⚠️ Weekly/monthly budgets (Section 6.3-6.4) — NOT implemented

### Exits (Section 7)
- ✅ Initial stop, structural+ATR (Section 7.1)
- ✅ Time stop 60min → BE (Section 7.2)
- ✅ ATR trail (Section 7.3.1)
- ✅ Partial profit at 1.5R (Section 7.4)
- ✅ Time-of-day exits (Section 7.6)
- ⚠️ Catastrophic exit (Section 7.5) — basic; could be enriched

### Trade management (Section 8)
- ✅ Stops never moved backward
- ✅ 1R rule (move SL to BE on partial)
- ❌ Pyramiding — NOT implemented
- N/A Tape reading — bot is not tick-level

### Tilt/Psychology (Section 9)
- ✅ 3-strike rule (Section 9.7)
- ✅ Win-streak warning (Section 9.5)
- N/A Reset/journaling — operator's job

### Time-of-day (Section 10)
- ✅ All time windows enforced (9:30-11:00 ORB, 10:00-14:30 VWAP, etc.)
- ✅ EOD timing (14:30/15:00/15:15)

### Indian specifics (Section 11)
- ✅ MIS auto-squareoff awareness
- ✅ F&O ban list (filtered out)
- ❌ 9:20 short straddle (options) — NOT implemented (equity-only bot)
- ❌ FII/DII flow integration into setups

### Review (Section 12)
- ✅ EOD report with v2 status
- ✅ Per-setup SQN endpoint
- ⚠️ Weekly/monthly review — manual

## Honest gap list

Not yet in the bot:
1. Setup-specific targets (OR-width projection, swing-extreme TGT, compression × 1.5)
2. Pyramiding rules
3. Pre-open call auction order book parsing
4. Auto SQN-based setup retirement
5. Weekly/monthly risk budgets
6. Most of Raschke's catalog beyond Holy Grail
7. Most of Brooks's H1/H2/L1/L2 system
8. Mark Fisher's full ACD A/B/C/D zone framework
9. Order flow / footprint reading (requires tick-level data)
10. Options selling setups (Sundar/Patel) — equity-only by design

These represent the 12-month roadmap if v2 baseline performs.

---

# Closing Note

This playbook is not a strategy. It's a SUPERSET of strategies. Your job as a trader (or as bot designer) is to pick the subset that fits your:
- Capital size
- Time availability
- Risk tolerance
- Execution capability
- Information edge

ProTrader v2 picks ~30% of this playbook. That's enough to be profitable if executed mechanically and reviewed honestly. The other 70% is roadmap.

**The single most important takeaway**: setup-by-setup expectancy measurement (Section 5.3 + Section 12.5) is the meta-edge. Without it, you're flying blind. With it, every other decision becomes data-driven.

---

*Document generated 2026-05-07 by ProTrader v2 development. Source synthesized from: Linda Raschke (Lbrgroup), Al Brooks (BrooksTradingCourse), Mark Fisher (ACD Method), Subasish Pani (PowerOfStocks), P R Sundar, Mitesh Patel, Mark Minervini (SEPA), William O'Neil (CANSLIM), Stan Weinstein (Stage Analysis), Jesse Livermore (How to Trade in Stocks, 1923), Stanley Druckenmiller (interviews), Paul Tudor Jones (interviews), Richard Dennis (Turtles original rules), Van Tharp (Trade Your Way to Financial Freedom), Renaissance Technologies (Jim Simons biographical research), Peter Steidlmayer (Market Profile), and academic literature on Auction Market Theory.*
