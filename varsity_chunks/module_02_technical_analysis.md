# Module 2: Technical Analysis - Complete Knowledge Base
## Source: Zerodha Varsity (All 22 Chapters)
## Purpose: Automated Strategy Development & Stock Prediction/Ranking

---

# CHAPTER 1: BACKGROUND

## What is Technical Analysis
Technical Analysis (TA) is a research technique to identify trading opportunities based on market participants' actions visualized in stock charts. Over time, patterns form in these charts, each conveying specific messages that analysts interpret to develop a market perspective.

## TA vs Fundamental Analysis
- **Fundamental Analysis (FA)**: Examines company financials, valuations, industry position. Best for long-term investments. Not scalable -- can deeply analyze only a few stocks.
- **Technical Analysis (TA)**: Studies price action and chart patterns. Best for short-term trades. Scalable -- can quickly scan hundreds of stocks.
- **Key Principle**: "Both techniques are different and not comparable. A prudent trader would educate on both techniques."

## What TA Provides
A complete trading point of view including:
- Entry price
- Exit price
- Expected risk
- Expected reward
- Expected holding period

## Setting Expectations
1. **Timeframe**: TA works best for short-term trades (few minutes to few weeks). NOT for long-term investment.
2. **Returns**: Identify frequent short-term trading opportunities for small but consistent profits.
3. **Risk Management**: If trade moves adversely, cut losses and move on.
4. **Integration**: FA analysts should use TA to calibrate entry and exit points.

---

# CHAPTER 2: INTRODUCING TECHNICAL ANALYSIS

## Core Assumptions of Technical Analysis

### Assumption 1: Markets Discount Everything
All known and unknown information in the public domain is reflected in the latest stock price. The market inherently incorporates all available information through price movements.

### Assumption 2: The 'How' Matters More Than the 'Why'
Technical analysts focus on understanding how prices respond to market participants' actions, not why they moved.

### Assumption 3: Price Moves in Trends
All major moves in the market are an outcome of a trend. Prices don't move randomly but follow directional patterns over time.

### Assumption 4: History Tends to Repeat Itself
Market participants react consistently to price movements, causing historical patterns to recur because human psychology remains constant across market cycles.

## Universal Application
TA applies across ALL asset classes -- equities, commodities, forex, fixed income -- provided historical time-series data exists.

## OHLC Framework

| Data Point | Definition | Significance |
|-----------|------------|--------------|
| **Open (O)** | First executed trade price when markets open | Starting reference |
| **High (H)** | Highest traded price during the session | Intraday ceiling |
| **Low (L)** | Lowest traded price during the session | Intraday floor |
| **Close (C)** | Final price at market close | **MOST IMPORTANT** - indicates daily sentiment, serves as next day's reference |

**Bullish Day**: Close > Open
**Bearish Day**: Close < Open

---

# CHAPTER 3: CHART TYPES

## 1. Line Chart
- **Construction**: Connects closing prices across time periods with a line.
- **Data Used**: Only closing price.
- **Pros**: Simple trend identification.
- **Cons**: Ignores Open, High, Low. Minimal analytical detail.

## 2. Bar Chart (OHLC Bar)
- **Construction**: Vertical bar from Low to High. Left tick = Open. Right tick = Close.
- **Data Used**: All four OHLC points.
- **Color**: Blue/Green = bullish (Close > Open); Red = bearish (Close < Open).
- **Cons**: Lacks visual appeal; pattern recognition is difficult.

## 3. Candlestick Chart (PREFERRED)
- **Construction**: Rectangular "real body" connects Open and Close. Upper shadow extends to High. Lower shadow extends to Low.
- **Bullish Candle**: Close > Open (blue/green body).
- **Bearish Candle**: Close < Open (red body).
- **Pros**: Superior visual clarity for pattern identification.

## Timeframe Reference

| Timeframe | Candles/Year | Use Case |
|-----------|-------------|----------|
| Monthly | 12 | Long-term analysis |
| Weekly | 52 | Medium-term trends |
| Daily/EOD | 252 | General trading |
| 30-minute | ~12/day | Intraday trading |
| 15-minute | ~25/day | Short-term trading |
| 5-minute | ~75/day | Active intraday |

**Key**: Higher chart frequency = better quality information but more noise. Lower frequency = cleaner signals.

## Body Length Interpretation
- **Long body**: Strong buying or selling activity.
- **Short body**: Less trading activity / indecision.

---

# CHAPTER 4: GETTING STARTED WITH CANDLESTICKS

## Three Candlestick-Specific Trading Assumptions

1. **"Buy strength and sell weakness"** -- Buy during bullish (blue) candles; sell during bearish (red) candles.
2. **Be flexible with pattern recognition** while maintaining quantifiable standards.
3. **"Look for a prior trend"** -- Bullish patterns require prior downtrend; bearish patterns require prior uptrend.

## Pattern Classification
- **Single candlestick patterns**: Formed by 1 candle
- **Multiple candlestick patterns**: Formed by 2 or more candles

## Key Principle
Each pattern comes with an in-built risk mechanism. Candlesticks give insight into both entry and stop-loss price.

## Risk-Taker vs Risk-Averse Entry
- **Risk-Taker**: Enter at 3:20 PM on the pattern-forming day after validating the pattern.
- **Risk-Averse**: Wait for the next day's confirmation candle (blue candle for bullish pattern, red for bearish).

---

# CHAPTER 5: SINGLE CANDLESTICK PATTERNS (PART 1) - MARUBOZU

## Bullish Marubozu

### Identification Rules (for automated detection):
```
Open = Low (or within ~0.17% tolerance)
Close = High (or within ~0.17% tolerance)
No upper shadow (or negligible)
No lower shadow (or negligible)
Real body spans nearly the entire candle range
Candle color: Blue/Green (Close > Open)
```

### Signal: BULLISH (strong buying pressure)
### Prior Trend: Works independent of prior trend (EXCEPTION to the prior trend rule)

### Trade Setup:
- **Entry (Risk-Taker)**: Buy at closing price on pattern day (~3:20 PM)
- **Entry (Risk-Averse)**: Buy next day only if it forms a blue candle
- **Stoploss**: Low of the Marubozu candle
- **Target**: Based on S/R levels or risk-reward ratio

## Bearish Marubozu

### Identification Rules:
```
Open = High (or within ~0.17% tolerance)
Close = Low (or within ~0.17% tolerance)
No upper shadow (or negligible)
No lower shadow (or negligible)
Real body spans nearly the entire candle range
Candle color: Red (Close < Open)
```

### Signal: BEARISH (extreme selling pressure)

