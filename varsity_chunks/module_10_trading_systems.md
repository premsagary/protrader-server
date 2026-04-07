# Module 10: Trading Systems -- Zerodha Varsity Complete Knowledge Base

> Source: https://zerodha.com/varsity/module/trading-systems/
> 16 Chapters Covering: Pair Trading (2 Methods), Calendar Spreads, Momentum Portfolios
> Purpose: Automated trading system construction, backtesting, and signal generation

---

## TABLE OF CONTENTS

1. [Chapter 1: What to Expect](#chapter-1-what-to-expect)
2. [Chapter 2: Pair Trading Logic](#chapter-2-pair-trading-logic)
3. [Chapter 3: Tracking Pairs -- Spreads, Ratios, Correlation](#chapter-3-tracking-pairs)
4. [Chapter 4: Pair Statistics -- Correlation & Descriptive Stats](#chapter-4-pair-statistics)
5. [Chapter 5: Pre-Trade Setup -- Standard Deviation & Normal Distribution](#chapter-5-pre-trade-setup)
6. [Chapter 6: The Density Curve](#chapter-6-the-density-curve)
7. [Chapter 7: The Pair Trade -- Execution](#chapter-7-the-pair-trade)
8. [Chapter 8: Straight Line Equation (Method 2 Begins)](#chapter-8-straight-line-equation)
9. [Chapter 9: Linear Regression](#chapter-9-linear-regression)
10. [Chapter 10: The Error Ratio](#chapter-10-the-error-ratio)
11. [Chapter 11: The ADF Test](#chapter-11-the-adf-test)
12. [Chapter 12: Trade Identification](#chapter-12-trade-identification)
13. [Chapter 13: Live Example 1](#chapter-13-live-example-1)
14. [Chapter 14: Live Example 2](#chapter-14-live-example-2)
15. [Chapter 15: Calendar Spreads](#chapter-15-calendar-spreads)
16. [Chapter 16: Momentum Portfolios](#chapter-16-momentum-portfolios)

---

## SYSTEM OVERVIEW

This module covers **four distinct trading systems**:

| System | Type | Chapters | Complexity |
|--------|------|----------|------------|
| Pair Trading Method 1 (Correlation-Based) | Mean Reversion | 2--7 | Moderate |
| Pair Trading Method 2 (Regression/Cointegration) | Statistical Arbitrage | 8--14 | Advanced |
| Calendar Spreads | Mean Reversion (Futures) | 15 | Moderate |
| Momentum Portfolios | Trend Following | 16 | Moderate |

---

## Chapter 1: What to Expect

### Definition of a Trading System

A trading system is a **quantifiable, defined process** for trading markets. It contrasts with ad-hoc methods (gut feeling, tips, broker advice, TV recommendations) that cannot be backtested.

### Trading System Architecture (Three Components)

1. **Input Provision** -- Trader supplies system parameters
2. **Processing** -- System executes defined logic
3. **Output Interpretation** -- Results guide trading decisions

### Key Principles

- Trading systems are NOT guaranteed profit machines
- They provide structured decision-making frameworks
- Success requires proper design, testing, and adherence to rules
- Backtesting is the trader's responsibility (system must be validated on historical data)

### Illustrative Example: PSU Bank Announcement Trade

- Government announced capital injection into PSU banks
- PSU Bank index surged 27.75%
- PSU banks comprise only ~10% of Bank Nifty composition -- potential mispricing
- Systematic deduction led to a short strangle position, collecting 253 points premium per lot
- Demonstrates how structured analysis identifies opportunities ad-hoc trading misses

---

## Chapter 2: Pair Trading Logic

### Core Concept

Two highly correlated stocks (similar businesses) move together. When one deviates due to a local event, pair traders exploit the temporary mispricing by buying the undervalued security and selling the overvalued one.

### Stock Selection Criteria for Pairs

Stocks must share:
- Similar business models
- Comparable product offerings
- Similar customer bases
- Similar market presence
- Identical regulatory constraints
- Comparable business challenges

**Example**: HDFC Bank and ICICI Bank (both private sector banks with similar products and clients).

### Trading Logic

```
IF Stock_A rises X% AND Stock_B remains flat:
    Stock_A is OVERVALUED relative to Stock_B
    ACTION: Sell Stock_A, Buy Stock_B
    
IF Stock_A falls X% AND Stock_B remains flat:
    Stock_A is UNDERVALUED relative to Stock_B
    ACTION: Buy Stock_A, Sell Stock_B
```

### Anomaly Sources (Price Deviation Triggers)

1. Company-specific earnings announcements
2. Executive departures
3. Speculation imbalances
4. Local news affecting a single company

### Classification

- **Alternative Names**: Relative Value Trading, Statistical Arbitrage
- **NOT Market Neutral**: True market neutrality requires identical underlying at different expirations (like calendar spreads)

### Historical Context

- First executed by Gerry Bamberger at Morgan Stanley (early 1980s)
- Popularized by Nunzio Tartaglia
- D.E. Shaw hedge fund adopted it early

### Two Quantification Methods

1. **Method 1**: Price spreads, ratios, and correlation (Chapters 3--7)
2. **Method 2**: Linear regression and cointegration (Chapters 8--14)

---

## Chapter 3: Tracking Pairs

### Key Metrics and Formulas

#### Spread
```
Spread = Closing_Value_Stock1 - Closing_Value_Stock2
```
- Values can be percentage changes from previous close
- If S1 = +6.1% and S2 = -3.85%, Spread = 6.1 - (-3.85) = 9.95
- Expands when S1 positive and S2 negative
- Contracts when both positive
- Suitable for both daily and intraday tracking

#### Differential
```
Differential = Closing_Price_Stock1 - Closing_Price_Stock2
```
- Measures absolute price difference
- Example: Stock1 at 175, Stock2 at 232 => Differential = -57
- Best for end-of-day analysis; less effective intraday

#### Ratio
```
Ratio = Price_Stock1 / Price_Stock2
```
- More stable representation of stock relationships over time
- Captures market valuation elements

#### Divergence
- Ratio/spread moves apart (increases)
- Chart moves upward
- Traders establish divergence trades when expecting this pattern

#### Convergence
- Ratio/spread moves closer (decreases)
- Chart moves downward
- Traders establish convergence trades when expecting this pattern

### Correlation

```
Correlation range: -1.0 to +1.0

+1.0 = Perfect positive correlation (move together identically)
 0.0 = No relationship
-1.0 = Perfect negative correlation (move opposite)
```

**Key Properties:**
- Sign indicates direction (positive = same direction, negative = opposite)
- Magnitude indicates strength (closer to +/-1 = stronger)
- Does NOT indicate magnitude of movement
- Correlation between A and B equals correlation between B and A

**Example**: If Corr(A,B) = 0.75, and A's daily avg return = 0.9%, B's daily avg return = 1.2%:
- When A moves above 0.9%, B likely moves above 1.2%
- Direction is predictable, magnitude is NOT

**Stationarity Requirement**: For correlation validity, data must be "stationary around the mean."

---

## Chapter 4: Pair Statistics

### Data Requirements

- Minimum: ~496 data points (approximately 2 years of daily data)
- **Critical**: Ensure identical number of data points for both stocks
- **Critical**: Match data to the exact same dates
- **Critical**: Clean data for corporate actions (bonuses, splits, dividends)

### Daily Returns Calculation
```
Daily_Return = (Today_Close / Previous_Day_Close) - 1
```

### Three Correlation Methods

| Method | Formula | When to Use |
|--------|---------|-------------|
| Closing Price Correlation | CORREL(Price_A, Price_B) | Acceptable but not preferred |
| Daily % Return Correlation | CORREL(Return_A, Return_B) | **Preferred** -- returns are normally distributed |
| Absolute Daily Change | CORREL(DailyChange_A, DailyChange_B) | Less reliable |

### Correlation Quality Threshold

```
MINIMUM acceptable correlation: 0.75
Optimal: > 0.85
```

### Descriptive Statistics

#### Mean (Arithmetic Average)
```
Mean = Sum_of_all_observations / Number_of_observations
Excel: =AVERAGE(range)
```

#### Median
```
For even dataset: Average of two middle values
For odd dataset: Middle value directly
Excel: =MEDIAN(range)
```

#### Mode
```
Most frequently occurring value
Excel: =MODE(range)
```

**Mean-Median Relationship**: When viewed together, provides trend indication.

---

## Chapter 5: Pre-Trade Setup

### Normal Distribution -- The Foundation of Pair Trading

```
Within 1st Standard Deviation: 68% of data
Within 2nd Standard Deviation: 95% of data  
Within 3rd Standard Deviation: 99.7% of data
```

### Standard Deviation Calculation

```
SD = Standard Deviation (sigma)
Excel: =STDEV.P(range)

Absolute Deviation:
Excel: =AVEDEV(range)
```

**Definition**: Quantifies the amount of variation or dispersion from the average.

### Standard Deviation Table Construction

For any metric (Spread, Differential, or Ratio), given Mean and SD:

```
+3 SD = Mean + (3 x SD)
+2 SD = Mean + (2 x SD)
+1 SD = Mean + (1 x SD)
 Mean  = Mean
-1 SD = Mean - (1 x SD)
-2 SD = Mean - (2 x SD)
-3 SD = Mean - (3 x SD)
```

**Example** (Spread data, Mean = 0.064, SD = 8.075):

| Level | Value |
|-------|-------|
| +3 SD | 24.288 |
| +2 SD | 16.123 |
| +1 SD | 8.139 |
| Mean | 0.064 |
| -1 SD | -8.011 |
| -2 SD | -16.086 |
| -3 SD | -24.160 |

### Trading Application

If a differential reading = 315, and +2SD = ~315:
- 95% confidence that the NEXT data points will NOT go higher
- Only 5% chance of further deviation
- **Signal**: Initiate mean-reversion trade

---

## Chapter 6: The Density Curve

### Variable Selection: Why Ratio is Preferred

The **ratio** is preferred over spread/differential because:
1. Captures market valuation (uses latest stock prices)
2. Provides quick transaction guidance (e.g., Ratio = 2.375 means 1 share of Stock1 requires 2.375 shares of Stock2)

**Rule**: Commit to ONE variable (spread, differential, or ratio) to avoid conflicting signals.

### Mean Reversion Principle

```
IF ratio > mean:
    Short the ratio (expect reversion downward)
    
IF ratio < mean:
    Long the ratio (expect reversion upward)
```

Key insight: "Irrespective of where the ratio is today, there is a great chance the ratio will come back to mean over the next few days."

### The Ambush Strategy

Do NOT trade every deviation. Wait for HIGH-PROBABILITY setups:
- At 2nd SD: 95% probability of mean reversion (only 5% chance of further drift)
- At 3rd SD: 99.7% probability of mean reversion (only 0.3% chance of further drift)

### Density Curve Calculation

```
Density = NORM.DIST(X, Mean, StdDev, TRUE)

Where:
  X     = Daily ratio value
  Mean  = Average ratio value
  StdDev = Ratio's standard deviation
  TRUE   = Cumulative distribution

Output range: 0 to 1
```

### Density Curve to Standard Deviation Mapping

| Density Curve Value | Standard Deviation | Probability of Reversion |
|--------------------|--------------------|--------------------------|
| 0.003 | -3 SD | 99.7% |
| 0.025 | -2 SD | 95% |
| 0.16 | -1 SD | 68% |
| 0.50 | Mean | -- |
| 0.84 | +1 SD | 68% |
| 0.974 | +2 SD | 95% |
| 0.997 | +3 SD | 99.7% |

---

## Chapter 7: The Pair Trade -- Execution (Method 1)

### Position Construction Rules

```
LONG PAIR TRADE:
  Buy Stock_A  (numerator in ratio)
  Sell Stock_B (denominator in ratio)

SHORT PAIR TRADE:
  Sell Stock_A (numerator in ratio)
  Buy Stock_B  (denominator in ratio)
```

### Complete Entry/Exit Trigger Table

| Trade Type | Entry Trigger (Density) | SD Level | Target | Stop Loss |
|-----------|------------------------|----------|--------|-----------|
| Long | Between 0.025 and 0.003 | Between -2 SD and -3 SD | 0.25 or lower | 0.003 or higher (beyond -3 SD) |
| Short | Between 0.975 and 0.997 | Between +2 SD and +3 SD | 0.975 or lower | 0.997 or higher (beyond +3 SD) |

### Live Trade Example 1: Long Pair (Axis Bank vs ICICI Bank)

**Entry (Oct 25, 2017):**
- Density Curve: 0.05234
- Ratio: 1.54
- Buy Axis Bank @ Rs. 473 (Lot: 1,200 shares) => Rs. 567,600
- Sell ICICI Bank @ Rs. 305.7 (Lot: 2,750 shares) => Rs. 840,675

**Exit (Oct 31, 2017):**
- Density Curve: 0.26103 (near target)
- Ratio: 1.743
- Sell Axis @ Rs. 523
- Buy ICICI @ Rs. 300.1

| Stock | Entry | Exit | Qty | P/L per share | Total P&L |
|-------|-------|------|-----|---------------|-----------|
| Axis Bank | 473 | 523 | 1,200 | +50 | +Rs. 60,000 |
| ICICI Bank | 305.7 | 300.1 | 2,750 | +5.6 | +Rs. 15,400 |
| **NET** | | | | | **+Rs. 75,400** |

### Live Trade Example 2: Short Pair (Axis Bank vs ICICI Bank)

**Entry (Aug 9, 2016):**
- Density Curve: 0.99063
- Ratio: 2.34
- Sell Axis Bank @ Rs. 574.1 (Lot: 1,200)
- Buy ICICI Bank @ Rs. 245.35 (Lot: 2,750)

**Exit (Sep 8, 2016):**
- Density Curve: 0.979182
- Ratio: 2.27
- Buy Axis @ Rs. 571
- Sell ICICI @ Rs. 276.33

| Stock | Entry | Exit | Qty | P/L per share | Total P&L |
|-------|-------|------|-----|---------------|-----------|
| Axis Bank | 574.1 | 571 | 1,200 | +3.1 | +Rs. 3,720 |
| ICICI Bank | 245.3 | 276.33 | 2,750 | +31.03 | +Rs. 85,330 |
| **NET** | | | | | **+Rs. 89,052** |

Trade duration: approximately 1 month.

### Critical Operational Notes

- **Trade Frequency**: For a given pair, expect at most 2--3 signals per year
- **Capital Requirement**: Pair trading is a "margin money guzzler" -- very capital intensive
- **P&L Pattern**: Typically ONE stock contributes most of the profit (the deviated one)
- **Data**: 2 years of historical data recommended; rolling daily updates required
- **Multi-Pair Tracking**: Track multiple pairs simultaneously for consistent opportunities
- **Rupee Neutrality**: Ideally maintain equal rupee values on both legs for true hedging

---

## Chapter 8: Straight Line Equation (Pair Trading Method 2 Begins)

### The Regression Equation

```
Y = mx + e

Where:
  Y = Dependent variable (stock being predicted)
  m = Slope (scaling factor / relationship strength)
  x = Independent variable (predictor stock)
  e = Intercept (constant; Y-value when X = 0)
```

### Slope Interpretation

- Slope of 2: dependent variable changes 2x the independent variable
- Slope of 0: no relationship exists; Y = e (constant)
- Slope reveals the extent to which the independent variable must be scaled

### Application to Pair Trading

When the relationship between two stocks is not obvious (unlike perfectly correlated pairs), **linear regression** is required to detect and quantify the hidden relationship. This is the foundation for statistical arbitrage / relative value trading.

---

## Chapter 9: Linear Regression

### Regression Output

Linear regression takes two arrays of numbers and produces:
- **Slope (m)**: The beta coefficient
- **Intercept (b)**: The constant term
- **Residuals**: Difference between predicted and actual values
- **Standard Error**: Statistical measures of fit quality

### The Regression Equation for Stocks

```
Y_predicted = Slope * X + Intercept

Example: Y = 1.885 * X - 7.859813
```

### Residuals -- The Key to Pair Trading Method 2

```
Residual = Predicted_Y - Actual_Y

Example: 
  X = 18
  Predicted Y = 1.885(18) - 7.859 = 26.070
  Actual Y = 22
  Residual = 26.070 - 22 = 4.070
```

**Critical Insight**: Residuals are the ONLY tradeable component in Method 2. They form a stationary time series whose behavior is predictable.

### Excel Implementation

1. Install Analysis ToolPak (File > Options > Add-Ins)
2. Data > Data Analysis > Regression
3. Input Y range (dependent variable)
4. Input X range (independent variable)
5. Check "Labels", select "Residuals" and "Standardized Residuals"
6. Output: Coefficients table + Residuals table

---

## Chapter 10: The Error Ratio

### Determining X (Independent) vs Y (Dependent)

The Error Ratio determines which stock assignment produces stronger regression results.

### Formula

```
Error_Ratio = Standard_Error_of_Intercept / Standard_Error

Where:
  Standard_Error = Standard Deviation of all residuals
  Standard_Error_of_Intercept = Variance measure of estimated intercept
```

### Decision Rule

```
1. Regress Stock_A (X) vs Stock_B (Y) => compute Error_Ratio_1
2. Regress Stock_B (X) vs Stock_A (Y) => compute Error_Ratio_2
3. SELECT the assignment with the LOWER Error Ratio
```

### Worked Example: ICICI and HDFC Banks

| Regression | Equation | Error Ratio |
|-----------|----------|-------------|
| ICICI(X), HDFC(Y) | HDFC = ICICI * 7.613 - 663.677 | 0.401 |
| HDFC(X), ICICI(Y) | ICICI = HDFC * 0.09 + 142.4677 | **0.227** |

**Selection**: HDFC = X (independent), ICICI = Y (dependent) because 0.227 < 0.401

### Why Error Ratio Matters

- The regression equation must explain the variation in price of the dependent variable as much as possible
- Lower error ratio = more reliable intercept = stronger model
- A large, unreliable intercept undermines the entire pair trade

### Data Quality Requirements

1. Data adjusted for splits, bonuses, and other corporate actions
2. Matching exact dates across both datasets
3. Consistent time periods (recommended: 2 years / ~500 trading days)

---

## Chapter 11: The ADF Test (Augmented Dickey-Fuller)

### Purpose: Testing for Cointegration

Two time series are cointegrated when they "move together and if at all there is a deviation, it is temporary" and they "revert to their regular orbit."

### Stationarity -- Three Required Conditions

A stationary time series must satisfy ALL three:

1. **Constant Mean**: Mean remains stable across time periods. Split data into thirds and compare.
2. **Consistent Standard Deviation**: Volatility stays within defined range (e.g., 14--19%).
3. **No Autocorrelation**: Current values do not depend on previous values. Test using lagged correlations -- should approach zero.

### ADF Test Output

```
ADF Test => p-value

p-value = Probability that the series is NOT stationary
```

### Critical Decision Threshold

```
IF p-value <= 0.05:
    Residuals are STATIONARY (95% confidence)
    Pair is COINTEGRATED
    PROCEED with trade analysis
    
IF p-value > 0.05:
    Residuals are NON-STATIONARY
    Pair is NOT suitable for trading
    REJECT the pair
```

### Implementation Workflow

```
1. Run linear regression on stock pair (X independent, Y dependent)
2. Extract residuals from regression output
3. Conduct ADF test on residuals
4. Verify p-value <= 0.05
5. Confirm intercept and beta coefficients
```

### Important Distinctions

- **Correlation** assumes stationarity; cointegration does NOT
- **Regression p-value** measures model goodness-of-fit
- **ADF p-value** measures residual stationarity (different thing entirely!)
- Only residuals from the LOWER error-ratio regression need ADF testing

### Data Requirements

- Minimum lookback: 200 trading days
- Date ordering: oldest to newest for accurate p-value
- Clean data adjusted for corporate actions

---

## Chapter 12: Trade Identification

### The Fundamental Equation Decomposed

```
y = M * x + c + e

Where:
  y = Dependent stock price
  M = Beta (slope) -- the HEDGE RATIO
  x = Independent stock price
  c = Intercept (constant)
  e = Residuals (the TRADEABLE component)
```

### Three Components from a Trader's Perspective

#### 1. Price Hedging (M * x component)
Beta reveals the **hedge ratio**:
```
If Beta = 7.61:
  7.61 shares of Stock_X = 1 share of Stock_Y
  This eliminates directional risk through simultaneous long/short
```

#### 2. Intercept Management (c component)
The intercept remains **unhedged** and must be minimized:
```
Intercept_Ratio = Intercept / Stock_Y_Price

IF Intercept_Ratio > 0.30 (i.e., >30%):
    Model explains too little -- REJECT the pair
    
IF Intercept_Ratio < 0.20 (i.e., <20%):
    Acceptable
    
PREFERRED: R-squared >= 0.70 (model explains 70%+ of Y's behavior)
```

#### 3. Residual Trading (e component)
Residuals are the ONLY tradeable element because they are stationary and normally distributed.

### Z-Score Calculation

```
Z = (y - (x * Beta) - Intercept) / Sigma

Where:
  Sigma = Standard Error of the residuals
```

This standardized metric enables consistent triggers regardless of absolute price levels.

### Trade Initiation Signals

```
LONG ENTRY: Z-score hits -2.0 SD (or -2.5 SD for higher confidence)
  Action: Buy Y (dependent), Sell X (independent)
  
SHORT ENTRY: Z-score hits +2.0 SD (or +2.5 SD for higher confidence)
  Action: Sell Y (dependent), Buy X (independent)

STOP LOSS: 3.0 SD (99.7% statistical confidence)
TARGET: Mean reversion toward 0 SD (or -1.0 SD / +1.0 SD)
```

### Execution Principles

1. **Daily regression updates** before trade initiation to capture latest data
2. **Freeze the regression equation** once positioned (do not update mid-trade)
3. **Hold through mean reversion** -- residuals revert toward zero
4. **One leg typically profits** more; both rarely profit simultaneously
5. **Position sizes** derive directly from beta coefficient

---

## Chapter 13: Live Example 1 (Tata Motors / Tata Motors DVR)

### Pre-Trade Checklist (Method 2)

```
1. Error Ratio: Select lowest ratio to determine X and Y
2. ADF Test: p-value must be <= 0.05
3. Z-Score: Must be at +/-2.5 SD or beyond
4. Beta: Must be POSITIVE (negative betas are non-tradeable)
5. Intercept: Model must explain 70%+ of Y's behavior
```

### Signal Triggers (Refined from Chapter 12)

| Signal | Z-Score | Action | Target | Stop Loss |
|--------|---------|--------|--------|-----------|
| Long Entry | <= -2.5 SD | Buy Y, Short X | -1.0 SD | -3.0 SD |
| Short Entry | >= +2.5 SD | Sell Y, Buy X | +1.0 SD | +3.0 SD |

### Standard Error (Z-Score) Calculation

```
Z-Score = Today's_Residual / Standard_Error_of_Residuals

Example: 20.924 / 22.776 = 0.918
```

### Beta-Neutral Position Sizing

```
For every 1 share of Y, need Beta * shares of X

Example:
  Tata Motors (Y) lot: 1,500 shares
  Tata Motors DVR (X) lot: 2,400 shares
  Beta: 1.59
  Required X shares: 1,500 * 1.59 = 2,385
  Actual X lot: 2,400 (close enough -- 115 share variance accepted)
```

### Live Trade: Tata Motors vs Tata Motors DVR (May 2018)

**Pair Parameters:**
- Y = Tata Motors (dependent)
- X = Tata Motors DVR (independent)
- ADF: 0.0179 (excellent)
- Z-Score at entry: -2.54

**Entry (May 14, 2018):**
- Long 1,500 shares Tata Motors
- Short 2,400 shares Tata Motors DVR

**Management (May 14--23):**
- Daily Z-score monitoring
- Multiple intraday updates
- No position adjustment despite extended hold

**Exit (May 23, 2018):**
- Z-score reached target level (~-1.0 SD)
- **Net P&L: ~Rs. 14,000**
- Gains in Tata Motors DVR >> Loss in Tata Motors

**Key Principle**: "The only thing that matters is where the residual is trading." Price levels, support/resistance, and RSI are deliberately ignored.

### Partial Hedge Scenario

When exact beta neutrality is impossible with standard lots:
```
Example:
  Signal: Short Allahabad Bank (Y), Long Union Bank (X)
  Beta: 0.437
  Allahabad lot: 10,000 shares
  Required Union Bank: 10,000 * 0.437 = 4,378 shares
  Union Bank lot: 4,000 shares
  
  Solution: Buy 4,000 shares via futures + 370 shares in spot market
```

### Advanced Extension: Multivariate Regression

"What if Stock A with Stock B is not stationary, but Stock A is stationary with Stock B and C as a combined entity?" This extends pairs into multi-leg arbitrage (significantly more complex).

---

## Chapter 14: Live Example 2 -- Position Sizing and The Intercept Problem

### Beta-Neutral Lot Calculation Formula

```
Equivalent_Shares = Larger_Lot_Size / Beta

Example:
  Stock X (ICICI): Price 298.8, Lot 2,750
  Stock Y (HDFC): Price 2,024.8, Lot 500
  Beta: 0.79
  
  Required HDFC shares: 2,750 / 0.79 = 3,481
  Nearest lot: 3,500 = 7 lots of HDFC (500 * 7)
  Result: 7 lots HDFC vs 1 lot ICICI = Beta neutral
```

### The Intercept Problem -- A CRITICAL Warning

```
Intercept_Ratio = Intercept / Stock_Y_Price

Example:
  HDFC price: Rs. 2,024
  Intercept: 1,626
  Ratio: 1,626 / 2,024 = 80% UNEXPLAINED

INTERPRETATION: Regression explains only 20% of Y's price movements
DECISION: REJECT this pair -- "I'd rather avoid this"
```

### Acceptable Intercept Thresholds

| Intercept as % of Y Price | Assessment |
|---------------------------|------------|
| Below 20% | Acceptable |
| 20--30% | Borderline |
| Above 30% | RISKY -- Reject |
| R-squared >= 0.70 | Preferred target |

### Complete Pre-Trade Decision Framework

```
STEP 1: ADF Test -- p-value < 0.05? If NO => REJECT
STEP 2: Beta -- Is it POSITIVE? If NO => REJECT (negative betas non-tradeable)
STEP 3: Z-Score -- At +/-2.5 SD or beyond? If NO => WAIT
STEP 4: Intercept Test -- Model explains 70%+ of Y? If NO => REJECT
STEP 5: Position Sizing -- Calculate beta-neutral lots
STEP 6: EXECUTE trade
```

### The Trade-Off Principle

"If the regression is strong, you get reliable trades but they will be rare. If the regression is not strong, you get frequent but unreliable trades."

**Optimal guidance**: Pursue R-squared >= 0.70 despite reduced frequency.

### Practical Considerations

- **Corporate Events**: Avoid trading during results season; fundamental events disrupt pair relationships
- **Data Requirements**: Minimum 200 trading days, rolling windows, clean data
- **Average Holding Period**: ~21 days
- **Risk Priority**: "I'd look at risk first and then the reward"

---

## Chapter 15: Calendar Spreads

### Strategy Definition

Simultaneously buy and sell futures contracts of the **same underlying** but with **different expiration dates**.

```
Example:
  Buy TCS Futures expiring 28th June 2018 @ 1846
  Sell TCS Futures expiring 28th July 2018 @ 1851
```

### Fundamental Logic

The spread between near-month and far-month contracts converges toward a mean value due to **cost of carry**. The far-month typically trades at a premium to the current month.

### Statistical Methodology

```
1. Download 200+ trading days of continuous futures closing prices
2. Obtain separate series for current-month and next-month contracts
3. Calculate daily spread: Current_Month_Price - Near_Month_Price
4. Compute Mean and Standard Deviation of spread series

Example (SBIN):
  Mean spread: 1.227
  Standard deviation: 0.4935
  Upper band: 1.227 + 0.4935 = 1.7205
  Lower band: 1.227 - 0.4935 = 0.7335
```

### Entry and Exit Rules

```
SELL SPREAD (when spread > Upper Band):
  Action: Sell near-month, Buy current-month
  Rationale: Near-month relatively expensive
  Exit: When spread collapses to mean
  
BUY SPREAD (when spread < Lower Band):
  Action: Buy near-month, Sell current-month
  Rationale: Current-month relatively expensive
  Exit: When spread returns to mean
```

### Backtest Results (SBIN)

| Signal Date | Entry Spread | Exit Date | Exit Spread | P&L |
|-------------|-------------|-----------|-------------|-----|
| 31-08-2017 | 2.45 | 01-09-2017 | 1.35 | +1.10 |
| 28-09-2017 | 2.60 | 29-09-2017 | 1.15 | +1.45 |
| 30-11-2017 | 2.35 | 01-12-2017 | 1.55 | +0.80 |
| 28-12-2017 | 3.80 | 29-12-2017 | 1.45 | +2.35 |
| 22-02-2018 | 2.50 | 23-03-2018 | 1.30 | +1.20 |
| 26-04-2018 | 1.85 | 27-04-2018 | 0.60 | +1.25 |

**Key Observation**: All short trades closed profitably, most within 1 day. Long trades showed mixed results.

### Characteristics

- **Risk**: Extremely low (directional risk eliminated)
- **Profit**: Modest absolute P&L
- **Timing**: Signals typically appear around month-ends (expiry dynamics)
- **Duration**: Most trades close within same day or 1--2 days
- **Leverage**: Can use higher leverage given hedged nature, but modest P&L often doesn't justify it

### Execution Risks

- Bid-ask spreads can eliminate anticipated profits
- Simultaneous execution critical -- use IOC (Immediate or Cancel) orders
- Slippage on market orders reduces realized spreads
- Low-cost broker essential given thin margins

### Pre-Deployment Backtest Checklist

```
1. Test each futures contract individually
2. Determine which contracts profit from shorts vs longs
3. Confirm spread convergence within acceptable timeframes
4. Account for commissions and slippage in P&L projections
5. Verify sufficient liquidity in BOTH contract months
6. Test across entire futures universe for daily opportunities
```

---

## Chapter 16: Momentum Portfolios

### Definition

**Momentum** = Rate of change of stock returns (measured on end-of-day basis).
Higher rate of change = stronger momentum.

### Critical Rule: Use Percentage Returns, NOT Absolute

```
Return = (Ending_Value / Starting_Value) - 1
```
This prevents bias toward higher-priced stocks.

### Strategy Overview

Build a portfolio of 10--12 stocks with the strongest price momentum. Hold through momentum phase. Rebalance monthly.

### Step-by-Step Implementation

#### Step 1: Define Tracking Universe
- Use large indices (Nifty 50, BSE 500)
- OR create custom universe with filters:
  - Market cap >= 1,000 Cr
  - Stock price < 2,000
  - Average daily volume > threshold
- **Recommended size**: 150--200 stocks minimum
- Portfolio is always a subset of tracking universe

#### Step 2: Obtain Clean Data
- Closing prices for all universe stocks
- **MUST be adjusted** for corporate actions (bonus, splits, special dividends)
- **Lookback period**: 1 year (365 calendar days / ~250 trading days)
- Update daily

#### Step 3: Calculate Returns
```
12_Month_Return = (Current_Price / Price_12_Months_Ago) - 1
```
Adaptable to other timeframes (6-month, quarterly, monthly, weekly).

#### Step 4: Rank Stocks
```
Rank all stocks from HIGHEST to LOWEST 12-month return
Rank 1 = Highest return
Rank N = Lowest return
```

#### Step 5: Portfolio Construction
```
Select top 10-12 stocks from ranked list
Allocate capital EQUALLY across selected stocks

Example:
  Capital: Rs. 200,000
  Stocks: 12
  Per-stock allocation: Rs. 16,666
```

**Alternative Allocation Schemes** (based on backtesting):
- 50% across top 5, 50% across remaining 7
- 40% to top 3, 60% across remaining 9
- Contrarian: More weight to lower-ranked momentum stocks

#### Step 6: Monthly Rebalancing
```
Timing: End of each calendar month (post-market close)

PROCESS:
1. Re-run ranking engine with latest 12-month data
2. Identify new top 10-12 performers
3. SELL stocks no longer in top rankings
4. BUY new entrants
5. Do NOT necessarily rebalance to equal weights if winners have appreciated
6. Continue riding winners; only replace dropouts
```

### Strategy Variations

#### Time Frequency Options
| Frequency | Ranking Period | Hold Period |
|-----------|---------------|-------------|
| Daily | Daily returns | 1 day (intraday) |
| Weekly | Weekly returns | 1 week |
| Fortnightly | 15-day returns | 15 days |
| Monthly | Monthly returns | 1 month |
| Standard | 12-month returns | Until rebalance |

#### Fundamental Momentum Metrics
- Quarterly sales growth (%)
- EPS growth
- EBITDA margin changes
- Net profit margin changes
- Profit margin improvements

#### Technical Filters (Overlay with Momentum)
- Volatility filter: Select stocks with declining ATR alongside momentum
- RSI filter
- MACD filter
- ADX filter
- Sharpe ratio ranking: Only select stocks with positive Sharpe
- Moving average filter: Require stocks above 20-day MA

### Critical Performance Characteristics

```
WORKS BEST:     Strong uptrends, bull markets
PERFORMS POORLY: Choppy/sideways markets
UNDERPERFORMS:  Downtrends, bear markets -- "bleeds heavier than markets"
```

**Author's experience**: "Great run in 2009 and '10, but took a bad hit in 2011."

### Market Cycle Awareness Rule

Momentum portfolios REQUIRE market regime detection. Consider overlaying with:
- Market breadth indicators
- Index-level trend detection
- Volatility regime classification (low vol = momentum favorable)

---

## CONSOLIDATED FORMULAS REFERENCE

### Pair Trading Method 1 (Correlation-Based)

```python
# Core Metrics
spread = close_stock1 - close_stock2
differential = price_stock1 - price_stock2
ratio = price_stock1 / price_stock2
daily_return = (today_close / prev_close) - 1
correlation = CORREL(returns_A, returns_B)  # Must be > 0.75

# Standard Deviation Table
sd_levels = {
    '+3SD': mean + 3 * std,
    '+2SD': mean + 2 * std,
    '+1SD': mean + 1 * std,
    'mean': mean,
    '-1SD': mean - 1 * std,
    '-2SD': mean - 2 * std,
    '-3SD': mean - 3 * std,
}

# Density Curve
density = NORM_DIST(daily_ratio, mean_ratio, std_ratio, cumulative=True)

# Trade Signals
if 0.003 <= density <= 0.025:   # Between -3SD and -2SD
    LONG: buy numerator, sell denominator
    target = density <= 0.25
    stop_loss = density >= 0.003 (beyond -3SD)

if 0.975 <= density <= 0.997:   # Between +2SD and +3SD
    SHORT: sell numerator, buy denominator
    target = density >= 0.975
    stop_loss = density <= 0.997 (beyond +3SD)
```

### Pair Trading Method 2 (Regression/Cointegration)

```python
# Linear Regression
Y = Beta * X + Intercept + Residual
# Y = dependent stock, X = independent stock

# Error Ratio (determines X vs Y assignment)
error_ratio = std_error_of_intercept / std_error_of_residuals
# Select assignment with LOWER error ratio

# ADF Test (stationarity of residuals)
adf_pvalue = ADF_TEST(residuals)
# MUST be <= 0.05

# Intercept Validation
intercept_ratio = intercept / stock_Y_price
# MUST be < 0.30 (prefer < 0.20)
# Equivalent: R-squared >= 0.70

# Z-Score
z_score = (Y - (X * Beta) - Intercept) / Sigma
# Sigma = standard error of residuals

# Trade Signals
if z_score <= -2.5:
    LONG: Buy Y, Short X
    target = z_score ~ -1.0
    stop_loss = z_score <= -3.0

if z_score >= +2.5:
    SHORT: Sell Y, Buy X
    target = z_score ~ +1.0
    stop_loss = z_score >= +3.0

# Position Sizing (Beta Neutral)
shares_X_needed = shares_Y * Beta
# OR: shares_Y_needed = lot_size_X / Beta
# Round to nearest lot size
```

### Calendar Spreads

```python
# Spread Calculation
spread = current_month_futures - next_month_futures

# Statistics
mean_spread = AVERAGE(spread_series)  # 200+ days
std_spread = STDEV(spread_series)
upper_band = mean_spread + std_spread
lower_band = mean_spread - std_spread

# Trade Signals
if spread > upper_band:
    SELL SPREAD: Sell near-month, Buy current-month
    exit when spread returns to mean

if spread < lower_band:
    BUY SPREAD: Buy near-month, Sell current-month
    exit when spread returns to mean
```

### Momentum Portfolio

```python
# Return Calculation
return_12m = (current_price / price_12_months_ago) - 1

# Ranking
ranked_stocks = sort(universe, by=return_12m, descending=True)

# Portfolio Construction
portfolio = ranked_stocks[:12]  # Top 12
allocation_per_stock = total_capital / 12  # Equal weight

# Monthly Rebalancing
new_rankings = recalculate_and_rank()
stocks_to_sell = current_portfolio - new_top_12
stocks_to_buy = new_top_12 - current_portfolio
# Execute sells and buys
# Do NOT force equal-weight on existing winners
```

---

## SYSTEM EVALUATION METRICS REFERENCE

### Metrics to Track for All Systems

| Metric | Formula / Description | Good Threshold |
|--------|----------------------|----------------|
| Win Rate | Winning_Trades / Total_Trades | > 50% for mean reversion |
| CAGR | (Ending_Value/Starting_Value)^(1/Years) - 1 | Beat benchmark index |
| Sharpe Ratio | (Portfolio_Return - Risk_Free_Rate) / Portfolio_StdDev | > 1.0 preferred |
| Max Drawdown | (Peak - Trough) / Peak | < 20% preferred |
| Profit Factor | Gross_Profit / Gross_Loss | > 1.5 |
| Average Trade Duration | Sum(Hold_Days) / N_Trades | System-dependent |
| Risk-Reward Ratio | Avg_Win / Avg_Loss | > 1.5 |

### System-Specific Evaluation

**Pair Trading Method 1:**
- Correlation threshold: > 0.75
- Density curve trigger: 0.025--0.003 (long) or 0.975--0.997 (short)
- Expected trades per pair per year: 2--3

**Pair Trading Method 2:**
- ADF p-value: <= 0.05
- Error ratio: lower is better
- Intercept ratio: < 20% of Y price (prefer R-sq > 0.70)
- Z-score trigger: +/- 2.5 SD
- Stop loss: +/- 3.0 SD
- Average holding period: ~21 days

**Calendar Spreads:**
- Mean +/- 1 SD bands
- Typical hold: 1--2 days
- Signals concentrate around month-end/expiry

**Momentum Portfolio:**
- 12-month return ranking
- Monthly rebalance
- 10--12 stock portfolio
- Equal weight baseline
- Performs best in bull markets; bleeds in bear markets

---

## DATA REQUIREMENTS SUMMARY

| System | Min Data Points | Lookback | Update Frequency | Data Adjustments |
|--------|----------------|----------|-----------------|------------------|
| Pair Trading M1 | ~500 (2 years) | 2 years | Daily | Splits, bonuses, dividends |
| Pair Trading M2 | 200+ trading days | 200 days | Daily (rolling) | Splits, bonuses, dividends |
| Calendar Spreads | 200+ trading days | 200 days | Daily | Continuous futures data |
| Momentum Portfolio | 250 trading days | 12 months | Daily | Splits, bonuses, dividends |

---

## COMPLETE PRE-TRADE CHECKLIST (ALL SYSTEMS)

### Pair Trading Method 1
- [ ] Stock pair from same sector/business type
- [ ] Correlation > 0.75 (daily % return correlation preferred)
- [ ] 2 years of clean historical data
- [ ] Ratio/spread/differential calculated
- [ ] Mean and standard deviation computed
- [ ] Density curve calculated using NORM.DIST
- [ ] Density in trigger zone (0.003--0.025 or 0.975--0.997)
- [ ] Capital sufficient for both legs (margin intensive)

### Pair Trading Method 2
- [ ] Error ratio calculated both ways; lower ratio selected
- [ ] ADF test p-value <= 0.05
- [ ] Beta is POSITIVE
- [ ] Intercept ratio < 30% of Y price (prefer < 20%)
- [ ] R-squared >= 0.70
- [ ] Z-score at +/-2.5 SD or beyond
- [ ] Beta-neutral position sizing calculated
- [ ] Avoid during earnings/corporate events
- [ ] Regression equation frozen once trade entered

### Calendar Spreads
- [ ] 200+ days continuous futures data
- [ ] Mean and SD of spread calculated
- [ ] Spread beyond +/-1 SD band
- [ ] Sufficient liquidity in both contract months
- [ ] Commission + slippage accounted for
- [ ] IOC orders prepared for simultaneous execution

### Momentum Portfolio
- [ ] Universe of 150--200 stocks defined
- [ ] Clean, corporate-action-adjusted data
- [ ] 12-month returns calculated for all stocks
- [ ] Stocks ranked highest to lowest
- [ ] Top 10--12 selected
- [ ] Equal-weight allocation computed
- [ ] Market regime assessed (bull/bear/sideways)
- [ ] Rebalance date set (end of month)

---

## KEY TAKEAWAYS BY SYSTEM

### Pair Trading (Both Methods)
1. Similar businesses' stock prices move together
2. Temporary deviations create trading opportunities
3. Buy undervalued, sell overvalued simultaneously
4. Mean reversion is the core profit mechanism
5. Capital intensive -- requires margin for both legs
6. 2--3 signals per pair per year (track multiple pairs)
7. One leg typically generates most of the profit
8. Data quality is paramount (corporate action adjustments)

### Calendar Spreads
1. Same underlying, different expirations
2. Cost of carry drives the spread relationship
3. Ultra-low risk, ultra-low reward
4. Signals cluster around expiry dates
5. Execution quality determines profitability
6. Backtest each contract individually

### Momentum Portfolios
1. Rate of change in returns drives stock selection
2. Always use percentage returns, never absolute
3. Top 12 stocks, equally weighted, monthly rebalance
4. Works in bull markets, bleeds in bear markets
5. Market regime awareness is essential
6. Can layer technical/fundamental filters
7. Ride winners; only replace dropouts

---

*Knowledge base compiled from all 16 chapters of Zerodha Varsity Module 10: Trading Systems*
*For use in automated trading system construction, backtesting, and signal generation*
