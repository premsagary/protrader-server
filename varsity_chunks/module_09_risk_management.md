# Module 9: Risk Management & Trading Psychology

## Zerodha Varsity -- Comprehensive Reference

---

# Table of Contents

1. [Chapter 1: Orientation Note](#chapter-1-orientation-note)
2. [Chapter 2: Risk (Part 1) -- Systematic & Unsystematic Risk](#chapter-2-risk-part-1--systematic--unsystematic-risk)
3. [Chapter 3: Risk (Part 2) -- Variance & Covariance](#chapter-3-risk-part-2--variance--covariance)
4. [Chapter 4: Risk (Part 3) -- Variance-Covariance Matrix](#chapter-4-risk-part-3--variance-covariance-matrix)
5. [Chapter 5: Risk (Part 4) -- Correlation Matrix & Portfolio Variance](#chapter-5-risk-part-4--correlation-matrix--portfolio-variance)
6. [Chapter 6: Equity Curve](#chapter-6-equity-curve)
7. [Chapter 7: Expected Returns](#chapter-7-expected-returns)
8. [Chapter 8: Portfolio Optimization (Part 1)](#chapter-8-portfolio-optimization-part-1)
9. [Chapter 9: Portfolio Optimization (Part 2) -- Efficient Frontier](#chapter-9-portfolio-optimization-part-2--efficient-frontier)
10. [Chapter 10: Value at Risk (VaR)](#chapter-10-value-at-risk-var)
11. [Chapter 11: Position Sizing (Part 1)](#chapter-11-position-sizing-part-1)
12. [Chapter 12: Position Sizing (Part 2) -- Equity Capital Models](#chapter-12-position-sizing-part-2--equity-capital-models)
13. [Chapter 13: Position Sizing (Part 3) -- Three Methods for Risk Control](#chapter-13-position-sizing-part-3--three-methods-for-risk-control)
14. [Chapter 14: Kelly's Criterion](#chapter-14-kellys-criterion)
15. [Chapter 15: Trading Biases (Part 1)](#chapter-15-trading-biases-part-1)
16. [Chapter 16: Trading Biases (Part 2)](#chapter-16-trading-biases-part-2)

---

# PART I: FORMULAS & QUANTITATIVE REFERENCE

## Master Formula Sheet

### 1. Variance

```
sigma^2 = SUM[(X - mu)^2] / N
```

Where:
- sigma^2 = Variance
- X = Daily return for each observation
- mu = Average (mean) of all daily returns
- N = Total number of observations

**Interpretation:** Higher variance = higher risk; lower variance = lower risk.

---

### 2. Standard Deviation

```
sigma = SQRT(variance) = SQRT( SUM[(X - mu)^2] / N )
```

- Standard Deviation is the square root of variance.
- Represents volatility of the stock or portfolio.
- Daily SD is annualized by multiplying by SQRT(252).

```
Annual SD = Daily SD x SQRT(252)
```

---

### 3. Covariance

```
Cov(x, y) = SUM[(Rt_S1 - Avg_Rt_S1) x (Rt_S2 - Avg_Rt_S2)] / (n - 1)
```

Where:
- Rt_S1 = Daily return of stock 1
- Avg_Rt_S1 = Average return of stock 1 over n periods
- Rt_S2 = Daily return of stock 2
- Avg_Rt_S2 = Average return of stock 2 over n periods
- n = Total number of data points

**Interpretation:**
- Positive covariance = stocks move in the same direction
- Negative covariance = stocks move in opposite directions
- Magnitude alone does not tell strength -- that requires correlation

---

### 4. Variance-Covariance Matrix

```
[Variance-Covariance Matrix] = (X^T x X) / n
```

Where:
- X = The n x k excess return matrix (daily return - average daily return)
- X^T = Transpose of X (rows and columns interchanged)
- n = Number of observations
- k = Number of stocks in the portfolio
- Result is a k x k matrix

**Key Properties:**
- Diagonal elements = variance of each individual stock
- Off-diagonal elements = covariance between pairs of stocks
- The matrix is symmetric: Cov(A,B) = Cov(B,A)

---

### 5. Correlation

```
Correlation(x, y) = Cov(x, y) / (sigma_x x sigma_y)
```

Where:
- Cov(x, y) = Covariance between stocks x and y
- sigma_x = Standard deviation of stock x
- sigma_y = Standard deviation of stock y

**Properties of the Correlation Matrix:**
- Diagonal values always equal 1.0 (stock correlated with itself)
- Values range from -1 to +1
- Matrix is symmetric: Corr(A,B) = Corr(B,A)
- Near 0 = weak/no linear relationship
- Near +1 = strong positive relationship
- Near -1 = strong negative (inverse) relationship

---

### 6. Portfolio Expected Return

```
E(Rp) = W1*R1 + W2*R2 + W3*R3 + ... + Wn*Rn
```

Where:
- E(Rp) = Expected return of the portfolio
- Wi = Weight (proportion) of capital invested in stock i
- Ri = Expected return of stock i
- Sum of all weights = 100%

**Annualization:**
```
Annual Expected Return of Stock i = Daily Average Return x 252
```

---

### 7. Portfolio Variance (Matrix Method)

```
Portfolio Variance = SQRT[ Transpose(Wt.SD) x Correlation_Matrix x Wt.SD ]
```

Step-by-step:
1. Calculate Weighted SD for each stock: Weight_i x SD_i
2. Compute M1 = MMULT(TRANSPOSE(Weighted_SD_array), Correlation_Matrix)
3. Compute M2 = MMULT(M1, Weighted_SD_array) -- yields a single number
4. Portfolio SD = SQRT(M2)

**Alternative (Equity Curve) Method:**
1. Calculate daily returns of the entire normalized portfolio
2. Apply STDEV() function to these daily returns
3. Result = Portfolio standard deviation (variance)

Both methods yield the same result.

---

### 8. Annualized Variance

```
Annual Variance (SD) = Daily SD x SQRT(252)
```

Where 252 = number of trading days in a year.

---

### 9. Expected Return Range (Confidence Intervals)

Using normal distribution properties:

**68% Confidence (1 SD):**
```
Upper Bound = Expected Return + 1 x Annual SD
Lower Bound = Expected Return - 1 x Annual SD
```

**95% Confidence (2 SD):**
```
Upper Bound = Expected Return + 2 x Annual SD
Lower Bound = Expected Return - 2 x Annual SD
```

**99.7% Confidence (3 SD):**
```
Upper Bound = Expected Return + 3 x Annual SD
Lower Bound = Expected Return - 3 x Annual SD
```

---

### 10. Value at Risk (VaR)

**Calculation Steps:**
1. Calculate daily portfolio returns
2. Build frequency distribution to verify normal distribution
3. Sort returns from highest to lowest
4. Identify the 95th percentile cutoff (e.g., for 126 observations, take 120th value)
5. The value at that cutoff = Portfolio VaR

**Bin Width for Frequency Distribution:**
```
Bin Width = (Max Return - Min Return) / 25
```

**CVaR (Conditional VaR / Expected Shortfall):**
```
CVaR = Average of the worst 5% of observations
```

**Interpretation:**
- VaR at 95% confidence: "The worst-case daily loss is X% with 95% confidence"
- CVaR: "If a black swan event occurs, the expected loss is Y%"

---

### 11. Kelly's Criterion

```
Kelly % = W - [(1 - W) / R]
```

Where:
- W = Winning probability = (Number of winning trades) / (Total trades)
- R = Win/Loss ratio = (Average gain of winners) / (Average loss of losers)
- Kelly % = Optimal fraction of capital to risk

**Modified (Safe) Kelly's Application:**
```
Actual Exposure = Kelly% x Maximum_Cap%
```

Example: If Kelly% = 30% and max cap = 5%, then expose 30% x 5% = 1.5% of capital.

---

### 12. Position Sizing -- Percentage Risk Method

```
Number of lots = Maximum_Loss_Allowed / Stop_Loss_Per_Lot
```

Where:
```
Maximum_Loss_Allowed = Risk% x Total_Capital
Stop_Loss_Per_Lot = (Entry - Stop_Loss) x Lot_Size
```

---

### 13. Equity Capital Estimation Models

**Core Equity Model:**
```
Available_Equity(n+1) = Available_Equity(n) - Capital_Deployed(n)
```

**Total Equity Model:**
```
Total_Equity = Free_Cash + SUM(Margins_Blocked) + SUM(Position_P&L)
```

**Reduced Total Equity Model:**
```
Available_Equity(n+1) = [Available_Equity(n) - Margin_Deployed] + Locked_In_Profits
```

**Position Sizing (all models):**
```
Trade_Exposure = Position_Size_Percentage x Available_Equity
```

---

### 14. Recovery Trauma Table

| Loss % | Remaining Capital | Required % Return to Recover |
|--------|-------------------|------------------------------|
| 5%     | 95,000            | 5.3%                         |
| 10%    | 90,000            | 11.1%                        |
| 20%    | 80,000            | 25.0%                        |
| 30%    | 70,000            | 42.9%                        |
| 40%    | 60,000            | 66.7%                        |
| 50%    | 50,000            | 100.0%                       |
| 60%    | 40,000            | 150.0%                       |

(Based on starting capital of Rs.100,000)

---

# PART II: CHAPTER-BY-CHAPTER COMPREHENSIVE CONTENT

---

## Chapter 1: Orientation Note

### 1.1 -- A Unique Opportunity

This module addresses two deeply interconnected topics: **risk management** and **trading psychology**. While risk management appears straightforward on the surface, it extends far beyond typical concepts like position sizing, stop losses, and leverage. Trading psychology reflects your market actions and helps you understand the reasons behind profits and losses.

There is a notable gap in available resources on these topics -- most content is fragmented and lacks continuity. This module aims to create dependable, India-focused content.

### 1.2 -- What to Expect?

The module covers risk management from three perspectives:

**Risk Management Angles:**
- Single trading position risk management
- Multiple trading positions risk management
- Portfolio-level risk management

**Risk Management Topics:**
- Risk and its various forms
- Position sizing
- Single position risk
- Multiple position risk and hedging
- Hedging with options
- Portfolio attributes and risk estimation
- Value at Risk (VaR)
- Asset allocation impacts on risk and returns
- Portfolio equity curve insights

**Trading Psychology Topics:**
- Anchoring bias
- Recency bias
- Confirmation bias
- Bandwagon effect
- Loss aversion
- Illusion of control
- Hindsight bias

---

## Chapter 2: Risk (Part 1) -- Systematic & Unsystematic Risk

### 2.1 -- Warming Up to Risk

**Core Principle:** "For every rupee of profit made by a trader, there must be a trader losing that rupee." The difference between consistently profitable and consistently losing traders lies in their understanding of risk and money management techniques.

**Mark Douglas's Principle:** Successful trading is 80% money management and 20% strategy.

**Definition of Risk:** The probability of losing money when transacting in markets.

### Two Categories of Risk

#### Unsystematic Risk (Company-Specific Risk)

Risk specific to individual companies. Causes include:
- Deteriorating business prospects
- Declining business margins
- Management misconduct
- Competition eating into margins
- Company accounting scandals

**Key Characteristic:** Affects only that specific company, not its competitors.

**Real-World Example -- Satyam Computers Scam (January 7, 2009):**
Chairman Ramalinga Raju confessed to cooking books, inflating numbers, and misleading investors. The stock price collapsed while competitors' stocks remained unaffected. The index (Sensex/Nifty) declined less than Satyam stock itself.

**Mitigation Strategy: Diversification**
- Spread investments across multiple companies
- Instead of investing entire capital in one stock, divide among 2-3+ different companies
- Example: Rs.1,00,000 investment -- put Rs.50,000 in HCL + Rs.50,000 in Karnataka Bank
- If one stock drops, loss is limited to that portion

**Optimal Portfolio Size:** Research indicates 20-21 stocks provides necessary diversification effect. Beyond 21 stocks, additional diversification benefits diminish.

#### Systematic Risk (Market Risk)

Risk common to all stocks in the market. Arises from macroeconomic and systemic factors. Cannot be diversified away.

**Causes:**
- De-growth in GDP
- Interest rate tightening
- Inflation
- Fiscal deficit
- Geopolitical risk

**Mitigation Strategy: Hedging**
- Hedging = using financial techniques (like carrying an umbrella in rain) to minimize systematic risk
- No hedge is perfect; some risk always remains in markets

**Critical Distinction:**
- Diversification minimizes unsystematic risk
- Hedging minimizes systematic risk
- These are NOT the same thing

### 2.2 -- Expected Return

**Definition:** The probabilistic expectation of return on an investment (not a guaranteed return).

**Portfolio Expected Return Formula:**

```
E(Rp) = W1*R1 + W2*R2 + W3*R3 + ... + Wn*Rn
```

**Calculation Example:**
- Rs.25,000 in Infosys (50% of capital) with 20% expected return
- Rs.25,000 in Reliance Industries (50% of capital) with 15% expected return

```
E(Rp) = 50% x 20% + 50% x 15% = 10% + 7.5% = 17.5%
```

### Key Takeaways

1. When buying a stock, you are exposed to both unsystematic and systematic risk
2. Unsystematic risk is company-specific and does not affect competitors
3. Unsystematic risk can be mitigated through diversification
4. Systematic risk is market-wide and affects all stocks indiscriminately
5. Systematic risk requires hedging (not diversification)
6. No hedge is perfect; some market risk always remains
7. Expected return is a probabilistic expectation, not guaranteed
8. Portfolio expected return = weighted sum of individual asset returns

---

## Chapter 3: Risk (Part 2) -- Variance & Covariance

### 3.1 -- Variance

**Definition:** Variance measures how much a stock's return varies with respect to its average daily returns. It helps estimate risk at the portfolio level.

**Formula:**

```
sigma^2 = SUM[(X - mu)^2] / N
```

**Worked Example (5 days of returns):**

| Day | Daily Return | Dispersion from Average | Dispersion Squared |
|-----|-------------|------------------------|-------------------|
| 1   | +0.75%      | +0.45%                 | 0.002025%         |
| 2   | +1.25%      | +0.95%                 | 0.009025%         |
| 3   | -0.55%      | -0.85%                 | 0.007225%         |
| 4   | -0.75%      | -1.05%                 | 0.011025%         |
| 5   | +0.80%      | +0.50%                 | 0.002500%         |

- Average return = +0.3%
- Sum of squared dispersions = 0.0318000%
- **Variance = 0.0318000% / 5 = 0.0063600%**
- **Standard Deviation = SQRT(0.0063600%) = approximately 0.8%** (5-day volatility)

### 3.2 -- Covariance

**Definition:** Covariance indicates how two (or more) variables move together. It reveals whether stocks move in the same direction (positive covariance) or opposite directions (negative covariance).

**Key Distinction:** Covariance shows directional movement; correlation measures the strength/degree of that movement.

**Formula:**

```
Cov(x,y) = SUM[(Rt_S1 - Avg_Rt_S1) x (Rt_S2 - Avg_Rt_S2)] / (n - 1)
```

**Excel Implementation (7-Step Process):**

1. Download daily stock prices (e.g., Cipla and Idea Cellular, 6 months data)
2. Calculate daily returns: (Today's Price / Yesterday's Price) - 1
3. Calculate average daily returns for both stocks
4. Subtract each daily return from its respective average
5. Multiply the two deviations from Step 4
6. Sum all products; count total data points
7. Divide sum by (count - 1)

**Worked Example Result (Cipla and Idea Cellular, 127 observations):**

```
Covariance = 0.006642 / 126 = 0.00005230
```

Positive covariance indicates stocks move in similar directions.

### 3.3 -- Correlation (Introduced)

**Formula:**

```
Correlation = Cov(x,y) / (sigma_x x sigma_y)
```

**Cipla-Idea Example:** Correlation = 0.106 (weak correlation despite positive covariance)

### Portfolio Diversification Concept

Portfolio managers strive to select stocks which share a negative covariance. This way, if one stock declines, others may hold value, reducing overall portfolio risk.

**Multi-Stock Complexity:**
With 4 stocks (ABB, Cipla, Idea, Wipro), you need 6 covariance calculations. With 15-20 stocks, complexity escalates significantly. Solution: the Variance-Covariance Matrix.

### Key Takeaways

1. Variance measures return dispersion around expected average returns
2. Higher variance = higher risk; lower variance = lower risk
3. Standard deviation = square root of variance
4. Covariance measures how two stock returns vary together
5. Positive covariance = returns move in same direction; negative = opposite
6. Correlation measures movement strength/magnitude
7. Multi-stock portfolios use variance-covariance matrices for calculations

---

## Chapter 4: Risk (Part 3) -- Variance-Covariance Matrix

### 4.1 -- Quick Recap

- Two types of risk: systematic and unsystematic
- Variance = deviation of a stock's return with its own average returns
- Covariance = variance of a stock's return with respect to another stock's return
- Previous chapters focused on two-stock portfolios; this chapter extends to multiple stocks using matrix algebra

### 4.2 -- Variance-Covariance Matrix

**Definition:** A single matrix that conveys both variance and covariance information. For a portfolio with k stocks, the matrix size is k x k.

**Formula:**

```
[Variance-Covariance Matrix] = (X^T x X) / n
```

Where:
- k = number of stocks in the portfolio
- n = number of observations
- X = the n x k excess return matrix
- X^T = transpose matrix of X

### Step-by-Step Implementation in Excel

**Step 1: Calculate Daily Returns**
Daily returns = (Today's Price - Yesterday's Price) / Yesterday's Price

**Step 2: Calculate Average Daily Returns**
Use Excel's AVERAGE function across all observations for each stock.

**Step 3: Set Up the Excess Return Matrix**
Excess return = Daily return minus average daily return for each stock. Matrix dimensions: n x k (e.g., 127 x 5).

**Step 4: Generate X^T x X Matrix**
- Apply Excel function: =MMULT(TRANSPOSE(X), X)
- Highlight the k x k output area before applying the formula
- Press Ctrl+Shift+Enter (array function)
- Result: k x k matrix

**Step 5: Divide by Number of Observations**
- Divide the entire X^T x X matrix by n
- Press Ctrl+Shift+Enter to confirm as array function
- Result: The final variance-covariance matrix

### Example Portfolio (5 stocks)

Stocks used: Cipla, Idea, Wonderla, PVR, Alkem (6 months of daily closing prices)

### Interpreting the Matrix

**Reading Covariance Values:**
To find covariance between Wonderla and PVR, locate the row for Wonderla and follow across to the PVR column. Example result: covariance = 0.000034.

**Diagonal Values:**
Diagonal values represent the covariance of a stock with itself, which equals the variance of that stock. This is why the matrix is called the "Variance-Covariance Matrix."

**Limitation:** The variance-covariance matrix on its own contains extremely small numbers that are hard to interpret directly. The correlation matrix makes these values meaningful.

### Key Properties

- Matrix symmetry: Cov(Stock A, Stock B) = Cov(Stock B, Stock A)
- Diagonal elements = individual stock variances
- Off-diagonal elements = covariances between stock pairs
- Small numerical values are normal

### Key Takeaways

1. X represents the excess return matrix
2. Excess return matrix = daily return minus average daily return
3. X^T represents the transpose of X
4. Variable n = number of observations (6 months ~ 127, 1 year ~ 252)
5. Excess return matrix dimensions: n x k
6. Variance-covariance matrix formula: (X^T x X) / n
7. Variance-covariance matrix dimensions: k x k
8. Diagonal elements represent individual stock variances
9. Off-diagonal elements represent covariances between stocks
10. This matrix is a critical intermediate step toward portfolio variance calculation

---

## Chapter 5: Risk (Part 4) -- Correlation Matrix & Portfolio Variance

### 5.1 -- Correlation Matrix

While variance-covariance matrices provide numerical data, correlation matrices make these values meaningful and interpretable.

**Correlation Formula:**

```
Correlation = Cov(x,y) / (sigma_x x sigma_y)
```

**Building the Correlation Matrix (3 Steps):**

**Step 1: Calculate Standard Deviations**
Use STDEV() function on daily returns for each stock.

**Step 2: Create Product of Standard Deviations Matrix**
- Formula: =MMULT(SD_array, TRANSPOSE(SD_array))
- Press Ctrl+Shift+Enter for array function
- Result: n x n matrix containing products of all SD combinations

**Step 3: Divide Covariance Matrix by SD Products**
- Element-by-element division: =Covariance_Matrix / SD_Products_Matrix
- Press Ctrl+Shift+Enter
- Result: The correlation matrix

**Correlation Matrix Properties:**
- Symmetry: Corr(A,B) = Corr(B,A)
- Diagonal values = 1.0 (stock correlated with itself)
- Example: Cipla-Alkem correlation = 0.2285 in both directions

### 5.2 -- Portfolio Variance

Portfolio variance quantifies the total risk exposure of the portfolio.

**Step 1: Assign Portfolio Weights**

| Stock    | Weight |
|----------|--------|
| Cipla    | 7%     |
| Idea     | 16%    |
| Wonderla | 25%    |
| PVR      | 30%    |
| Alkem    | 22%    |
| **Total**| **100%** |

**Step 2: Calculate Weighted Standard Deviation**
```
Weighted SD = Weight x Standard Deviation of Stock
```
Example: Cipla weighted SD = 7% x 1.49% = 0.10%

**Step 3: Portfolio Variance Formula**

```
Portfolio Variance = SQRT[ Transpose(Wt.SD) x Correlation_Matrix x Wt.SD ]
```

**Implementation:**

1. **M1** = MMULT(TRANSPOSE(Weighted_SD_array), Correlation_Matrix) -- yields a row matrix
2. **M2** = MMULT(M1, Weighted_SD_array) -- yields a single number (0.000123542 in example)
3. **Portfolio SD** = SQRT(M2) = **1.11%** daily

### Key Takeaways

1. Correlation matrix gives the correlation between any two stocks in a portfolio
2. Correlation between stock A and B is the same as B and A
3. Correlation of a stock with itself is always 1
4. Diagonals of correlation matrix = self-correlation (always 1)
5. Correlation matrix is symmetric above and below the diagonals

---

## Chapter 6: Equity Curve

### 6.1 -- Overview

This chapter discusses the equity curve and an alternate method to calculate portfolio variance. Subsequent steps include estimating expected returns and optimizing the portfolio for maximum returns and minimum variance.

### 6.2 -- Equity Curve

**Definition:** An equity curve helps visualize portfolio performance on a normalized scale of 100. It demonstrates how Rs.100 invested in this portfolio would have performed over the given period. This enables benchmarking against indices like Nifty 50 or BSE Sensex.

### Building the Equity Curve -- Step by Step

**Step 1: Normalize Portfolio to Rs.100**
Standard industry practice -- normalize to a starting investment value of Rs.100.

**Step 2: Allocate Across Stocks**

| Stock    | Weight | Amount (of Rs.100) |
|----------|--------|---------------------|
| Cipla    | 7%     | Rs.7                |
| Idea     | 16%    | Rs.16               |
| Wonderla | 25%    | Rs.25               |
| PVR      | 30%    | Rs.30               |
| Alkem    | 22%    | Rs.22               |

**Step 3: Track Daily Price Changes**
Example with Cipla:
- Sept 1: Cipla at 579.15; Rs.7 invested
- Sept 2: Cipla closed at 577.95 (down 0.21%); Rs.7 becomes Rs.6.985
- Sept 6: Cipla rose to 578.6 (up 0.11%); Rs.6.985 becomes Rs.6.993

**Critical Concept:** If on day 1, Rs.7 becomes Rs.7.5, then the following day, your starting price is Rs.7.5 and not Rs.7.

**Step 4: Calculate Daily Fluctuations Across All Stocks**
Repeat for all five stocks.

**Step 5: Sum Daily Variations**
Daily variations across all stocks are summed to determine overall portfolio daily fluctuation.

**Step 6: Create Time Series Data**
The resulting time series forms the equity curve chart.

**Example Result:**
- Starting investment: Rs.100
- Ending value (after 6 months): Rs.113.84
- Return: approximately 13.8%

### 6.3 -- Portfolio as a Whole: Alternative Variance Method

**Concept:** Instead of complex matrix multiplication and correlation matrices, view the portfolio as a single entity.

**Alternative Method:**
1. Calculate daily returns of the entire normalized portfolio
2. Apply Excel's STDEV() function to these daily returns
3. The resulting standard deviation = portfolio variance

**Key Finding:** Both methods (matrix method and equity curve method) yield the same result: approximately 1.11% daily portfolio variance.

### Key Takeaways

1. An equity curve is a standard way to visualize portfolio performance
2. Standard practice: normalize to starting investment of Rs.100
3. Assign weights and respective investment to each stock
4. Calculate daily change in investment value for each stock
5. Sum of all variations = variation of the entire portfolio
6. The graph of daily price changes yields the equity curve
7. Portfolio SD can also be calculated by treating portfolio as a single stock
8. Both matrix and equity curve methods yield the same portfolio variance

---

## Chapter 7: Expected Returns

### 7.1 -- Expected Returns

**Context:** Portfolio variance was calculated as 1.11% on a daily basis. Risk or volatility is like a coin with two faces -- price movements below entry represent risk, while those above represent returns.

**Core Formula:**
Expected portfolio return = sum of each stock's average return multiplied by its weight, scaled to annual terms by multiplying by 252 trading days.

**Annualization:**
```
Annual Expected Return (Stock i) = Daily Average Return x 252
```

Example: Cipla = 0.06% x 252 = 15.49%

**Weight Application:**
```
Stock Contribution = Weight x Annual Expected Return
```
Example: Cipla = 7% x 15.49% = 1.08%

**Portfolio-Level:** Grand sum of all weighted returns = total expected portfolio return.

**Example Results (5-stock portfolio):**
- Expected portfolio return: 55.14%
- Daily portfolio variance: 1.11%
- Annualized variance: 17.64% (= 1.11% x SQRT(252))

### 7.2 -- Estimating the Portfolio Range

Portfolio returns are normally distributed, allowing prediction of future returns within confidence intervals.

**Standard Deviation Multiples:**
- 1 SD = 17.64%
- 2 SD = 35.28% (17.64% x 2)
- 3 SD = 52.92% (17.64% x 3)

**68% Confidence Range (1 SD):**
```
Upper = 55.15% + 17.64% = 72.79%
Lower = 55.15% - 17.64% = 37.51%
```

**95% Confidence Range (2 SD):**
```
Upper = 55.15% + 35.28% = 90.43%
Lower = 55.15% - 35.28% = 19.87%
```

**99% Confidence Range (3 SD):**
```
Upper = 55.15% + 52.92% = 108.07%
Lower = 55.15% - 52.92% = 2.23%
```

**Key Observation:** Higher confidence levels produce wider ranges.

### Key Takeaways

1. Portfolio returns depend on individual stock weights
2. Individual stock effect = stock's average return x its weight
3. Overall expected return = sum of weighted individual returns
4. Daily variance converts to annual variance via SQRT(252) multiplication
5. Portfolio variance equals the first standard deviation value
6. Second and third SD values multiply the 1st SD by 2 and 3 respectively
7. Expected returns can be expressed as ranges
8. Range calculation = expected return +/- variance (SD)
9. Each SD carries specific confidence levels; higher SDs indicate greater certainty

---

## Chapter 8: Portfolio Optimization (Part 1)

### 8.1 -- A Tale of 2 Stocks

As investment weights vary, returns and risk characteristics change.

**Formula:**
```
Portfolio Return = (Weight_1 x Return_1) + (Weight_2 x Return_2)
```

**Examples with Infosys (22% return) and Biocon (15% return):**
- Equal weights (50/50): 50% x 22% + 50% x 15% = **18.5%**
- 30/70 split: 30% x 22% + 70% x 15% = **17.1%**
- 70/30 split: 70% x 22% + 30% x 15% = **19.9%**

### 8.2 -- Important Jargons

**Minimum Variance Portfolio:**
A portfolio combination where risk (variance) reaches its lowest possible level for a given set of stocks. Represents the least amount of risk you can take.

**Maximum Return Portfolio:**
Weights optimized to achieve highest possible returns, typically accompanied by higher risk.

**Fixed Variance, Multiple Portfolios Concept:**
For a given level of risk or variance, you can create at least two unique portfolios. Example: at 15% risk level, one portfolio might yield 30% return (maximum) while another yields 12% (minimum).

### 8.3 -- Portfolio Optimization Steps Using Excel Solver

**Starting Portfolio:**
- Annual variance: 17.64%
- Expected return: 55.14%
- Weights randomly assigned initially

**Solver Access:** Data ribbon in Excel. If unavailable, add through File > Options > Add-ins > Enable "Solver Add-Ins."

**Step 1: Data Organization**
Cells must be linked, data neatly organized. No hard coding of data.

**Step 2: Using Solver**
Three components:
- **Objective:** The metric to optimize (e.g., variance)
- **Direction:** Minimize, maximize, or set to specific value
- **Variables:** Cells that change (stock weights)

**Essential Constraint:** Sum of all weights = 100% (ensures full capital deployment)

### Results: Minimum Variance Portfolio

**Before Optimization:**
- Weights: Cipla 7%, Idea 16%, Wonderla 25%, PVR 30%, Alkem 22%
- Annual variance: 17.64%
- Expected return: 55.14%

**After Optimization:**
- Cipla: 29.58%, Idea: 5.22%, Wonderla: 30.22%, PVR: 16.47%, Alkem: 18.51%
- **Annual variance reduced to: 15.57%**
- Expected return: 36.25%

**Critical Finding:** No matter what you do, the variance cannot be lowered below 15.57% for this set of stocks.

**Risk-Return Tradeoff:** Optimizing for minimum variance reduced risk but decreased expected returns by nearly 19 percentage points (55.14% to 36.25%).

### Key Takeaways

1. Portfolio returns depend directly on assigned stock weights
2. Minimum variance portfolio = lowest achievable risk for given stocks
3. Maximum return portfolio maximizes expected returns
4. Fixed variance scenarios allow multiple portfolio combinations
5. Excel Solver optimizes by adjusting weights to minimize/maximize objectives
6. Proper data organization and cell linking is essential
7. Constraints enable realistic optimization scenarios

---

## Chapter 9: Portfolio Optimization (Part 2) -- Efficient Frontier

### 9.1 -- Working with the Weights

A portfolio can produce multiple return series for a fixed portfolio variance.

**Pre-optimized vs. Optimized Portfolio Comparison:**

| Stock    | Pre-optimized | Min Variance Optimized |
|----------|---------------|------------------------|
| Cipla    | 7%            | 29.58%                 |
| Idea     | 16%           | 5.22%                  |
| Wonderla | 25%           | 30.22%                 |
| PVR      | 30%           | 16.47%                 |
| Alkem    | 22%           | 18.51%                 |

| Metric                   | Pre-optimized | Optimized |
|--------------------------|---------------|-----------|
| Expected Portfolio Return | 55.14%        | 36.35%    |
| Portfolio Variance        | 17.64%        | 15.57%    |

### 9.2 -- More Optimization

**Methodology:**
1. Fix portfolio risk at specific levels (17%, 18%, 19%, 21%)
2. Optimize for maximum returns at each risk level
3. Optimize for minimum returns at same risk level

**Results at 17% Risk Level:**
- Maximum possible returns: 55.87%
- Minimum possible returns: 18.35%

For the same given risk, two unique portfolios exist with different return characteristics -- all by changing investment weights.

### 9.3 -- Efficient Frontier

**Portfolios Generated:**
- P1: Minimum variance portfolio (Risk: 15.57%, Return: 36.25%)
- P2: Maximum return @ 17% risk (Risk: 17%, Return: 55.87%)
- P3: Minimum return @ 17% risk (Risk: 17%, Return: 18.35%)
- Additional portfolios at risk levels: 18%, 19%, 21%

**Efficient Frontier Definition:**
The curve formed by plotting these optimized portfolios on a risk-return scatter plot is called the "efficient frontier."

**Five Critical Interpretations:**

1. **Axes:** X-axis = risk; Y-axis = returns
2. **Minimum Variance Portfolio:** Leftmost point representing lowest achievable risk (15.57%) with 36.25% return
3. **Fixed Risk Analysis:** At 17% risk, two possible portfolios exist (best: 55.87%, worst: 18.35%) with multiple portfolios between
4. **Portfolio Efficiency:** Multiple portfolios exist between minimum and maximum return at any given risk level
5. **Investor Strategy:** All optimal portfolios lie on the upper boundary line above the minimum variance portfolio

**Critical Recommendations:**
- As an investor, aim to maximize return when you have clarity on acceptable risk
- Always aim to create a portfolio on the efficient frontier
- Creating this portfolio is merely a function of rearranging weights

### Key Takeaways

1. Each portfolio with distinct stock weights is a unique combination
2. Fixed risk levels permit optimization for both minimum and maximum returns
3. Between min/max return portfolios at given risk, multiple intermediate portfolios exist
4. Risk-return scatter plots generate the efficient frontier
5. Optimal portfolios occupy the efficient frontier; all others are inefficient

---

## Chapter 10: Value at Risk (VaR)

### 10.1 -- Black Monday

Historical context about the 1987 market crash:
- 1970s US economy faced energy crisis, depression, high inflation, unemployment
- Markets rallied from early 1980s to mid-1987
- Dow Jones reached all-time high of 2,722 in August 1987 (44% return over 1986)
- October 1987 turmoil:
  - Oct 14: Dow dropped nearly 4%
  - Oct 15: Dow dropped another 2.5% (12% down from peak); Iran attacked American tanker
  - Oct 16: London storm caused blackouts; Dow crashed nearly 5%
  - **Oct 19 (Black Monday): Dow fell 508 points or 22.61% in a single day**

This was one of the very first "Black Swan" events to hit the world hard.

### 10.2 -- The Rise of Quants

After 1987, financial firms recognized the need for sophisticated risk management:
- A new breed called "Quants" developed mathematical models to monitor positions
- Risk management became a formal middle-office function
- JP Morgan CEO Dennis Weatherstone commissioned the "4:15 PM" report -- a one-page daily firm-wide risk assessment
- JP Morgan later spun off this team creating "The Risk Metrics Group" (later acquired by MSCI)
- The report contained **Value at Risk (VaR)** -- a metric for worst-case loss assessment

### 10.3 -- Normal Distribution & VaR

At the core of VaR lies normal distribution.

**Portfolio VaR answers two key questions:**
1. If a black swan event occurs tomorrow, what is the worst-case portfolio loss?
2. What probability is associated with this worst-case loss?

**Steps for Calculating Portfolio VaR:**
1. Identify the distribution of portfolio returns
2. Map the distribution to check if returns are normally distributed
3. Arrange portfolio returns from ascending to descending order
4. Observe the last 95% of observations
5. The least value within the last 95% = portfolio VaR
6. Average of the last 5% = cumulative VaR (CVaR / Expected Shortfall)

### 10.4 -- Distribution of Portfolio Returns

**Building a Frequency Distribution:**

**Step 1:** Calculate max and min returns using =Max() and =Min()

**Step 2:** Count data points using =count() (example: 126 observations from 6 months)

**Step 3:** Calculate bin width:
```
Bin Width = (Max Return - Min Return) / 25
```
Example: (3.26% - (-2.82%)) / 25 = 0.2431%

**Step 4:** Build the bin array starting from lowest return, incrementing by bin width

**Step 5:** Calculate frequency using =frequency() function

**Step 6:** Plot the distribution -- visual check for bell curve pattern confirming normal distribution

### 10.5 -- Value at Risk Calculation

**Methodology:**
1. Sort portfolio returns from highest to lowest
2. Identify 95% confidence cutoff: For 126 observations, 95% = 120 observations
3. Portfolio VaR = least value within the 120 observations

**Example Results:**
- **Portfolio VaR: -1.48%** (worst-case daily loss at 95% confidence)
- **CVaR (Expected Shortfall): -2.39%** (average of the worst 5% of observations)

**Interpretation:**
- VaR of -1.48% means: "The worst case daily loss for the given portfolio is -1.48% with 95% confidence"
- CVaR of -2.39% represents the expected loss in case of an extreme event (5% probability)
- Loss can exceed -2.39% but the probability is very low

**Normal Distribution Properties Used:**
- 68% of data lies within 1 SD
- 95% of data lies within 2 SDs
- 99.7% of data lies within 3 SDs

### Key Takeaways

1. Events with very low probability are called "Black Swan" events
2. Black swan events cause portfolios to experience higher loss levels
3. VaR estimates worst-case loss if a black swan event occurs
4. Portfolio VaR is estimated by studying the distribution of portfolio returns
5. Average of the last 5% of observations gives the CVaR of the portfolio
6. Minimum recommended data: 1 year (252 trading days) for statistical reliability

---

## Chapter 11: Position Sizing (Part 1)

### 11.1 -- Poker Face

The chapter opens with a poker analogy illustrating the importance of position sizing:

**Failed Approach (No Position Sizing):**
- Lost Rs.200 in round 1, Rs.200 in round 2, then bet Rs.600 in round 3
- Lost entire Rs.1,000 in 10 minutes
- Lost Rs.3,000 total in 25 minutes across three buy-ins

**Successful Approach (With Position Sizing):**
- Assessed odds fairly with each hand
- Followed systematic approach backed by position sizing
- Won several hands, peaked at Rs.4,000, lasted entire game

**Core Lesson:** Position sizing made all the difference. It always does.

Reference: Van Tharp's books on position sizing.

### 11.2 -- Gambler's Fallacy

**Definition:** If you are betting on an outcome and make a long streak of losses, your mind tells you the losing streak is over and the next bet will be a winner.

**The Mathematical Reality:** When dealing with random draws, the odds of making a loss on the 7th trade is as high (or low) as it was on the first bet. Just because you have made a series of losses, the odds of making money on the next trade does not improve.

**Reverse Scenario (Winning Streak):**
After 6-10 consecutive wins, traders typically reduce bet size, influenced by the outcome of previous trades. In reality, the new trade has the same odds as previous bets.

**Why Some Profitable Traders Make Minimal Money:** Gambler's fallacy causes them to reduce position sizing during winning periods.

**Solution:** The antidote for Gambler's Fallacy is position sizing -- systematic, consistent bet sizing regardless of recent outcomes.

### 11.3 -- Recovery Trauma

**Core Concept:** Capital is the raw material. If you do not have enough money to trade with, you cannot make a profit. You need to protect both profits and capital.

**The Recovery Challenge:** If you risk too much capital on any one trade, you may burn your capital to a point where the climb back becomes a Herculean task.

**Recovery Trauma Table (Starting capital: Rs.100,000):**

| Loss % | Loss Amount | Remaining Capital | Required % Return to Recover |
|--------|-------------|-------------------|------------------------------|
| 5%     | Rs.5,000    | Rs.95,000         | 5.3%                         |
| 10%    | Rs.10,000   | Rs.90,000         | 11.1%                        |
| 20%    | Rs.20,000   | Rs.80,000         | 25.0%                        |
| 30%    | Rs.30,000   | Rs.70,000         | 42.9%                        |
| 40%    | Rs.40,000   | Rs.60,000         | 66.7%                        |
| 50%    | Rs.50,000   | Rs.50,000         | 100.0%                       |
| 60%    | Rs.60,000   | Rs.40,000         | 150.0%                       |

As the loss deepens, recovery becomes exponentially harder. At 60% loss, you need a 150% bounce back.

**Impact on Small Accounts:** Traders with small accounts (e.g., Rs.50,000) tend to take bigger risks hoping for bigger gains. If the trade goes against them, they fall prey to recovery trauma. This is exactly why you should never risk too much on any one trade.

**Larry Hite's Rule:** "Risk no more than 1% of your capital on a single trade."

**Key Insight:** Stay in the game for the long term. To stay longer, you need enough capital. To have enough capital, you need to risk the right amount on each trade. This boils down to consistency through proper position sizing.

### Key Takeaways

1. Position sizing forms the cornerstone of a trading system
2. Gambler's fallacy makes traders believe a long streak of certain outcomes can break
3. With infinite draws, odds of profit/loss on trade N are similar to trade 1
4. Recovery of capital is much more difficult than one can imagine
5. Traders with small accounts tend to take larger bets, which they need to avoid

---

## Chapter 12: Position Sizing (Part 2) -- Equity Capital Models

### 12.1 -- Defining Equity Capital

Position sizing determines how much capital to expose for a particular trade. The standard 5% rule restricts risk to maximum 5% per trade.

**Core Problem:** When you deploy Rs.50,000 from a Rs.500,000 account, what equity capital remains for the next trade? Is it Rs.450,000, Rs.500,000, or Rs.450,000 plus/minus the P&L from the active position?

### 12.2 -- Three Equity Estimation Models (Based on Van Tharp)

#### Model 1: Core Equity Model

**Definition:** Deduct the capital allocated to a trade from the existing capital.

**Formula:**
```
Available_Equity(n+1) = Available_Equity(n) - Capital_Deployed(n)
```

**Example:**
- Starting equity: Rs.50,000
- Position sizing rule: 10% of available equity
- Trade 1 exposure: Rs.5,000; Remaining: Rs.45,000
- Trade 2 exposure: Rs.4,500; Remaining: Rs.40,500
- Trade 3 exposure: Rs.4,050; Remaining: Rs.36,450

**Characteristics:** Conservative approach; capital allocation decreases with each additional trade.

#### Model 2: Total Equity Model

**Definition:** Aggregates all positions in the market along with P&L and cash balance.

**Formula:**
```
Total_Equity = Free_Cash + SUM(Margins_Blocked) + SUM(Position_P&L)
```

**Example:**
```
Free cash: Rs.50,000
Trade 1 margin: Rs.75,000  | P&L: +Rs.2,000
Trade 2 margin: Rs.115,000 | P&L: +Rs.7,000
Trade 3 margin: Rs.55,000  | P&L: -Rs.4,000

Total Equity = 50,000 + 75,000 + 115,000 + 55,000 + 2,000 + 7,000 - 4,000
             = Rs.300,000
```

10% position sizing on this total: Rs.30,000 exposure for next trade.

**Assessment:** Concern with counting unrealized profits -- "somewhat like counting the chicken before they hatch."

#### Model 3: Reduced Total Equity Model (Recommended)

**Definition:** Combines best of both models. Reduces capital allocation per trade while including only locked-in (partially realized) profits.

**Formula:**
```
Available_Equity(n+1) = [Available_Equity(n) - Margin_Deployed] + Locked_In_Profits
```

**Detailed Example:**
- Total capital: Rs.500,000
- Position sizing rule: 20% per trade maximum (Rs.100,000)
- Trade 1 (ACC Futures): Entry 1800, margin blocked Rs.90,000
- Available for Trade 2: 20% x (500,000 - 90,000) = 20% x 410,000 = Rs.82,000

**After price moves to 1850 (50-point increase):**
- Paper profit: 400 contracts x 50 = Rs.20,000
- Lock in 50% of move (25 points) = Rs.10,000 (trailing stop at 1825)
- New available equity: 410,000 + 10,000 = Rs.420,000
- New exposure for Trade 2: 20% x 420,000 = Rs.84,000

**Advantage:** Forces you to practice basic stop-loss principles.

### Key Takeaways

1. Estimating equity capital is crucial for position sizing
2. Core equity model deducts capital allocated per trade
3. Total equity model adds free cash, blocked margins, and position P&L
4. Reduced total equity model combines approaches using only locked-in profits

---

## Chapter 13: Position Sizing (Part 3) -- Three Methods for Risk Control

### 13.1 -- Choose Your Path

Three core position sizing techniques that are asset-independent and time-frame independent:
1. Unit per fixed amount
2. Percentage margin
3. Percentage of volatility

With 3 equity models x 3 position sizing techniques = 9 different ways to size the same trade. Recommended: stick to one equity model and 1-2 position sizing techniques.

### 13.2 -- Unit Per Fixed Amount

**Definition:** State how many shares or lots to trade for a given amount of capital.

**Example:**
- Trading account: Rs.200,000
- Rule: 1 lot per Rs.100,000
- With Rs.2L capital, trade 1-2 lots maximum

**Advantages:**
- Simple to implement
- Does not complicate decision-making

**Disadvantages:**
- Ignores implicit riskiness of assets (treats Nifty at 14% volatility the same as Tata Motors at 40% volatility)
- Limits scalability
- Does not reject or adjust for risky trades

### 13.3 -- Percentage Margin

**Concept:** Position size based on margin requirements, establishing a maximum percentage of capital as margin exposure per trade.

**Example:**
- Capital: Rs.500,000
- Maximum margin exposure: 20% of capital = Rs.100,000 per trade
- Nifty Futures (margin ~60K): Can trade
- ICICI (margin ~105K): Cannot trade (exceeds 20%)
- ACC (margin ~90K): Depends on equity model used

**With Reduced Total Equity Model:**
- Starting: Rs.500,000
- After Nifty trade (margin: Rs.60,000): New capital = Rs.440,000
- New 20% allocation: Rs.88,000
- ACC margin: Rs.90,000 -- falls short by Rs.2,000

**Limitation:** Does not account for volatility differences across positions.

### 13.4 -- Percentage Volatility

**Concept:** Define maximum volatility exposure as a percentage of equity capital using Average True Range (ATR).

**Formula:**
```
Maximum Shares = Volatility Allowance / ATR
Volatility Allowance = Volatility% x Total Equity
```

**Detailed Example (Piramal Enterprises Limited):**
- 14-day ATR: Rs.76 per share
- Total equity capital: Rs.500,000
- Maximum volatility exposure: 2% of capital
- Volatility allowance: 2% x 500,000 = Rs.10,000
- Maximum shares: 10,000 / 76 = 131 shares
- Current price: Rs.2,700; Total exposure: 131 x 2,700 = Rs.353,700

**Capital remaining (reduced total equity model):**
- Available: 500,000 - 353,700 = Rs.146,300
- New volatility exposure @ 2%: Rs.2,929

**Portfolio Risk Assessment:** If portfolio volatility exposure is 15% on Rs.500,000 capital, that means Rs.75,000 potential daily loss across all positions. Ask yourself: does this feel acceptable?

### Key Takeaways

1. Equity estimation significantly impacts position sizing decisions
2. Unit fixed model: simplest but ignores risk
3. Percentage margin method: caps margin exposure; best with reduced total equity model
4. Percentage volatility: uses ATR; equally weights volatility exposure across positions
5. These techniques are foundational for disciplined risk management

---

## Chapter 14: Kelly's Criterion

### 14.1 -- Percentage Risk Method

**Concept:** Position size based on your stop loss -- how much you are willing to lose if wrong.

**Tata Motors Trade Example:**
- Entry: 393.65
- Target: 400 (reward: 6.35 points)
- Stop loss: 390 (risk: 3.65 points)
- Reward-to-Risk ratio: 1.7
- Lot size: 1,500
- Margin required: Rs.73,500

**Without Risk Management (Rs.500,000 capital):**
- Maximum lots: 500,000 / 73,500 = 6.8 lots
- Potential loss per lot: 3.65 x 1,500 = Rs.5,475
- Total loss on 6 lots: Rs.32,850 (6.57% of capital)

**Professional Standard:** Risk no more than 1-3% per trade.

**Percentage Risk Implementation:**
- Maximum risk: 1.5% of Rs.500,000 = Rs.7,500
- Stop loss per lot: Rs.5,475
- Number of lots: 7,500 / 5,475 = 1.36 lots -- buy 1 lot

**Subsequent Trade Capital:**
- Remaining: 500,000 - 73,500 = Rs.426,500
- New max loss: 1.5% x 426,500 = Rs.6,397.50

### 14.2 -- Kelly's Criterion

**Historical Background:** Proposed by John Kelly in the 1950s at AT&T's Bell Laboratories. Originally for telecommunications, adopted by professional gamblers, then by traders and investors.

**Definition:** Kelly's Criterion estimates the optimal bet size (fraction of trading capital) considering available information and edge on the bet.

**Formula:**

```
Kelly % = W - [(1 - W) / R]
```

Where:
- W = Winning probability = Total winning trades / Total trades
- R = Win/Loss ratio = Average gain of winners / Average loss of losers

**Worked Example (10 Trades):**

| Trade | Date      | Result | P&L (INR) |
|-------|-----------|--------|-----------|
| 01    | 3rd Sept  | Win    | +5,325    |
| 02    | 4th Sept  | Win    | +2,312    |
| 03    | 5th Sept  | Win    | +4,891    |
| 04    | 6th Sept  | Loss   | -6,897    |
| 05    | 11th Sept | Win    | +1,763    |
| 06    | 12th Sept | Loss   | -3,231    |
| 07    | 13th Sept | Loss   | -989      |
| 08    | 14th Sept | Loss   | -1,980    |
| 09    | 15th Sept | Win    | +8,675    |
| 10    | 18th Sept | Win    | +4,231    |

**Calculations:**
- W = 6/10 = 0.6 (60%)
- Average gain: (5,325 + 2,312 + 4,891 + 1,763 + 8,675 + 4,231) / 6 = Rs.4,532
- Average loss: (6,897 + 3,231 + 989 + 1,980) / 4 = Rs.3,274
- R = 4,532 / 3,274 = 1.384

```
Kelly % = 0.6 - [(1 - 0.6) / 1.384]
        = 0.6 - [0.4 / 1.384]
        = 0.6 - 0.289
        = 0.31 or 31%
```

### Caution: Full Kelly is Dangerous

A system with great accuracy might suggest 70% capital exposure. But there is still a 30% chance to lose 70% of your capital. Not smart.

### Modified Kelly's Criterion (Recommended)

Combine Kelly's with percentage risk:

1. Set maximum exposure cap: 5% of capital (or suitable %)
2. Apply Kelly's as multiplier: expose (Kelly% x max cap) of capital
3. Example: Kelly% = 30%, max cap = 5% --> expose 30% x 5% = **1.5% of capital**

Capital exposure scales from 0.1% to maximum 5% based on conviction strength.

### Key Takeaways

1. Percentage Risk is easy and intuitive -- define max risk %, divide by stop loss to get position size
2. Kelly's Criterion suggests optimal capital exposure for a given trade
3. Combining Kelly's with percentage risk produces optimal results
4. Never use full Kelly -- always apply as multiplier to a conservative cap

---

## Chapter 15: Trading Biases (Part 1)

### 15.1 -- Mind Games

**MRF Stock Anecdote:** A caller on a stock market show discovered 20,000 shares of MRF purchased by his grandfather in the 1990s. At approximately Rs.64,000 per share, this represented roughly 128 crores -- a 2000% return held passively.

**Key Insight:** The grandfather made a fortune by simply forgetting he owned the shares. Had he actively monitored prices, he likely would have sold at 100%, 200%, or 500% returns rather than holding for decades. Inactivity paradoxically created wealth.

**Central Thesis:** When people analyze market data extensively, they add personal interpretations rooted in biases rather than pure facts. These biases represent the primary obstacle between traders and profitable performance.

### 15.2 -- Illusion of Control

**Definition:** A cognitive bias where traders believe they control market outcomes through complex analysis.

**How It Manifests:**
- Traders load charts with multiple indicators (Bollinger Bands, Fibonacci, pivot points, volume analysis, ATR, stochastic)
- Complexity creates a false sense of mastery
- Only the trader can interpret the complex signals, reinforcing superiority beliefs
- Overconfident statements like "This stock won't exceed 500"

**The Problem:** No matter how many indicators you load or numbers you crunch, there is no way to control all outcomes. Markets contain multiple possible outcomes beyond any individual's control.

**Solution:** Focus on results and statistics rather than complexity. Ask: "What are the odds the next trade is profitable?" The best analysis is done when things are kept simple. Complex does not necessarily mean "better."

### 15.3 -- Recency Bias

**Definition:** A bias causing traders to overweight recent information while ignoring historical context.

**Real-World Example -- Cafe Coffee Day:**
The company faced Income Tax Department investigations for tax evasion and income concealment. After the news broke, a green candlestick appeared on the chart, and the observer suggested holding for a better price, believing recent price recovery invalidated the corporate governance concerns.

**The Error:** A single positive price movement does not override fundamental problems like hidden income. The recent green candle created bullish psychology that overshadowed serious fundamental issues.

**Solution:** The only way to overcome recency bias is by taking cognizance of the wider picture. View situations from an overall perspective rather than microscopic (price-only) views.

### Key Takeaways

1. Markets are inherently complex, but analytical approaches need not be
2. Traders unconsciously complicate charts to feel invincible and gain illusory control
3. Illusion of control wastes time deriving pointless data
4. Additional data does not guarantee information quality
5. Recency bias blinds traders to past events with greater market impact
6. Maintaining broad perspective prevents falling prey to recency bias

---

## Chapter 16: Trading Biases (Part 2)

### 16.1 -- Anchoring Bias

**Personal Example:** During the August/September 2013 bear market, the author researched Sundaram Clayton Limited and determined it was a quality investment at 270 per share. When the price moved to 280, 290, then 310, he refused to purchase, convinced it would retrace to his anchored level. It never did. The stock appreciated significantly -- one of his greatest missed opportunities.

**Definition:** Under the influence of anchoring bias, we tend to get fixated to the first level of information we get. The first price observed becomes a price anchor, constraining all future decisions.

**Trading Impact:** Traders frequently miss placing buy or stop-loss orders because they perceive certain prices as "right." The actual difference may be just a few rupees, yet psychological attachment prevents action.

**Management Strategy:** No genuine cure exists. The solution involves awareness and adopting critical thinking approaches toward markets.

### 16.2 -- Functional Fixedness

**Definition:** A cognitive bias that limits a person to using an object only in the way it is traditionally used.

**Trading Application:**
A trader with Rs.100,000 in their account takes a Nifty overnight position (NRML) blocking Rs.65,000 in margin, leaving Rs.35,000 available. The next day, an excellent intraday TCS opportunity requires Rs.60,000 MIS margin. The trader cannot execute due to "insufficient" margin.

**The Functional Fixedness Problem:** Traders mentally categorize NRML margin as permanently "blocked," forgetting the capital is accessible through position conversion.

**Solution -- Out-of-Box Thinking:**
1. Start with Rs.35,000 available
2. Convert NRML Nifty position to MIS (frees ~Rs.39,000; MIS needs ~Rs.26,000 vs NRML Rs.65,000)
3. Total available: 35,000 + 39,000 = Rs.84,000
4. Execute MIS TCS trade (blocks Rs.60,000), keeping Rs.24,000 available
5. Square off intraday TCS at day's end
6. Convert MIS Nifty back to NRML for overnight carrying

This maintains the overnight position while exploiting intraday opportunities.

### 16.3 -- Confirmation Bias

**Definition:** When you form a trading opinion, you only look for and assimilate information that supports your view. Your brain does not allow you to pay attention to contradictory information.

**Example:** Seeing a bullish chart pattern on Tata Motors (double/triple bottom, uptrend to 430), a trader develops a buying hypothesis. When news emerges about a new EV factory, the trader interprets this as supporting their bullish view -- even though the fundamental news may not actually be a great trigger. At a subconscious level, you only seek information that supports your original contention.

**Countermeasure:** Critical reasoning is the key. Ask yourself: "So what?" Challenge every piece of supporting evidence.

### 16.4 -- Attribution Bias

**The Pattern:**
- Profitable trades: "My analysis was brilliant"
- Losing trades: "Broker system failed / orders were slow / charts didn't load"

Everything is attributable to someone else's mistake (mainly the broker) and not the subpar analysis in the first place.

**Root Cause:** Reluctance to acknowledge personal errors and analytical shortcomings.

**Solution -- Trading Journal:**
Maintain a comprehensive trading journal documenting:
- Trade entry reasoning
- Trade closing rationale
- Decision-making process

These journal entries over time give great insight into your own trading behavior.

### Key Takeaways

1. Anchoring bias causes fixation on initial price information, leading to missed opportunities
2. Anchoring bias prevents optimal decisions despite marginal price differences
3. Functional fixedness restricts imagination through rigid utility assumptions
4. "Out of the box" thinking overcomes functional fixedness
5. Confirmation bias makes traders seek supporting info while dismissing contradictions
6. Traders typically attribute losses to external factors rather than analysis quality
7. Trading journals provide attribution bias awareness and behavioral insights

---

# PART III: COMPLETE BIAS & PSYCHOLOGY REFERENCE

## All Trading Biases Covered in Module 9

### 1. Gambler's Fallacy
- **What:** Belief that a long losing streak means the next trade will win (or vice versa)
- **Reality:** Each trade has independent odds regardless of previous outcomes
- **Fix:** Systematic position sizing; ignore recent streaks

### 2. Illusion of Control
- **What:** Believing complex analysis gives you control over market outcomes
- **Reality:** No amount of indicators or analysis can control market outcomes
- **Fix:** Keep analysis simple; focus on probabilities and statistics

### 3. Recency Bias
- **What:** Overweighting recent information while ignoring historical context
- **Reality:** A single recent event does not override longer-term fundamentals
- **Fix:** Take cognizance of the wider picture; zoom out

### 4. Anchoring Bias
- **What:** Fixating on the first piece of information (usually a price level) encountered
- **Reality:** Markets move; your initial reference point may never be revisited
- **Fix:** Awareness and critical thinking; accept market prices as they are

### 5. Functional Fixedness
- **What:** Using tools/positions/strategies only in their "traditional" way
- **Reality:** Creative solutions (like position conversion) can unlock opportunities
- **Fix:** Think outside the box; challenge assumptions about how things "should" work

### 6. Confirmation Bias
- **What:** Seeking only information that supports your existing view
- **Reality:** Contradictory evidence is equally valid and often more important
- **Fix:** Critical reasoning; actively seek disconfirming evidence; ask "so what?"

### 7. Attribution Bias
- **What:** Crediting yourself for wins and blaming external factors for losses
- **Reality:** Both wins and losses stem primarily from your own decisions and analysis
- **Fix:** Maintain a detailed trading journal documenting reasoning and outcomes

### 8. Loss Aversion
- **What:** The pain of losing is psychologically more intense than the pleasure of gaining
- **Reality:** Leads to holding losers too long and cutting winners too short
- **Fix:** Pre-defined stop losses and targets; systematic exit rules

### 9. Bandwagon Effect
- **What:** Following the crowd into trades because "everyone else is doing it"
- **Reality:** Crowd behavior often marks tops and bottoms
- **Fix:** Independent analysis; contrarian thinking when appropriate

### 10. Hindsight Bias
- **What:** Believing after the fact that an outcome was predictable ("I knew it all along")
- **Reality:** Outcomes are only obvious in retrospect; this bias prevents genuine learning
- **Fix:** Keep a trading journal with pre-trade predictions; review honestly

---

# PART IV: POSITION SIZING RULES -- COMPLETE REFERENCE

## Rule 1: Larry Hite's 1% Rule
Risk no more than 1% of your capital on a single trade.

## Rule 2: The 5% Maximum Exposure Rule
Never expose more than 5% of total capital to any single trade.

## Rule 3: Percentage Risk Method
```
Max Loss Allowed = Risk% x Total Capital
Number of Lots = Max Loss Allowed / (Stop Loss Points x Lot Size)
```

## Rule 4: Kelly's Criterion (Modified)
```
Kelly% = W - [(1-W) / R]
Actual Exposure = Kelly% x Maximum Cap (e.g., 5%)
```

## Rule 5: Recovery Awareness
- At 20% loss, you need 25% to recover
- At 50% loss, you need 100% to recover
- At 60% loss, you need 150% to recover
- Never allow drawdowns beyond 20% before reassessing strategy

## Rule 6: Three Position Sizing Techniques
1. **Unit per fixed amount:** X lots per Y capital (simple but ignores risk)
2. **Percentage margin:** Cap margin exposure at X% of equity per trade
3. **Percentage volatility:** Cap volatility exposure using ATR

## Rule 7: Three Equity Estimation Models
1. **Core Equity:** Deduct deployed capital from available equity
2. **Total Equity:** Include all margins + unrealized P&L + cash
3. **Reduced Total Equity (Recommended):** Deduct deployed capital + add only locked-in profits

## Rule 8: Portfolio-Level Volatility Cap
Define maximum total portfolio volatility exposure (e.g., 15% of capital). If every position moves against you, the total loss should be within your tolerance.

---

# PART V: KEY QUANTITATIVE CONCEPTS SUMMARY

## Portfolio Risk Analysis Workflow

```
Step 1: Gather daily closing prices for all portfolio stocks
Step 2: Calculate daily returns for each stock
Step 3: Calculate average daily returns
Step 4: Build the excess return matrix (X)
Step 5: Compute variance-covariance matrix = (X^T x X) / n
Step 6: Calculate standard deviations for each stock
Step 7: Build correlation matrix = Cov(i,j) / (SD_i x SD_j)
Step 8: Assign portfolio weights
Step 9: Calculate weighted SDs
Step 10: Compute portfolio variance = SQRT(W_SD^T x Corr x W_SD)
Step 11: Annualize: Annual SD = Daily SD x SQRT(252)
Step 12: Calculate expected return = SUM(Weight_i x Annual_Return_i)
Step 13: Establish confidence intervals (1SD/2SD/3SD)
Step 14: Calculate VaR (sort returns, find 95th percentile cutoff)
Step 15: Calculate CVaR (average of worst 5%)
Step 16: Build equity curve (normalize to Rs.100)
Step 17: Optimize using Solver (min variance / max return)
Step 18: Plot efficient frontier
```

## Normal Distribution Quick Reference

| Confidence Level | Standard Deviations | Data Coverage |
|-----------------|--------------------:|---------------|
| 68%             | 1 SD                | Moderate certainty |
| 95%             | 2 SD                | High certainty |
| 99.7%           | 3 SD                | Very high certainty |

## Annualization Factors

| Metric | Daily to Annual Conversion |
|--------|---------------------------|
| Returns | Multiply by 252 |
| Volatility (SD) | Multiply by SQRT(252) = ~15.87 |
| Variance | Multiply by 252 |

---

# PART VI: PRACTICAL CHECKLISTS

## Pre-Trade Checklist
- [ ] Identify systematic vs unsystematic risk exposure
- [ ] Calculate position size using chosen method (% risk, % margin, or % volatility)
- [ ] Verify position size against Kelly's Criterion (modified)
- [ ] Ensure total portfolio exposure is within volatility cap
- [ ] Set stop loss BEFORE entering trade
- [ ] Define profit target and reward-to-risk ratio (aim for > 1.0)
- [ ] Check for cognitive biases (anchoring, confirmation, recency)

## Portfolio Construction Checklist
- [ ] Select 15-21 stocks for adequate diversification
- [ ] Calculate variance-covariance matrix
- [ ] Build correlation matrix
- [ ] Seek negative or low correlations between holdings
- [ ] Assign weights and calculate portfolio variance
- [ ] Calculate expected returns with confidence intervals
- [ ] Run portfolio optimization (min variance, max return)
- [ ] Ensure portfolio sits on efficient frontier
- [ ] Calculate VaR and CVaR
- [ ] Build and monitor equity curve

## Post-Trade Journal Template
- Date and time of entry/exit
- Instrument and direction (long/short)
- Entry reasoning (technical/fundamental)
- Position size and sizing method used
- Stop loss and target levels
- Actual P&L result
- What went right/wrong
- Any biases that influenced the decision
- Lessons learned

---

*Source: Zerodha Varsity Module 9 -- Risk Management & Trading Psychology. All 16 chapters compiled for comprehensive reference.*