### Trade Setup:
- **Entry (Risk-Taker)**: Sell/Short at closing price on pattern day
- **Entry (Risk-Averse)**: Sell next day only if it forms a red candle
- **Stoploss**: High of the Marubozu candle

### Trade Trap Warning:
**RULE**: Avoid trading during a minimal (below 1% range) or long candle (above 10% range).
```python
# Range filter for Marubozu
candle_range_pct = ((high - low) / low) * 100
if candle_range_pct < 1.0 or candle_range_pct > 10.0:
    skip_trade = True
```

---

# CHAPTER 6: SINGLE CANDLESTICK PATTERNS (PART 2) - SPINNING TOP & DOJI

## Spinning Top

### Identification Rules:
```
Small real body (Open and Close very close together)
Upper shadow and lower shadow are approximately equal in length
Both shadows are longer than the real body
Color (red/blue) is irrelevant
```

### Signal: INDECISION (neither bulls nor bears won)

### Trading Rules:
- **NOT a standalone trade signal** -- indicates uncertainty.
- **In Downtrend**: Spinning top may signal reversal. Buy only HALF quantity; wait for confirmation before adding.
- **In Uptrend**: Book profits on 50% of holdings as a precaution.

## Doji

### Identification Rules:
```
Open = Close (or virtually equal -- "wafer-thin body" acceptable)
Can have upper and/or lower shadows of any length
The real body is essentially a horizontal line
```

### Doji Variants:
1. **Standard Doji**: Small shadows on both sides
2. **Long-legged Doji**: Long upper AND lower shadows (high volatility indecision)
3. **Dragonfly Doji**: Long lower shadow, no upper shadow (bullish at bottom)
4. **Gravestone Doji**: Long upper shadow, no lower shadow (bearish at top)

### Signal: INDECISION (same implications as spinning top)
- Neither bullish nor bearish standalone.
- Requires next candle for directional confirmation.

### Key Enhancement Rule:
**"Whenever a doji follows a recognizable candlestick pattern, the opportunity created is bigger."**
A Doji after an engulfing pattern = panic + uncertainty = stronger signal.

---

# CHAPTER 7: SINGLE CANDLESTICK PATTERNS (PART 3) - PAPER UMBRELLA & SHOOTING STAR

## Paper Umbrella (Base Pattern)

### Identification Rules:
```
Small real body at the UPPER end of the trading range
Long lower shadow >= 2x the length of real body
Little or no upper shadow
Color can be either bullish or bearish
```

### Formula for Validation:
```python
real_body = abs(close - open)
lower_shadow = min(open, close) - low
upper_shadow = high - max(open, close)

is_paper_umbrella = (lower_shadow >= 2 * real_body) and (upper_shadow <= real_body * 0.1)
```

Paper umbrella becomes either a **Hammer** or **Hanging Man** depending on trend context.

## Hammer (Bullish Reversal)

### Prerequisites:
- **MUST appear at the bottom of a DOWNTREND** (prior trend requirement mandatory)

### Identification Rules:
```
Same as paper umbrella structure
Appears after a downtrend
Long lower shadow >= 2x real body
Small real body at upper end
Any color acceptable (blue slightly preferred)
```

### Trade Setup:
- **Entry (Risk-Taker)**: Verify at 3:20 PM: open/close nearly identical (1-2% range), lower shadow >= 2x real body. Buy at closing price.
- **Entry (Risk-Averse)**: Buy next day ONLY if it forms a blue candle.
- **Stoploss**: Low of the Hammer candle.
- **Longer the lower shadow, more bullish the signal.**

## Hanging Man (Bearish Reversal)

### Prerequisites:
- **MUST appear at the top of an UPTREND**

### Identification Rules:
```
Same as paper umbrella structure
Appears after an uptrend
Long lower shadow >= 2x real body
Small real body at upper end
Color immaterial
```

### Trade Setup:
- **Entry (Risk-Taker)**: Short at closing price same day.
- **Entry (Risk-Averse)**: Short next day ONLY after confirming red candle.
- **Stoploss**: High of the Hanging Man candle.

### Reliability Note:
Author's concern: "If the bears were indeed influential during the day, why did the price go up after making a low?" -- Hanging Man is considered less reliable than Hammer.

## Shooting Star (Bearish Reversal)

### Prerequisites:
- **MUST follow an UPTREND** (appears at trend top)

### Identification Rules:
```
Inverted paper umbrella structure
Long upper shadow >= 2x real body
Small real body at LOWER end (preferably red, but optional)
Minimal or no lower shadow
Appears at top of uptrend
```

### Formula for Validation:
```python
real_body = abs(close - open)
upper_shadow = high - max(open, close)
lower_shadow = min(open, close) - low

is_shooting_star = (upper_shadow >= 2 * real_body) and (lower_shadow <= real_body * 0.3)
```

### Trade Setup:
- **Entry (Risk-Taker)**: Confirm current price ~ daily low, upper shadow >= 2x body. Short at closing price.
- **Entry (Risk-Averse)**: Short next day after confirming red candle.
- **Stoploss**: High of the Shooting Star candle.

### Pattern Reliability Ranking (Author's Experience):
1. **Hammer** (most reliable)
2. **Shooting Star** (effective)
3. **Hanging Man** (least conviction)

### Universal Rule:
"Once you initiate the trade, stay in it until either the stop loss or the target is reached."

---

# CHAPTER 8: MULTIPLE CANDLESTICK PATTERNS (PART 1) - ENGULFING & PIERCING/DARK CLOUD

## Bullish Engulfing Pattern

### Identification Rules:
```
Two-candle pattern at BOTTOM of DOWNTREND
P1 (Day 1): Red candle (confirms bearish sentiment)
P2 (Day 2): Blue candle that COMPLETELY engulfs P1's real body
  - P2 Open <= P1 Close (opens at or below P1's close)
  - P2 Close > P1 Open (closes above P1's open)
```

### Trade Setup:
- **Entry (Risk-Taker)**: Buy at P2 close after validating engulfing conditions.
- **Entry (Risk-Averse)**: Buy day after P2 only if it forms a blue candle.
- **Stoploss**: Lowest low between P1 and P2.

## Bearish Engulfing Pattern

### Identification Rules:
```
Two-candle pattern at TOP of UPTREND
P1 (Day 1): Blue candle (confirms bullish sentiment)
P2 (Day 2): Red candle that COMPLETELY engulfs P1's real body
  - P2 Open > P1 Close (opens above P1's close)
  - P2 Close < P1 Open (closes below P1's open)
```

### Trade Setup:
- **Entry (Risk-Taker)**: Short at P2 close.
- **Entry (Risk-Averse)**: Short day after P2 only if red candle forms.
- **Stoploss**: Highest high between P1 and P2.

## Piercing Pattern (Bullish - Partial Engulfing)

### Identification Rules:
```
Two-candle bullish pattern at BOTTOM of DOWNTREND
P1: Red candle
P2: Blue candle that PARTIALLY engulfs P1
  - P2 must engulf between 50% and 99.9% of P1's real body
  - P2 Close penetrates at least 50% into P1's real body but does NOT fully engulf
```

### Formula:
```python
p1_body = abs(p1_open - p1_close)  # Red candle: open > close
penetration = (p2_close - p1_close) / p1_body  # How far P2 closes into P1
is_piercing = 0.50 <= penetration < 1.00
```

### Trade Setup:
- Same as Bullish Engulfing.
- **Less reliable than full engulfing.**

## Dark Cloud Cover (Bearish - Partial Engulfing)

### Identification Rules:
```
Two-candle bearish pattern at TOP of UPTREND
P1: Blue candle
P2: Red candle that engulfs 50% to 100% of P1's real body
  - P2 Open > P1 Close (opens above P1's close -- gap up)
  - P2 Close penetrates at least 50% into P1's real body
```

### Trade Setup:
- Same as Bearish Engulfing.
- **Less reliable than full engulfing.**

## Pattern Selection Hierarchy:
```
Bullish Engulfing > Piercing Pattern
Bearish Engulfing > Dark Cloud Cover
```
When both appear with identical checklist scores, ALWAYS prefer full engulfing patterns.

## Doji Confirmation Amplification:
When a Doji appears as P3 (day after the engulfing pattern):
- Combines "panic with uncertainty" -- the perfect recipe for a strong move.
- **Significantly increases pattern reliability and expected magnitude.**

---

# CHAPTER 9: MULTIPLE CANDLESTICK PATTERNS (PART 2) - HARAMI

## Bullish Harami

### Identification Rules:
```
Two-candle pattern at BOTTOM of DOWNTREND
P1: Long RED candle (confirms bearish control)
P2: Small BLUE candle whose body is CONTAINED within P1's body
  - P2 Open > P1 Close (opens higher than P1's close)
  - P2 Close < P1 Open (closes below P1's open)
  - P2's entire real body fits inside P1's real body
```

### Trade Setup:
- **Entry (Risk-Taker)**: Buy near P2 close.
- **Entry (Risk-Averse)**: Buy day after P2 only if blue candle forms.
- **Stoploss**: Lowest low between P1 and P2.

## Bearish Harami

### Identification Rules:
```
Two-candle pattern at TOP of UPTREND
P1: Long BLUE candle (confirms bullish momentum)
P2: Small RED candle whose body is CONTAINED within P1's body
  - P2 Open < P1 Close (opens lower than P1's close)
  - P2 Close > P1 Open (closes above P1's open)
  - P2's entire real body fits inside P1's real body
```

### Trade Setup:
- **Entry (Risk-Taker)**: Short near P2 close.
- **Entry (Risk-Averse)**: Short day after P2 only if red candle forms.
- **Stoploss**: Highest high between P1 and P2.

### Harami Summary Table:

| Aspect | Bullish Harami | Bearish Harami |
|--------|---------------|----------------|
| Location | Downtrend bottom | Uptrend top |
| P1 Color | Red (long) | Blue (long) |
| P2 Color | Blue (small) | Red (small) |
| P2 Body | Inside P1 body | Inside P1 body |
| Entry | Near P2 close | Near P2 close |
| Stoploss | Lowest low of pattern | Highest high of pattern |

---

# CHAPTER 10: MULTIPLE CANDLESTICK PATTERNS (PART 3) - STARS

## Morning Star (Bullish Reversal - 3 Candle Pattern)

### Identification Rules:
```
Three-candle pattern at BOTTOM of DOWNTREND
P1: Long RED candle (confirms selling acceleration)
P2: Gap-down open, forms DOJI or SPINNING TOP (indecision)
  - P2 gaps down from P1's close
P3: Gap-up open, forms BLUE candle
  - P3 Close > P1 Open (closes above P1's opening price)
```

### Trade Setup:
- **Entry**: Buy at close of P3 (~3:20 PM) after validating all three candles.
- **Stoploss**: Lowest low of P1, P2, and P3.

## Evening Star (Bearish Reversal - 3 Candle Pattern)

### Identification Rules:
```
Three-candle pattern at TOP of UPTREND
P1: Long BLUE candle (confirms buying acceleration)
P2: Gap-up open, forms DOJI or SPINNING TOP (indecision)
  - P2 gaps up from P1's close
P3: Gap-down open, forms RED candle
  - P3 Close < P1 Open (closes below P1's opening price)
```

### Trade Setup:
- **Entry**: Short at close of P3 (~3:20 PM) after validation.
- **Stoploss**: Highest high of P1, P2, and P3.

## Morning Doji Star
Same as Morning Star but P2 is specifically a DOJI (not just a spinning top). **Stronger signal than regular Morning Star.**

## Evening Doji Star
Same as Evening Star but P2 is specifically a DOJI. **Stronger signal than regular Evening Star.**

---

# COMPLETE CANDLESTICK PATTERN REFERENCE TABLE

| Pattern | Type | Candles | Signal | Prior Trend | Stoploss |
|---------|------|---------|--------|-------------|----------|
| Bullish Marubozu | Single | 1 | Bullish | Any | Low of candle |
| Bearish Marubozu | Single | 1 | Bearish | Any | High of candle |
| Hammer | Single | 1 | Bullish | Downtrend | Low of candle |
| Hanging Man | Single | 1 | Bearish | Uptrend | High of candle |
| Shooting Star | Single | 1 | Bearish | Uptrend | High of candle |
| Spinning Top | Single | 1 | Indecision | Any | N/A |
| Doji | Single | 1 | Indecision | Any | N/A |
| Bullish Engulfing | Multiple | 2 | Bullish | Downtrend | Lowest low of P1, P2 |
| Bearish Engulfing | Multiple | 2 | Bearish | Uptrend | Highest high of P1, P2 |
| Piercing Pattern | Multiple | 2 | Bullish | Downtrend | Lowest low of P1, P2 |
| Dark Cloud Cover | Multiple | 2 | Bearish | Uptrend | Highest high of P1, P2 |
| Bullish Harami | Multiple | 2 | Bullish | Downtrend | Lowest low of P1, P2 |
| Bearish Harami | Multiple | 2 | Bearish | Uptrend | Highest high of P1, P2 |
| Morning Star | Multiple | 3 | Bullish | Downtrend | Lowest low of P1-P3 |
| Evening Star | Multiple | 3 | Bearish | Uptrend | Highest high of P1-P3 |
| Morning Doji Star | Multiple | 3 | Strong Bullish | Downtrend | Lowest low of P1-P3 |
| Evening Doji Star | Multiple | 3 | Strong Bearish | Uptrend | Highest high of P1-P3 |

---

# CHAPTER 11: SUPPORT AND RESISTANCE

## Definitions
- **Support**: Price level BELOW current market price where maximum buying demand is expected. Price tends to bounce upward at support.
- **Resistance**: Price level ABOVE current market price where maximum selling supply is expected. Price tends to consolidate or reverse downward at resistance.

## How to Identify S/R Levels (4-Step Process)

### Step 1: Load Historical Data
- **Short-term S/R**: 3-6 months data (for intraday/BTST trades)
- **Long-term S/R**: 12-18 months data (for swing trading)

### Step 2: Identify Price Action Zones
Look for instances where price:
1. Hesitated to move up after a brief rise
2. Hesitated to move down after a brief decline
3. Made sharp reversals at particular price points

### Step 3: Align Price Action Zones
- Need **at least 3 price action zones** at approximately the same price level
- Zones must be **well spaced in time** (separated by weeks, not days)
- More distance between zones = more powerful the S/R level

### Step 4: Fit Horizontal Line
Connect aligned zones with a horizontal line. Position relative to current price determines if it's support or resistance.

## S/R as Zones, Not Exact Prices
Express S/R as a range: approximately +/- 3 points or ~0.5% of stock price.

## Role Reversal Rule
```
When price BREAKS BELOW support --> that support level becomes RESISTANCE
When price BREAKS ABOVE resistance --> that resistance level becomes SUPPORT
```

## Integration with Candlestick Patterns (Double Confirmation)
- **Long trades**: Candlestick's low should align with support level
- **Short trades**: Candlestick's high should align with resistance level
- If S/R is more than 4% away from stoploss, skip the trade.

---

# CHAPTER 12: VOLUMES

## Definition
Volume = total number of shares traded during a specific period.
**100 shares buy + 100 shares sell = volume of 100 (NOT 200)**

## Volume-Price Interpretation Table (CRITICAL FOR AUTOMATION)

| Price Direction | Volume Direction | Signal | Interpretation |
|----------------|-----------------|--------|----------------|
| Price UP | Volume UP | **BULLISH** | Institutional participation driving uptrend |
| Price UP | Volume DOWN | **CAUTION** | Weak retail buying; potential bull trap |
| Price DOWN | Volume UP | **BEARISH** | Smart money selling; strong downtrend confirmation |
| Price DOWN | Volume DOWN | **CAUTION** | Weak retail selling; potential bear trap |

## Volume Measurement Standard
```
High Volume = Today's Volume > 10-day SMA of Volume
```

### Implementation:
```python
volume_sma_10 = sum(volume[-10:]) / 10
is_high_volume = today_volume > volume_sma_10
```

## Volume Confirmation Rules
1. Above-average volume on entry day = confirmed signal
2. High volume = institutional (smart money) participation
3. Low volume = retail participation only
4. **NEVER initiate positions without volume confirmation**
5. Volume increases + price increases = strongest bullish signal
6. Volume spikes during price decline = end of accumulation phase

## Triple Confirmation Checklist
1. Recognizable candlestick pattern
2. S/R level alignment with pattern
3. Volume above 10-day average

---

# CHAPTER 13: MOVING AVERAGES

## Simple Moving Average (SMA)

### Formula:
```
SMA(n) = (P1 + P2 + P3 + ... + Pn) / n
```
Where P = closing price, n = number of periods.

### Implementation:
```python
def sma(prices, period):
    return sum(prices[-period:]) / period
```

## Exponential Moving Average (EMA)

### Formula:
```
Multiplier (k) = 2 / (n + 1)
EMA_today = (Close_today * k) + (EMA_yesterday * (1 - k))
```
Where n = number of periods.

### Implementation:
```python
def ema(prices, period):
    k = 2 / (period + 1)
    ema_val = prices[0]  # Start with first price as initial EMA
    for price in prices[1:]:
        ema_val = (price * k) + (ema_val * (1 - k))
    return ema_val
```

### Key Difference from SMA:
EMA gives more weight to recent data points, making it more responsive to price changes. The most recent data point gets the highest weight, decreasing exponentially for older data.

## Common Period Combinations

| Timeframe | Short EMA | Long EMA | Use Case |
|-----------|-----------|----------|----------|
| Short-term | 9 | 21 | Few trading sessions |
| Medium-term | 25 | 50 | Weeks |
| Intermediate | 50 | 100 | Months |
| Long-term | 100 | 200 | Months to years |
| Intraday (aggressive) | 5 | 10 | Minute charts |
| Intraday (standard) | 15 | 30 | Minute charts |

## Moving Average Crossover Signals

### Golden Cross (BUY Signal):
```
Short-term MA crosses ABOVE Long-term MA
Signal: BULLISH -- initiate fresh long position
```

### Death Cross (SELL Signal):
```
Short-term MA crosses BELOW Long-term MA
Signal: BEARISH -- exit long position / initiate short
```

### Implementation:
```python
def ma_crossover_signal(short_ma_prev, short_ma_curr, long_ma_prev, long_ma_curr):
    if short_ma_prev <= long_ma_prev and short_ma_curr > long_ma_curr:
        return "BUY"  # Golden Cross
    elif short_ma_prev >= long_ma_prev and short_ma_curr < long_ma_curr:
        return "SELL"  # Death Cross
    return "HOLD"
```

## Price vs MA Signal
- Price > EMA = Bullish sentiment (traders optimistic)
- Price < EMA = Bearish sentiment (traders pessimistic)

## Dynamic Support/Resistance
Moving averages act as dynamic support (in uptrend) or resistance (in downtrend) levels that adjust daily.

## Critical Implementation Note
"The key to MA trading system is to take ALL the trades and not be judgmental about the signals being generated by the system."
- Works optimally in trending markets
- Generates whipsaws (false signals) in sideways markets

---

# CHAPTER 14: INDICATORS (PART 1) - RSI

## Relative Strength Index (RSI)

### Formula:
```
RSI = 100 - [100 / (1 + RS)]
```

Where:
```
RS = Average Gain over n periods / Average Loss over n periods
```

### Calculation Steps:
```
1. For each period, calculate change = Close_today - Close_yesterday
2. Separate into Gains (positive changes) and Losses (absolute value of negative changes)
3. Average Gain = Sum of Gains over n periods / n
4. Average Loss = Sum of Losses over n periods / n
5. RS = Average Gain / Average Loss
6. RSI = 100 - (100 / (1 + RS))
```

### Standard Parameters:
- **Lookback Period**: 14 (default)
- **Overbought Level**: 70-100
- **Oversold Level**: 0-30
- **Range**: 0 to 100

### Implementation:
```python
def calculate_rsi(prices, period=14):
    changes = [prices[i] - prices[i-1] for i in range(1, len(prices))]
    gains = [max(0, c) for c in changes]
    losses = [abs(min(0, c)) for c in changes]
    
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    
    if avg_loss == 0:
        return 100
    
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi
```

### Signal Rules:
```
RSI > 70  --> OVERBOUGHT --> Potential sell/short signal
RSI < 30  --> OVERSOLD   --> Potential buy signal
RSI crossing DOWN through 70 --> SELL signal confirmation
RSI crossing UP through 30   --> BUY signal confirmation
```

### Important Notes:
- Fewer days in lookback = more volatility in RSI
- RSI is a **leading indicator** (signals before price moves)
- Use as confirmation, not primary signal

---

# CHAPTER 15: INDICATORS (PART 2) - MACD & BOLLINGER BANDS

## MACD (Moving Average Convergence Divergence)

### Components:
```
MACD Line    = 12-day EMA - 26-day EMA
Signal Line  = 9-day EMA of MACD Line
Histogram    = MACD Line - Signal Line
```

### Standard Parameters: (12, 26, 9)

### Implementation:
```python
def calculate_macd(prices, fast=12, slow=26, signal=9):
    ema_fast = ema(prices, fast)
    ema_slow = ema(prices, slow)
    macd_line = ema_fast - ema_slow
    signal_line = ema(macd_line_series, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram
```

### Signal Rules:
```
MACD Line crosses ABOVE Signal Line --> BULLISH (Buy)
MACD Line crosses BELOW Signal Line --> BEARISH (Sell)
MACD crosses from negative to positive territory --> Bullish centerline crossover
MACD crosses from positive to negative territory --> Bearish centerline crossover
```

### Characteristics:
- **Trend-following indicator** (lagging)
- Works well in strong trending markets
- Struggles during sideways/range-bound markets
- Best used for confirming trend direction and momentum

## Bollinger Bands (BB)

### Components:
```
Middle Band  = 20-day SMA
Upper Band   = Middle Band + (2 x Standard Deviation)
Lower Band   = Middle Band - (2 x Standard Deviation)
```

### Standard Parameters:
- Period: 20
- Standard Deviations: 2

### Formula Example:
```
If 20-day SMA = 7800, Standard Deviation = 75:
Upper Band = 7800 + (75 x 2) = 7950
Lower Band = 7800 - (75 x 2) = 7650
Bandwidth = 7950 - 7650 = 300
```

### Implementation:
```python
import statistics

def calculate_bollinger(prices, period=20, std_dev=2):
    sma = sum(prices[-period:]) / period
    sd = statistics.stdev(prices[-period:])
    upper = sma + (std_dev * sd)
    lower = sma - (std_dev * sd)
    return upper, sma, lower
```

### Signal Rules:
```
Price touches/crosses LOWER Band --> BUY (expect mean reversion to SMA)
Price touches/crosses UPPER Band --> SELL/SHORT (expect mean reversion to SMA)
```

### Band Width Interpretation:
```
Bands WIDENING (expanding)  --> Trending market (BB signals FAIL)
Bands NARROWING (squeezing) --> Sideways market (BB signals RELIABLE)
Squeeze followed by expansion --> Breakout imminent
```

### Critical Limitation:
"BB works well in SIDEWAYS markets. In a trending market, the BB envelope expands and generates false signals."

## Indicator Usage Philosophy
Indicators should CONFIRM, not DICTATE trades:
- If indicator confirms: increase position size
- If indicator doesn't confirm but pattern + S/R + volume align: proceed with reduced size

---

# CHAPTER 16: FIBONACCI RETRACEMENTS

## The Fibonacci Sequence
0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610...
Each number = sum of the previous two numbers.

## Key Retracement Ratios

| Ratio | Derivation | Significance |
|-------|-----------|--------------|
| **61.8%** | Any number / next number (e.g., 89/144) | Golden Ratio (Phi) -- most important |
| **38.2%** | Any number / number 2 positions ahead (e.g., 13/34) | Second most important |
| **23.6%** | Any number / number 3 positions ahead (e.g., 13/55) | Shallow retracement |
| **50.0%** | Not a Fibonacci ratio but widely used | Midpoint reference |

## How to Apply Fibonacci Retracements

### For UPTREND Retracement:
```
1. Identify the swing LOW (trough) and swing HIGH (peak)
2. Calculate move = High - Low
3. Retracement levels:
   23.6% level = High - (0.236 x move)
   38.2% level = High - (0.382 x move)
   50.0% level = High - (0.500 x move)
   61.8% level = High - (0.618 x move)
```

### For DOWNTREND Retracement (Bounce):
```
1. Identify the swing HIGH (peak) and swing LOW (trough)
2. Calculate move = High - Low
3. Bounce levels:
   23.6% level = Low + (0.236 x move)
   38.2% level = Low + (0.382 x move)
   50.0% level = Low + (0.500 x move)
   61.8% level = Low + (0.618 x move)
```

### Implementation:
```python
def fibonacci_levels(swing_high, swing_low, direction="uptrend"):
    move = swing_high - swing_low
    ratios = [0.236, 0.382, 0.500, 0.618]
    
    if direction == "uptrend":
        # Retracement from high
        levels = {f"{r*100:.1f}%": swing_high - (r * move) for r in ratios}
    else:
        # Bounce from low
        levels = {f"{r*100:.1f}%": swing_low + (r * move) for r in ratios}
    
    return levels
```

## Multi-Factor Confirmation at Fibonacci Levels
Before entering at a retracement level, validate:
1. Recognizable candlestick pattern formed at the level
2. Stoploss coincides with S/R levels
3. Volume is above average
4. Stoploss aligns with Fibonacci level

**"The more confirming factors we use, more robust is the signal."**

## Fibonacci Target and Stoploss
- **Minimum Target**: The price from which the original move started
- **Stoploss**: Place at the retracement entry level, then trail as price recovers

## Timeframe
- Preferred: EOD (End-of-Day) charts
- Minimum lookback: 15 days for reliable analysis
- Applicable across all timeframes (intraday to weekly)

---

# CHAPTERS 17-18: DOW THEORY

## The 9 Tenets of Dow Theory

### Tenet 1: Market Efficiency
"The stock market indices discount everything which is known and unknown in the public domain."
All information -- earnings, political events, natural disasters -- is priced in.

### Tenet 2: Three Types of Market Trends
Markets operate across three simultaneous trend levels:

| Trend | Duration | Analogy |
|-------|----------|---------|
| **Primary Trend** | 1 year to several years | The tide |
| **Secondary Trend** | Few weeks to several months | Waves |
| **Minor Trend** | Daily fluctuations | Ripples |

### Tenet 3: Primary Trend Phases

#### Bull Market Phases:
```
1. ACCUMULATION PHASE
   - Occurs after steep selloffs
   - Smart money (institutions) buys at depressed valuations
   - Creates support levels; marks market bottom
   - Public sentiment: extremely negative

2. MARK-UP PHASE (Public Participation)
   - Rally accelerates quickly after accumulation
   - Media coverage increases
   - Public begins participating
   - Prices rise rapidly

3. EXCESS/DISTRIBUTION PHASE
   - Prices at new highs
   - Public enters aggressively (FOMO)
   - Smart money slowly offloads holdings
   - Creates resistance levels
```

#### Bear Market Phases:
```
1. DISTRIBUTION PHASE
   - Smart money distributes to retail
   - Market appears to be consolidating

2. MARK-DOWN PHASE (Public Panic)
   - Prices collapse sharply
   - Public sells in panic
   - Media turns negative

3. DESPAIR PHASE
   - Everyone expects further decline
   - Smart money starts accumulating again
   - Cycle repeats
```

### Tenet 4: Index Confirmation
"We cannot confirm a trend based on just one index." All major indices (e.g., Nifty 50 AND Nifty Bank) must move in the same direction to confirm a trend.

### Tenet 5: Volume Confirmation
Volume must confirm along with the price:
- In an uptrend: volume should increase with price rises
- In a downtrend: volume should increase with price falls

### Tenet 6: Sideways Can Substitute Secondary Corrections
Extended sideways trading can replace secondary trend corrections. A trading range of weeks/months can serve as the correction before the primary trend resumes.

### Tenet 7: Closing Price is Most Sacred
Among OHLC values, the closing price carries the most weight for analysis.

### Tenet 8: Trends Persist Until Clear Reversal
A trend in motion continues until definitive signals indicate reversal. Don't anticipate reversals prematurely.

### Tenet 9: Trend Identification Through Peaks and Troughs
- **Uptrend**: Higher highs and higher lows
- **Downtrend**: Lower highs and lower lows
- Minimum 2-week gaps should exist between pattern formations for validity.

## Dow Theory Patterns

### Double Bottom (Bullish Reversal):
Price tests a support level twice with significant time spacing between tests. Bullish signal when price breaks above the intervening high.

### Double Top (Bearish Reversal):
Price tests a resistance level twice. Bearish when price breaks below the intervening low.

### Triple Bottom/Top:
More powerful than double patterns. "The more times price tests a level, the more sacred the price level."

### Trading Range:
Stock oscillates between consistent support and resistance. Width of range = distance between support and resistance.

### Range Breakout Rules:
```
Genuine breakout characteristics:
1. Volume is HIGH
2. Momentum (rate of price change) is HIGH

False breakout characteristics:
1. Low volume
2. Low momentum
3. Typically reverses back into range
```

### Breakout Trade Setup:
```
Entry: Buy above resistance (for upside breakout)
Stoploss: At the resistance level (now support)
Minimum Target: Range width added to breakout price
  Target = Breakout Price + (Resistance - Support)
```

### Flag Formation:
After a steep rally, prices consolidate between two parallel lines (the "flag") before resuming the uptrend ("flag pole"). Offers a second entry opportunity.

## Reward-to-Risk Ratio (RRR)
```
RRR = Expected Reward / Risk Taken
RRR = (Target - Entry) / (Entry - Stoploss)

Example: Entry=107, Stoploss=102, Target=114
RRR = (114-107) / (107-102) = 7/5 = 1.4

MINIMUM acceptable RRR: 1.5 (for swing trades)
Scalping acceptable RRR: 0.5 to 0.75
```

---

# CHAPTER 19: THE FINALE - COMPLETE TRADING FRAMEWORK

## Recommended Setup for Beginners
- **Timeframe**: End of Day (EOD) data for swing trading
- **Universe**: Nifty 50 stocks
- **Trade Type**: Positional (few days holding period)
- **Lookback**: 6 months to 1 year for patterns; 2 years for S/R levels

## Stock Selection Criteria
1. Adequate liquidity: low bid-ask spread, minimum 500,000 daily volume
2. EQ segment stocks only
3. Non-operator driven stocks

## THE COMPLETE TRADING CHECKLIST (6-Point System)

### Step 1: Shortlisting (Quick Scan)
Look at all stocks in universe. Focus only on recent 3-4 candles. Check if any recognizable candlestick pattern is developed. Shortlist 4-5 stocks.

### Step 2: Detailed Evaluation (15-20 minutes per chart)

#### Checkpoint 1: Pattern Strength
- Evaluate shadow length relative to range
- Check pattern definition quality

#### Checkpoint 2: Prior Trend Confirmation
- Bullish patterns need prior DOWNTREND
- Bearish patterns need prior UPTREND
- Look back 25-30 candles minimum

#### Checkpoint 3: Volume Confirmation
```
Volume >= 10-day average volume = CONFIRMED
Volume < 10-day average volume = NOT confirmed (reduce size or skip)
```

#### Checkpoint 4: Support & Resistance Alignment
- Long trades: Support should coincide with stoploss
- Short trades: Resistance should coincide with stoploss
- **If S/R is more than 4% away from stoploss, SKIP the trade**

#### Checkpoint 5: Dow Theory Patterns
- Check for double/triple tops and bottoms
- Flag formations
- Range breakouts
- Primary and secondary trend alignment

#### Checkpoint 6: Risk-Reward Ratio
```
Minimum RRR: 1.5
Target established using S/R levels
If RRR < 1.5, SKIP the trade
```

#### Checkpoint 7 (Supplementary): Indicator Confirmation
- Check RSI and MACD
- If indicators confirm: increase trade size
- If indicators don't confirm: proceed with standard size (if other checkpoints pass)

## Trade Qualification Rule
**A trade qualifies if it satisfies at least 3-4 checklist criteria.**
Usually, out of 4-5 shortlisted stocks, at most 1 or 2 qualify. There are days with NO trading opportunities.

## Trade Execution Rules
1. Once trade is placed, DO NOTHING until target is achieved or stoploss is triggered.
2. Trailing stoploss is acceptable and encouraged.
3. Remain passive once conviction-based entry is confirmed.

## Scalping Guidelines (Advanced Only)
1. Candlestick pattern + volume are CRITICAL
2. Acceptable RRR: 0.5-0.75
3. Liquid stocks ONLY
4. Quick loss management essential
5. Monitor bid-ask spreads continuously
6. Watch global market movements
7. Use low-cost broker (commissions matter)
8. Manage leverage carefully
9. Reliable intraday charting software required
10. Exit immediately if market conditions deteriorate

---

# CHAPTER 20: OTHER INDICATORS (SUPPLEMENTARY)

## Average Directional Index (ADX)

### Components:
- **ADX**: Measures trend STRENGTH (not direction)
- **+DI**: Plus Directional Indicator
- **-DI**: Minus Directional Indicator

### Parameters:
- Default lookback: 14 days

### Signal Rules:
```
ADX > 25 = STRONG trend (worth trading)
ADX < 20 = WEAK trend (avoid trend-following strategies)

BUY:  ADX >= 25 AND +DI crosses ABOVE -DI
SELL: ADX >= 25 AND -DI crosses ABOVE +DI
```

### Implementation:
```python
def adx_signal(adx, plus_di, minus_di, plus_di_prev, minus_di_prev):
    if adx < 25:
        return "NO_TREND"
    if plus_di_prev <= minus_di_prev and plus_di > minus_di:
        return "BUY"
    if minus_di_prev <= plus_di_prev and minus_di > plus_di:
        return "SELL"
    return "HOLD"
```

## Average True Range (ATR)

### Purpose: Volatility measurement (no directional component)

### True Range Calculation:
```
TR = max(
    High - Low,
    abs(High - Previous Close),
    abs(Low - Previous Close)
)
ATR = SMA(TR, 14)  # 14-period SMA of True Range
```

### Application:
```
If ATR = 48 and current price = 1320:
  Expected daily range: 1272 to 1368
  
STOPLOSS RULE: Set stoploss at least 1 ATR distance from entry price
  For long: Stoploss = Entry - ATR
  For short: Stoploss = Entry + ATR
```

## Supertrend Indicator

### Components: Uses ATR with Period and Multiplier parameters

### Signal Rules:
```
Green line (price ABOVE indicator) = UPTREND --> BUY
Red line (price BELOW indicator) = DOWNTREND --> SELL
Acts as trailing stop loss
Recommended multiplier: 3 to 4
```

### Calculation:
```
Basic Upper Band = (High + Low) / 2 + (Multiplier x ATR)
Basic Lower Band = (High + Low) / 2 - (Multiplier x ATR)

Final Upper Band = if Basic_Upper < Previous_Final_Upper OR Previous_Close > Previous_Final_Upper
                   then Basic_Upper else Previous_Final_Upper
                   
Final Lower Band = if Basic_Lower > Previous_Final_Lower OR Previous_Close < Previous_Final_Lower
                   then Basic_Lower else Previous_Final_Lower

Supertrend = Final Upper Band (when in downtrend)
           = Final Lower Band (when in uptrend)
```

## VWAP (Volume Weighted Average Price)

### Formula:
```
Typical Price = (High + Low + Close) / 3
VWAP = Cumulative(Typical Price x Volume) / Cumulative(Volume)
```

### Implementation:
```python
def calculate_vwap(highs, lows, closes, volumes):
    typical_prices = [(h + l + c) / 3 for h, l, c in zip(highs, lows, closes)]
    cum_tp_vol = 0
    cum_vol = 0
    vwap_series = []
    for tp, vol in zip(typical_prices, volumes):
        cum_tp_vol += tp * vol
        cum_vol += vol
        vwap_series.append(cum_tp_vol / cum_vol)
    return vwap_series
```

### Signal Rules:
```
INTRADAY ONLY (resets daily)
Price ABOVE VWAP = Uptrend (buy bias)
Price BELOW VWAP = Downtrend (sell bias)
```

## Aroon Indicator

### Calculation:
```
Aroon-Up   = ((Period - Days since highest high) / Period) x 100
Aroon-Down = ((Period - Days since lowest low) / Period) x 100
```

### Signal Rules:
```
BUY:  Aroon-Up > 50 AND Aroon-Down < 30
SELL: Aroon-Down > 50 AND Aroon-Up < 30
```

## Alligator Indicator (Bill Williams)

### Components (Three Smoothed Moving Averages):
```
Jaw   = 13-period SMMA, shifted 8 bars into the future
Teeth = 8-period SMMA, shifted 5 bars into the future
Lips  = 5-period SMMA, shifted 3 bars into the future
```

### Signal Rules:
```
SLEEPING (no trade): All three MAs intertwined
AWAKENING: MAs begin to separate
EATING (trending): All three MAs separated and ordered
  Bullish: Lips > Teeth > Jaw
  Bearish: Lips < Teeth < Jaw
```

## Stochastic Oscillator

### Formula:
```
%K = ((Current Close - Lowest Low over n periods) / (Highest High over n periods - Lowest Low over n periods)) x 100
%D = 3-period SMA of %K
```

### Standard Parameters:
- %K Period: 14
- %K Slowing: 3
- %D Period: 3

### Signal Rules:
```
%K > 80 = OVERBOUGHT --> Potential sell signal
%K < 20 = OVERSOLD   --> Potential buy signal

BUY:  %K crosses ABOVE %D in oversold zone (below 20)
SELL: %K crosses BELOW %D in overbought zone (above 80)
```

### Implementation:
```python
def stochastic(highs, lows, closes, k_period=14, d_period=3):
    k_values = []
    for i in range(k_period - 1, len(closes)):
        lowest_low = min(lows[i - k_period + 1:i + 1])
        highest_high = max(highs[i - k_period + 1:i + 1])
        if highest_high == lowest_low:
            k = 50
        else:
            k = ((closes[i] - lowest_low) / (highest_high - lowest_low)) * 100
        k_values.append(k)
    d_values = [sum(k_values[i:i+d_period])/d_period 
                for i in range(len(k_values) - d_period + 1)]
    return k_values, d_values
```

---

# CHAPTER 21: TRADINGVIEW FEATURES

## Key Features for Technical Analysis
1. **Multi-Timeframe Analysis**: View multiple timeframes simultaneously with synchronized crosshair.
2. **Annotation Management**: Add text annotations to specific timeframes only.
3. **Study Visibility**: Restrict indicators/studies (like Fibonacci) to particular timeframes.
4. **Navigation**: "Go-to date" feature to jump to specific candle points.
5. **Drawing Tools**: Multiple trend lines and indicators with undo functionality.
6. **Image Export**: Alt+S for HD-quality chart images.

## Limitations of Free Version:
- No Pine Script editor
- No bar replay functionality
- No volume profile indicator
- No VWAP
- No price alerts

---

# CHAPTER 22: CENTRAL PIVOT RANGE (CPR)

## Core Formulas

### Pivot Point (PP):
```
Pivot = (High + Low + Close) / 3
```

### Bottom Central Pivot (BC):
```
BC = (High + Low) / 2
```

### Top Central Pivot (TC):
```
TC = (Pivot - BC) + Pivot
# Simplified: TC = 2 * Pivot - BC
```

## Timeframe for OHLC Data

| Chart Timeframe | Use Previous Period's OHLC |
|----------------|---------------------------|
| EOD (daily) charts | Previous MONTH's OHLC |
| 30-min & 1-hour candles | Previous WEEK's OHLC |
| 1, 3, 5, 10, 15-min candles | Previous DAY's OHLC |

## Extended Support & Resistance Levels

### Resistance Levels:
```
R1 = (2 x Pivot) - Low
R2 = Pivot + (High - Low)
R3 = High + 2 x (Pivot - Low)
R4 = R3 + (High - Low)
```

### Support Levels:
```
S1 = (2 x Pivot) - High
S2 = Pivot - (High - Low)
S3 = Low - 2 x (High - Pivot)
S4 = S3 - (High - Low)
```

### Implementation:
```python
def calculate_cpr(high, low, close):
    pivot = (high + low + close) / 3
    bc = (high + low) / 2
    tc = (2 * pivot) - bc
    
    r1 = (2 * pivot) - low
    r2 = pivot + (high - low)
    r3 = high + 2 * (pivot - low)
    r4 = r3 + (high - low)
    
    s1 = (2 * pivot) - high
    s2 = pivot - (high - low)
    s3 = low - 2 * (high - pivot)
    s4 = s3 - (high - low)
    
    return {
        'tc': tc, 'pivot': pivot, 'bc': bc,
        'r1': r1, 'r2': r2, 'r3': r3, 'r4': r4,
        's1': s1, 's2': s2, 's3': s3, 's4': s4
    }
```

## CPR Trading Rules

### Bullish Setup:
```
Current price > TC --> Look for BUYING opportunities
Strategy: Wait for pullback to TC line (acts as support)
```

### Bearish Setup:
```
Current price < BC --> Look for SELLING opportunities
Strategy: Wait for pullback to BC line (acts as resistance)
```

### Range Trading:
```
Buy at BC with target at TC
Short at TC with target at BC
```

## CPR Width Interpretation
```
NARROW CPR = Previous session was SIDEWAYS (expect breakout)
WIDE CPR   = Previous session was TRENDING (higher the trend, wider the CPR)
```

## Virgin CPR
A CPR level that was never touched/tested by price. When price eventually reaches a virgin CPR level, it tends to act as strong support/resistance.

---

# MASTER SIGNAL GENERATION FRAMEWORK

## For Automated Strategy Development

### Signal Priority (Strongest to Weakest):
```
1. Candlestick Pattern + S/R Alignment + Volume Confirmation + Indicator Confirmation
2. Candlestick Pattern + S/R Alignment + Volume Confirmation
3. Candlestick Pattern + Volume Confirmation + Indicator Confirmation
4. Candlestick Pattern + S/R Alignment
```

### Complete Automated Checklist Implementation:
```python
def evaluate_trade(candle_pattern, sr_aligned, volume_confirmed, 
                   dow_aligned, indicator_confirmed, rrr):
    """
    Returns trade recommendation based on Varsity checklist.
    Minimum 3-4 criteria must be satisfied.
    """
    score = 0
    
    # Checkpoint 1: Recognizable candlestick pattern
    if candle_pattern is not None:
        score += 1
    
    # Checkpoint 2: S/R alignment (within 4% of stoploss)
    if sr_aligned:
        score += 1
    
    # Checkpoint 3: Volume above 10-day average
    if volume_confirmed:
        score += 1
    
    # Checkpoint 4: Dow Theory alignment
    if dow_aligned:
        score += 1
    
    # Checkpoint 5: Indicator confirmation (RSI + MACD)
    if indicator_confirmed:
        score += 1
    
    # Checkpoint 6: Risk-Reward >= 1.5
    if rrr >= 1.5:
        score += 1
    
    if score >= 4:
        return "STRONG_SIGNAL"
    elif score >= 3:
        return "MODERATE_SIGNAL"
    else:
        return "NO_TRADE"
```

### Position Sizing Based on Confirmation:
```
4+ checkpoints confirmed: Full position size
3 checkpoints confirmed: 50-75% position size
< 3 checkpoints: NO TRADE
```

---

# INDICATOR QUICK REFERENCE

| Indicator | Type | Best Market | Parameters | Buy Signal | Sell Signal |
|-----------|------|-------------|------------|------------|-------------|
| RSI | Leading/Oscillator | All | Period=14 | RSI < 30 (oversold) | RSI > 70 (overbought) |
| MACD | Lagging/Trend | Trending | 12, 26, 9 | MACD > Signal Line | MACD < Signal Line |
| Bollinger Bands | Volatility | Sideways | 20, 2 | Price at Lower Band | Price at Upper Band |
| Stochastic | Oscillator | All | 14, 3, 3 | %K < 20 + crossover | %K > 80 + crossover |
| ADX | Trend Strength | All | 14 | ADX>25 + +DI>-DI | ADX>25 + -DI>+DI |
| ATR | Volatility | All | 14 | N/A (SL placement) | N/A (SL placement) |
| Supertrend | Trend | Trending | ATR(10), Mult=3 | Price > Supertrend | Price < Supertrend |
| VWAP | Intraday | Intraday | Cumulative | Price > VWAP | Price < VWAP |
| SMA Crossover | Trend | Trending | 50, 200 | Golden Cross | Death Cross |
| EMA Crossover | Trend | Trending | 9, 21 | Short > Long | Short < Long |

---

# IMPORTANT TRADING RULES SUMMARY

1. **Always use stoploss** -- non-negotiable
2. **Minimum RRR of 1.5** for swing trades
3. **Volume must confirm** -- never trade on low volume days
4. **Prior trend is mandatory** for reversal patterns (except Marubozu)
5. **S/R alignment within 4%** of stoploss or skip the trade
6. **Take ALL signals** from your system -- don't cherry-pick
7. **Cut losses quickly** -- if stoploss triggers, EXIT
8. **Trail stoploss** -- healthy practice to lock in profits
9. **Start with EOD/swing trading** before attempting intraday
10. **Indicators confirm, not dictate** -- they supplement patterns, not replace them
11. **Candlestick range filter**: Skip candles with range < 1% or > 10%
12. **Patience**: Most days will have NO qualifying trades -- that's normal
