# Module 5: Options Theory for Professional Trading

## Source: Zerodha Varsity
## Chapters: 25 (Complete Coverage)

---

# PART I: OPTION FUNDAMENTALS (Chapters 1-7)

---

## Chapter 1: Call Option Basics

### Definition
A call option is a contract that gives the buyer the **right, but not the obligation**, to buy an agreed quantity of a particular underlying asset from the seller at a certain time (expiration date) for a certain price (strike price).

### Key Participants
- **Buyer (Long)**: Pays premium; has the right to buy
- **Seller/Writer (Short)**: Receives premium; has the obligation to sell if buyer exercises

### Option Components

| Component | Definition |
|-----------|-----------|
| Underlying | The asset being traded (stock, index, commodity) |
| Strike Price | Agreed price for future purchase/sale |
| Premium | Fee paid by buyer to seller for the right |
| Expiry | Final date to exercise the right |

### Core P&L Framework for Call Buyers

**Breakeven Point:**
```
Breakeven = Strike Price + Premium Paid
```

**Profit/Loss at Expiration:**
```
If Spot > (Strike + Premium): Profit = Spot - Strike - Premium
If Spot <= Strike: Loss = Premium Paid (maximum loss)
```

**Maximum Loss:** Limited to premium paid
**Maximum Profit:** Theoretically unlimited

### Numerical Example
- Current stock price: Rs. 67
- Strike price: Rs. 75
- Premium: Rs. 5
- Breakeven: Rs. 80 (75 + 5)

| Scenario | Spot at Expiry | P&L per Share |
|----------|---------------|---------------|
| Stock rises | Rs. 85 | +Rs. 5 (85 - 75 - 5) |
| Stock falls | Rs. 65 | -Rs. 5 (premium lost) |
| Stock flat | Rs. 75 | -Rs. 5 (premium lost) |

### Key Insight
Statistically, sellers have higher probability of profit (2 out of 3 basic scenarios favor sellers). Options are leveraged instruments -- small premium controls larger asset value.

---

## Chapter 2: Basic Option Jargons

### Strike Price
The anchor price at which buyer and seller agree to transact. For call options, it represents the price at which stock can be bought on expiry day.

### Underlying Price
The spot market price of the asset. For call option buyers to profit, this price must increase beyond the strike price.

### Option Expiry
Options expire on the last Thursday of every month (now changed to Tuesday in India). Three expiry cycles exist: current month, mid-month, and far-month contracts.

### Option Premium
The fee paid by the option buyer to the seller for the right to exercise. Premium is never a fixed rate and varies based on multiple factors. Premiums change minute-by-minute in real markets.

### Exercising an Option
In Indian markets, European-style options can only be exercised on the day of expiry (not anytime before). However, traders can sell (square off) positions anytime before expiry.

### Settlement Example
- JP Associates call option at Rs. 25 strike
- Premium: Rs. 1.35, Lot size: 8,000 shares
- Spot at expiry: Rs. 32
- Intrinsic value: Rs. 7 per share (32 - 25)
- Total payout: Rs. 56,000
- Premium paid: Rs. 10,800 (1.35 x 8,000)
- Net profit: Rs. 45,200

### Premium Influencing Factors (5 Option Greeks)
1. Delta (directional sensitivity)
2. Gamma (rate of change of Delta)
3. Theta (time decay)
4. Vega (volatility sensitivity)
5. Rho (interest rate sensitivity)

---

## Chapter 3: Buying a Call Option

### Key Formulas

**Intrinsic Value (at expiry):**
```
IV = Max[0, (Spot Price - Strike Price)]
```

**P&L at Expiry:**
```
P&L = Max[0, (Spot Price - Strike Price)] - Premium Paid
```

**Breakeven Point:**
```
B.E. = Strike Price + Premium Paid
```

### Real-World Example: Bajaj Auto
- Spot Price: Rs. 2026.90
- Strike Price: Rs. 2050 CE
- Premium Paid: Rs. 6.35
- Breakeven: Rs. 2056.35 (2050 + 6.35)

| Spot at Expiry | Intrinsic Value | P&L |
|----------------|-----------------|-----|
| Rs. 2030 | 0 | -6.35 |
| Rs. 2050 | 0 | -6.35 |
| Rs. 2055 | 5 | -1.35 |
| Rs. 2056.35 | 6.35 | 0 (breakeven) |
| Rs. 2080 | 30 | +23.65 |

### Risk-Reward Profile
- **Maximum Loss**: Premium paid (Rs. 6.35) -- limited and known upfront
- **Maximum Profit**: Unlimited as underlying appreciates
- Loss is capped at premium regardless of how far spot falls
- True profitability begins only beyond breakeven point
- Profits increase linearly beyond breakeven

---

## Chapter 4: Selling/Writing a Call Option

### P&L Formula for Call Seller
```
P&L = Premium Received - Max[0, (Spot Price - Strike Price)]
```

### Breakeven (Breakdown) Point
```
Breakdown Point = Strike Price + Premium Received
```

### Risk-Reward Profile
- **Maximum Profit**: Limited to premium received
- **Maximum Loss**: Theoretically unlimited (as spot rises)

### Numerical Example: Bajaj Auto 2050 CE at Rs. 6.35 Premium

| Spot Price | Premium Received | Intrinsic Value | P&L |
|-----------|------------------|-----------------|-----|
| 2020 | 6.35 | 0 | +6.35 |
| 2050 | 6.35 | 0 | +6.35 |
| 2056.35 | 6.35 | 6.35 | 0 (breakeven) |
| 2057 | 6.35 | 7 | -0.65 |
| 2072 | 6.35 | 22 | -15.65 |

### Margin Requirements
Option sellers must deposit margin similar to futures contracts. Exchange mandates margin to manage default risk.

### Strategic Motivation
Sellers profit from market stagnation or decline. The seller believes the price will NOT increase, making premium collection attractive when expecting sideways or declining movement.

---

## Chapter 5: The Put Option -- Buying

### Definition
A put option grants the buyer the right to **sell** an underlying asset at a predetermined strike price upon expiry. The buyer profits when the underlying asset's price **declines**.

### Key Formulas

**Intrinsic Value (Put at expiry):**
```
IV = Max[0, (Strike Price - Spot Price)]
```

**P&L for Put Buyer:**
```
P&L = Max[0, (Strike Price - Spot Price)] - Premium Paid
```

**Breakeven Point:**
```
Breakeven = Strike Price - Premium Paid
```

### Risk-Reward Profile
- **Maximum Loss**: Premium paid (when Spot >= Strike at expiry)
- **Maximum Profit**: Theoretically unlimited (as spot approaches zero)
- **Profit Zone**: Spot price below breakeven point
- **Loss Zone**: Spot price above breakeven point

### Numerical Example: Bank Nifty 18400 PE at Rs. 315

| Spot Price | Intrinsic Value | P&L |
|-----------|-----------------|-----|
| 16,510 | 1,890 | +1,575 |
| 18,085 | 315 | 0 (breakeven) |
| 18,400 | 0 | -315 |
| 19,660 | 0 | -315 |

Breakeven = 18,400 - 315 = 18,085

---

## Chapter 6: The Put Option -- Selling

### P&L Formula for Put Seller
```
P&L = Premium Received - Max[0, (Strike Price - Spot Price)]
```

### Breakeven Point
```
Breakdown Point = Strike Price - Premium Received
```

### Risk-Reward Profile
- **Maximum Profit**: Limited to premium received
- **Maximum Loss**: Theoretically unlimited (practically capped at strike price if stock goes to zero)
- Loss increases Rs. 1 for every Rs. 1 spot price decline below strike

### Numerical Example: Bank Nifty 18400 PE at Rs. 315

| Spot Price | Intrinsic Value | P&L |
|-----------|-----------------|-----|
| Above 18,400 | 0 | +315 (max profit) |
| 18,400 | 0 | +315 (max profit) |
| 18,085 | 315 | 0 (breakeven) |
| 16,510 | 1,890 | -1,575 |

### Physical Settlement
If ITM at expiry, put seller is obligated to purchase shares at strike price.
- Effective purchase cost = Strike Price - Premium Received
- Example: Selling Rs. 120 strike put at Rs. 5 premium => effective rate is Rs. 115 if assigned

---

## Chapter 7: Summarizing Call & Put Options

### The Four Fundamental Option Positions

| Position | Market View | Premium Action | Max Profit | Max Loss |
|----------|------------|----------------|------------|----------|
| Long Call | Bullish | Pay | Unlimited | Premium Paid |
| Short Call | Flat/Bearish | Receive | Premium Received | Unlimited |
| Long Put | Bearish | Pay | Unlimited* | Premium Paid |
| Short Put | Flat/Bullish | Receive | Premium Received | Unlimited* |

*Unlimited in theory; practically limited by stock going to zero

### Consolidated P&L Formulas

```
Long Call:  P&L = Max[0, (Spot - Strike)] - Premium Paid
Short Call: P&L = Premium Received - Max[0, (Spot - Strike)]
Long Put:   P&L = Max[0, (Strike - Spot)] - Premium Paid
Short Put:  P&L = Premium Received - Max[0, (Strike - Spot)]
```

### Key Rules
- **Buyer Advantages**: Defined maximum loss; potentially unlimited gains
- **Seller Advantages**: Higher probability of profit; but potentially unlimited losses
- Sellers "eat like a chicken but shit like an elephant" -- steady small returns until catastrophic losses
- Most traders trade premiums and exit before expiry
- Hardly any traders hold option contracts until expiry

### Premium Determinants
Premiums are influenced by the **Option Greeks** via the **Black-Scholes pricing formula**. Greeks change continuously, driving minute-by-minute premium fluctuations.

---

# PART II: MONEYNESS (Chapter 8)

---

## Chapter 8: Moneyness of an Option Contract

### Definition
Moneyness classifies option strikes based on their intrinsic value relative to the current spot price.

### Intrinsic Value Formulas
```
Call Option IV = Max[0, (Spot Price - Strike Price)]
Put Option IV  = Max[0, (Strike Price - Spot Price)]
```

### The Three Moneyness Categories

#### In The Money (ITM)
An option with **positive intrinsic value**. The buyer would gain money if exercising immediately.
- **Call Options**: All strikes LOWER than spot price are ITM
- **Put Options**: All strikes HIGHER than spot price are ITM

#### At The Money (ATM)
The strike which is **closest to the spot price**. This is the reference point for classification.

#### Out Of The Money (OTM)
An option with **zero intrinsic value**. Exercising would result in no monetary gain.
- **Call Options**: All strikes HIGHER than spot price are OTM
- **Put Options**: All strikes LOWER than spot price are OTM

### Refined Moneyness Scale
```
Deep ITM --> ITM --> ATM --> OTM --> Deep OTM
```

### Premium and Moneyness Relationship
Premium decreases as you traverse from Deep ITM to Deep OTM. ITM options are always more expensive than OTM options because ITM options already possess intrinsic value.

### Premium Decomposition
```
Premium = Intrinsic Value + Time Value
```

Where:
```
Time Value = Premium - Intrinsic Value
```

### The Option Chain
A display of all available strike prices for an underlying showing:
- Premiums (LTP), bid-ask spreads, volumes, open interest
- Visual coding: ITM options highlighted differently from OTM options
- Calls on the left, puts on the right, strikes in the center

### Moneyness Summary Table

| Moneyness | Call Option (Strike vs Spot) | Put Option (Strike vs Spot) | Intrinsic Value |
|-----------|----------------------------|---------------------------|-----------------|
| Deep ITM | Strike << Spot | Strike >> Spot | Very High |
| ITM | Strike < Spot | Strike > Spot | Positive |
| ATM | Strike ~ Spot | Strike ~ Spot | Near Zero |
| OTM | Strike > Spot | Strike < Spot | Zero |
| Deep OTM | Strike >> Spot | Strike << Spot | Zero |

---

# PART III: THE OPTION GREEKS (Chapters 9-21)

---

## Chapter 9: Option Greeks -- Delta (Part 1)

### Definition
Delta measures the **rate of change of option premium based on the directional movement of the underlying**. It answers: by how many points will the option premium change for every 1-point change in the underlying?

### Delta Formula (Practical Application)
```
Premium Change = Delta x Change in Underlying Price
```

### Delta Ranges

| Option Type | Delta Range |
|-------------|-------------|
| Call Options | 0 to +1 |
| Put Options | -1 to 0 |

### Why Delta Cannot Exceed 1 (Calls)
If delta exceeded 1, the option would gain value faster than the underlying -- this violates the principle that derivatives cannot move faster than the underlying from which they derive value.

### Why Delta Cannot Be Negative (Calls)
Negative delta would mean premiums decrease when the underlying rises, which would make premiums potentially negative -- impossible for options.

### Delta by Moneyness

| Moneyness | Call Delta | Put Delta |
|-----------|-----------|-----------|
| Deep ITM | +0.8 to +1.0 | -0.8 to -1.0 |
| Slightly ITM | +0.6 to +1.0 | -0.6 to -1.0 |
| ATM | +0.45 to +0.55 | -0.45 to -0.55 |
| Slightly OTM | +0.3 to +0.45 | -0.3 to -0.45 |
| Deep OTM | 0.0 to +0.3 | -0.3 to 0.0 |

### Numerical Examples

**Call Option:**
- Spot: 8288, Strike: 8250 CE, Premium: 133, Delta: +0.55
- Nifty moves to 8310 (change of +22 points)
- Premium change = 22 x 0.55 = 12.1
- New premium = 133 + 12.1 = 145.1

**Put Option:**
- Spot: 8268, Strike: 8300 PE, Premium: 128, Delta: -0.55
- Nifty moves to 8310 (change of +42 points)
- Premium change = -0.55 x 42 = -23.1
- New premium = 128 - 23.1 = 104.9

### Source of Delta
Delta derives from the **Black-Scholes option pricing formula**. It is a market-driven value computed automatically by pricing models.

---

## Chapter 10: Delta (Part 2) -- Delta Acceleration

### The Four Stages of Delta

#### Stage 1: Predevelopment (Deep OTM)
- Delta close to zero (~0.05)
- Premium changes minimal in absolute terms
- Percentage returns can be large on small base (e.g., 41.6% on Rs. 12 premium)
- **Recommendation**: Avoid buying; consider selling

#### Stage 2: Takeoff & Acceleration (OTM to ATM Transition)
- Maximum "bang for the buck"
- Slightly OTM with 0.25 delta: Rs. 20 premium becomes Rs. 45 on 100-point move (125% gain)
- **Recommendation**: Best zone for buying options

#### Stage 3: Stabilization (ATM to Deep ITM)
- Delta approaches and locks at 1.0
- Percentage returns diminish but absolute returns match underlying
- Deep ITM option behaves like the underlying itself
- **Recommendation**: Can substitute for futures contracts

#### Stage 4: ATM Sweet Spot
- ATM options with 0.5 delta offer balanced sensitivity
- Rs. 60 premium ATM gains Rs. 50 on 100-point move (83% return)
- **Recommendation**: Safe trading with moderate capital

### Comparative Performance Table (30-point underlying move)

| Strike Level | Delta | Initial Premium | New Premium | % Change |
|-------------|-------|----------------|-------------|----------|
| Deep OTM (2400) | 0.05 | Rs. 3 | Rs. 4.50 | 50% |
| Slightly OTM (2275) | 0.30 | Rs. 7 | Rs. 16 | 129% |
| ATM (2210) | 0.50 | Rs. 12 | Rs. 27 | 125% |
| Slightly ITM (2200) | 0.70 | Rs. 22 | Rs. 43 | 95% |
| Deep ITM (2150) | 1.00 | Rs. 75 | Rs. 105 | 40% |

### Key Insight: Model Thinking
```
Expected Premium Change = Option Delta x Points Change in Underlying
```
Rather than thinking "bullish => buy calls," think: "I expect X-point movement, therefore buy options with delta Y."

---

## Chapter 11: Delta (Part 3) -- Portfolio Delta & Probability

### Adding Deltas Across Positions

Deltas from multiple option contracts on the same underlying can be summed to determine overall directional exposure.

**Example: Three Long Calls (Nifty spot 8125)**
- 8000 CE (ITM): +0.7 delta
- 8120 CE (ATM): +0.5 delta
- 8300 CE (OTM): +0.05 delta
- **Total Portfolio Delta: +1.25**
- For a 50-point move: position changes by 62.5 points

**Mixed Calls and Puts:**
- 8000 CE: +0.7
- 8300 PE: -1.0
- 8120 CE: +0.5
- 8300 CE: +0.05
- **Total: +0.25** (much less directionally sensitive)

### Delta Neutral Strategies

When combined delta equals zero, the position is insulated from directional market movements.

**ATM Call + ATM Put (same strike):**
- Call delta: +0.5
- Put delta: -0.5
- **Combined: 0** (Delta neutral)

Important: Delta neutral positions still respond to volatility (Vega) and time decay (Theta).

### Position Delta for Short Positions
```
Long 1 call (delta 0.5) = +0.5
Short 1 call (delta 0.5) = -0.5
Short 1 put (delta -0.5) = +0.5 (double negative)
```

### Delta as Probability

Delta approximates the probability of the option expiring in-the-money (ITM).

| Delta | Probability of Expiring ITM |
|-------|---------------------------|
| 0.10 | ~10% (Deep OTM) |
| 0.30 | ~30% (OTM) |
| 0.50 | ~50% (ATM) |
| 0.70 | ~70% (ITM) |
| 0.90 | ~90% (Deep ITM) |

**For sellers**: Deep OTM options (delta 0.1) have 90% probability of expiring worthless -- favorable odds for writing.

### Futures Delta
Futures contracts always have delta of 1.0 (constant), making them the directional baseline.

**Two ATM options (0.5 delta each) = 1 futures contract equivalent**

---

## Chapter 12: Gamma (Part 1)

### Definition
Gamma measures the **rate of change of delta for a given change in the underlying**. It is the second-order derivative of option premium with respect to the underlying price.

### Mathematical Framework

| Concept | Physics Analogy | Options Analogy |
|---------|----------------|-----------------|
| 1st Order Derivative | Velocity (change in distance/time) | Delta (change in premium/change in underlying) |
| 2nd Order Derivative | Acceleration (change in velocity/time) | Gamma (change in delta/change in underlying) |

### Key Relationships
```
Delta = First derivative of Premium with respect to Underlying
Gamma = Second derivative of Premium with respect to Underlying
      = First derivative of Delta with respect to Underlying
```

### Gamma Formula (Practical)
```
New Delta = Old Delta + (Gamma x Change in Underlying)
```

### Gamma Characteristics
- Gamma is always **positive** for both calls and puts
- Gamma captures how quickly delta changes as the underlying moves
- Higher gamma means delta changes faster

---

## Chapter 13: Gamma (Part 2) -- Practical Applications

### Calculation Examples

**Example 1: 70-point move**
- Nifty Spot: 8,326
- Strike: 8400 CE (Slightly OTM)
- Premium: Rs. 26, Delta: 0.3, Gamma: 0.0025
- Movement: +70 points

Calculations:
```
Change in premium = 0.3 x 70 = 21
New premium = 26 + 21 = Rs. 47
Change in delta = 0.0025 x 70 = 0.175
New delta = 0.3 + 0.175 = 0.475 (now near ATM)
```

**Example 2: Sequential +70 points**
```
New delta = 0.475 + (0.0025 x 70) = 0.65 (now ITM)
```

**Example 3: -50 points**
```
New delta = 0.65 + (0.0025 x -50) = 0.525
```

### Put Option Gamma
For ATM Put with gamma 0.004, delta -0.5:

**Underlying rises 10 points:**
```
New delta = -0.5 + (0.004 x 10) = -0.46
```

**Underlying falls 10 points:**
```
New delta = -0.5 + (0.004 x -10) = -0.54
```

### Gamma and Position Risk (Short Gamma Risk)

**Scenario: Short 10 lots of 8400 CE**
- Initial delta per lot: 0.5
- Initial position delta: 0.5 x 10 = 5 lots equivalent
- Perceived risk: 5 futures contracts

**After 70-point adverse move:**
- New delta: 0.85 (from 0.5 + 0.35 via gamma)
- New position delta: 0.85 x 10 = 8.5 lots equivalent
- **Risk exceeded intended limit by 70%!**

This demonstrates **"shorting options carries the risk of being short gamma."**

### Gamma by Moneyness

| Moneyness | Gamma Level | Delta Behavior | Risk Implication |
|-----------|-------------|----------------|-----------------|
| ATM | **Highest** | Changes rapidly | Never short ATM options |
| OTM | Low | Changes slowly | Better candidates for shorting |
| ITM | Low | Changes slowly | High base delta, but stable |

### Long vs Short Gamma

| Position | Gamma Effect |
|----------|-------------|
| Long Options (Buyer) | Long Gamma -- delta increases when market moves favorably (beneficial convexity) |
| Short Options (Seller) | Short Gamma -- delta changes work against the trader (adverse convexity) |

### Futures Gamma
The gamma of a futures contract is **zero** (delta is always 1.0, never changes).

---

## Chapter 14: Theta -- Time Decay

### Definition
Theta measures the rate at which an option loses value as time passes. It represents **points lost per day** when all other conditions remain the same.

### Premium Decomposition
```
Premium = Intrinsic Value + Time Value
```

### Theta Sign Convention
```
Long Options (Buyers):  Negative Theta (lose value daily)
Short Options (Sellers): Positive Theta (gain value daily)
```

### Theta Calculation Example

**Seller Benefit:**
- Options sold at Rs. 54, Theta: -0.75
- After 3 days: Premium = 54 - (0.75 x 3) = Rs. 51.75
- Seller profit: Rs. 2.25

### Time Value and Probability

| Days to Expiry | Probability of ITM | Time Value |
|----------------|-------------------|------------|
| 30 days | High | Very High |
| 15 days | Moderate | Moderate |
| 5 days | Low | Low |
| 1 day | Very Low | Minimal |

### Theta Acceleration Near Expiry

Theta exhibits **non-linear** (exponential) decay:
- **Early series** (120 to 100 days): Modest premium decline
- **Late series** (10 to 0 days): Dramatic premium collapse
- Acceleration is most pronounced in the **final week**
- Peak intensity on **expiry day itself**

### Theta by Moneyness

| Moneyness | Theta Impact | Acceleration Near Expiry |
|-----------|-------------|------------------------|
| OTM/ATM | **Highest** absolute theta | Most pronounced |
| ITM | Lower theta | Less dramatic |
| Deep ITM | Minimal theta | Negligible |

### Key Principle
"All other things being equal, an option is a depreciating asset."

### Strategic Implications
- **Sellers**: Theta works in your favor; selling early captures large time value; selling near expiry captures accelerated decay
- **Buyers**: Theta erodes positions daily; need directional moves or volatility expansion to offset decay

---

## Chapter 15: Volatility Basics

### Definition
Volatility is a **statistical measure of the dispersion of returns** for a given security or market index. Higher volatility = greater price fluctuations = more uncertainty = more risk.

### Standard Deviation as the Core Metric
```
Variance = Sum[(Xi - Mean)^2] / N
Standard Deviation (SD) = sqrt(Variance)
```

### Volatility as Percentage (Annual)
```
Lower Range = Current Price x (1 - Volatility%)
Upper Range = Current Price x (1 + Volatility%)
```

**Example: Nifty at 8547, Volatility 16.5%:**
```
Lower: 8547 x (1 - 0.165) = 7,136
Upper: 8547 x (1 + 0.165) = 9,957
```

Nifty expected to trade between 7,136 and 9,957 over one year with a certain probability.

---

## Chapter 16: Volatility Calculation (Historical)

### Step-by-Step Calculation Method

**Step 1:** Download 1 year of daily closing prices

**Step 2:** Calculate daily log returns
```
Daily Return = LN(Closing Price Today / Closing Price Yesterday)
```
Where LN = natural logarithm

**Step 3:** Calculate standard deviation of daily returns
```
Daily Volatility = STDEV(all daily returns)
```

**Step 4:** Annualize
```
Annual Volatility = Daily Volatility x sqrt(252)
```
Where 252 = typical number of trading days per year

**Reverse conversion:**
```
Daily Volatility = Annual Volatility / sqrt(252)
```

### Worked Example: Wipro Stock
```
Daily Volatility: 1.47%
Annual Volatility: 1.47% x sqrt(252) = 1.47% x 15.87 = 23.33%
```

---

## Chapter 17: Volatility & Normal Distribution

### The Normal Distribution (Bell Curve)

Stock market daily returns follow a normal distribution pattern. Two parameters fully describe it:
1. **Mean** (central value)
2. **Standard Deviation** (dispersion measure)

### The 68-95-99.7 Rule

```
Within 1 SD: 68% of data (68% confidence interval)
Within 2 SD: 95% of data (95% confidence interval)
Within 3 SD: 99.7% of data (99.7% confidence interval)
```

Events beyond 3 SD are **"Black Swan events"** -- rare but potentially catastrophic.

### Price Range Calculation Formulas

**Annualization:**
```
Annualized Average = Daily Average x 252
Annualized SD = Daily SD x sqrt(252)
```

**Price Range (using log returns):**
```
Upper Range = Current Price x e^(Average + n x SD)
Lower Range = Current Price x e^(Average - n x SD)
```
Where n = number of standard deviations (1, 2, or 3)

### Nifty 1-Year Example
- Daily Average: 0.04%
- Daily SD: 1.046%
- Current Price: 8,337

**Annualized:**
```
Average: 0.04% x 252 = 9.66%
SD: 1.046% x sqrt(252) = 16.61%
```

**1 SD Range (68% confidence):**
```
Upper: 8,337 x e^(9.66% + 16.61%) = 8,337 x e^(26.27%) = 10,841
Lower: 8,337 x e^(9.66% - 16.61%) = 8,337 x e^(-6.95%) = 7,777
```

**2 SD Range (95% confidence):**
```
Upper: 8,337 x e^(9.66% + 33.22%) = 8,337 x e^(42.88%) = 12,800
Lower: 8,337 x e^(9.66% - 33.22%) = 8,337 x e^(-23.56%) = 6,587
```

### 30-Day Range Calculation
```
30-day Average = Daily Average x 30
30-day SD = Daily SD x sqrt(30)
```

**Example:**
```
Average: 0.04% x 30 = 1.15%
SD: 1.046% x sqrt(30) = 5.73%

1 SD Upper: 8,337 x e^(6.88%) = 8,930
1 SD Lower: 8,337 x e^(-4.58%) = 7,963

2 SD Upper: 8,337 x e^(12.61%) = 9,457
2 SD Lower: 8,337 x e^(-10.31%) = 7,520
```

---

## Chapter 18: Volatility Applications

### Application 1: Strike Selection for Option Writing

Using normal distribution properties to identify strikes likely to expire worthless:

```
For N-day period:
N-day SD = Daily SD x sqrt(N)
N-day Average = Daily Average x N

Upper Bound = Current Price x (1 + Average + n*SD)
Lower Bound = Current Price x (1 - Average + n*SD)
```

Strikes beyond these ranges (at chosen confidence level) are candidates for writing.

### Application 2: Volatility-Based Stop Loss

Instead of fixed percentage stops:
```
Period Volatility = Daily Volatility x sqrt(holding days)
Stop Loss = Entry Price - (Period Volatility x Entry Price)
```

**Example: 5-day trade, 1.8% daily volatility:**
```
5-day volatility = 1.8% x sqrt(5) = 4.01%
Entry at 395: SL = 395 - (4.01% x 395) = 379
```

### Practical Strategy for Option Writing
- Write calls 3-4 days before expiry for maximum theta decay
- Favor call writing over puts (volatility rises faster than it falls)
- Limit exposure to 35% of short-term trading capital
- Exit when options transition from OTM to ATM
- Carries black swan risk: consistent small gains with potential for large losses

---

## Chapter 19: Vega

### Definition
Vega measures the rate of change of an option's value (premium) with every **percentage point change in implied volatility**.

```
Premium Change due to Volatility = Vega x Change in Volatility (%)
```

### Key Characteristics
- Vega is **always positive** for both calls and puts
- Premiums increase when volatility rises; decrease when it falls
- Effect of volatility changes is **maximum when more days to expiry**

### Vega Impact by Time to Expiry

| Days to Expiry | Impact of Vol Doubling (15% to 30%) |
|----------------|--------------------------------------|
| 30 days | ~95.5% premium increase |
| 15 days | ~50% premium increase |
| 5 days | ~47% premium increase |

### Three Types of Volatility

1. **Historical Volatility**: Calculated from past closing prices; backward-looking
2. **Forecasted Volatility**: Predicted using statistical models (e.g., GARCH); forward-looking
3. **Implied Volatility (IV)**: Extracted from current option premiums; represents market consensus expectation

**India VIX** = Official implied volatility index for Indian markets, computed from Nifty options order book data, representing expected volatility over next 30 calendar days.

### Vega by Moneyness
- Options **closer to the money (ATM)** exhibit **higher Vega**
- Deep OTM and deep ITM options show **lower Vega**

### Real-World Demonstration
August 24, 2015: Market declined 4.92%, India VIX surged 64%.
- OTM call premiums (above 8650) **increased 50-80%** despite market falling
- Low-delta OTM options had minimal directional impact but high Vega
- Volatility surge overwhelmed directional (delta) effect

### Vega for Buyers vs Sellers
- **Buyers (Long Vega)**: Benefit from volatility increase
- **Sellers (Short Vega)**: Benefit from volatility decrease

---

## Chapter 20: Greek Interactions

### Volatility Smile
All options on the same underlying expiring on the same date should theoretically display similar implied volatilities. In reality, IV **increases** as you move away from ATM toward OTM and ITM, creating a **smile-shaped curve**.

### Volatility Cone Framework

Used to assess whether options are expensive or cheap relative to historical patterns:

1. Calculate realized volatility over historical periods (10, 20, 30, 45, 60, 90 days)
2. Compute statistical metrics: mean, SD, +/-1SD, +/-2SD boundaries
3. Plot current implied volatility against historical ranges

**Interpretation:**
```
Options near +2SD line = Trading EXPENSIVE (rich)
Options near -2SD line = Trading CHEAP
```

### Gamma vs Time to Expiry

| Time Period | ITM Gamma | ATM Gamma | OTM Gamma |
|-------------|-----------|-----------|-----------|
| Ample time | Low | Low | Low |
| Mid-life | Stable | Stable | Stable |
| Near expiry | Approaches 0 | **HIGHEST** | Approaches 0 |

**Critical**: ATM gamma becomes extremely high near expiry -- avoid shorting ATM options as expiration approaches.

### Delta vs Implied Volatility

**Low volatility (20%):**
- Delta curves flatten at extremes
- Deep ITM options behave like futures (delta ~ 1)
- OTM option deltas approach zero

**High volatility (40%):**
- Delta becomes more reactive across wider strike range
- Deep OTM options maintain non-zero deltas and meaningful premiums
- Wider range of options around ATM are sensitive to spot price changes

### Impact on Spreads
**Bull Call Spread example:**
```
At 20% IV: Spread cost = 72, Profit potential = 128
At 35% IV: Spread cost = 82, Profit potential = 118
```
Higher volatility makes spreads more expensive and less profitable.

### Key Trading Principle
"Try to short options which are costlier (near +2SD on volatility cone) and go long on options which are trading cheap (near -2SD)."

---

## Chapter 21: The Black-Scholes Option Pricing Model & Greek Calculator

### History
Published by Fisher Black and Myron Scholes in 1973. Robert C. Merton and Myron Scholes received the 1997 Nobel Prize in Economics for this work.

### Model Inputs (6 Variables)

| Input | Description | Source |
|-------|-------------|--------|
| **S** - Spot Price | Current market price of underlying | Market data |
| **K** - Strike Price | Exercise price of the option | Option contract |
| **r** - Risk-Free Interest Rate | Typically RBI 91-day Treasury bill rate | RBI data |
| **sigma** - Implied Volatility | Market's expectation of future volatility | NSE option chain |
| **D** - Dividend | Expected dividends before expiry | Company announcements |
| **T** - Time to Expiry | Calendar days remaining to expiration | Contract specification |

### Model Outputs
- Theoretical Call Premium (C)
- Theoretical Put Premium (P)
- All Option Greeks: Delta, Gamma, Theta, Vega, Rho

### The Black-Scholes Formula

**For a European Call Option:**
```
C = S * N(d1) - K * e^(-rT) * N(d2)
```

**For a European Put Option:**
```
P = K * e^(-rT) * N(-d2) - S * N(-d1)
```

**Where:**
```
d1 = [ln(S/K) + (r + sigma^2/2) * T] / (sigma * sqrt(T))
d2 = d1 - sigma * sqrt(T)
```

**Variables:**
- S = Current spot price of the underlying
- K = Strike price of the option
- r = Risk-free interest rate (annualized, continuously compounded)
- T = Time to expiration (in years; e.g., 30 days = 30/365)
- sigma = Volatility of the underlying (annualized)
- N(x) = Cumulative standard normal distribution function
- e = Euler's number (2.71828...)
- ln = Natural logarithm

### Option Greeks from Black-Scholes

**Delta:**
```
Call Delta = N(d1)
Put Delta = N(d1) - 1 = -N(-d1)
```

**Gamma (same for calls and puts):**
```
Gamma = N'(d1) / (S * sigma * sqrt(T))
```
Where N'(d1) = standard normal probability density function evaluated at d1:
```
N'(d1) = (1/sqrt(2*pi)) * e^(-d1^2/2)
```

**Theta:**
```
Call Theta = [-S * N'(d1) * sigma / (2 * sqrt(T))] - [r * K * e^(-rT) * N(d2)]
Put Theta  = [-S * N'(d1) * sigma / (2 * sqrt(T))] + [r * K * e^(-rT) * N(-d2)]
```

**Vega (same for calls and puts):**
```
Vega = S * sqrt(T) * N'(d1)
```

**Rho:**
```
Call Rho = K * T * e^(-rT) * N(d2)
Put Rho  = -K * T * e^(-rT) * N(-d2)
```

### Put-Call Parity

A fundamental relationship linking put and call prices:
```
P + S = K * e^(-rT) + C
```
Or equivalently:
```
C - P = S - K * e^(-rT)
```

Where:
- P = Put premium
- C = Call premium
- S = Spot price
- K = Strike price
- r = Risk-free rate
- T = Time to expiry
- K * e^(-rT) = Present value of strike price

### Practical Notes
- Small differences between theoretical and market prices arise from input assumption variations
- "Good to have room for inevitable modeling errors"
- Model assumes European-style options (exercise only at expiry)
- Model assumes no dividends (adjustments needed for dividend-paying stocks)
- Assumes constant volatility and interest rates (not always true in practice)

---

# PART IV: PRACTICAL APPLICATION (Chapters 22-25)

---

## Chapter 22: Re-introducing Call & Put Options (Strike Selection with Greeks)

### Decision Framework: Three Key Variables

**1. Volatility Assessment**
- Buy options when volatility is expected to **increase** (premiums rise)
- Sell options when volatility is expected to **decrease** (premiums fall)
- Compare implied volatility to historical volatility

**2. Time to Expiry (Series Phase)**
- **First half**: Days 1-15 of a 30-day contract
- **Second half**: Days 15-30 (accelerated theta decay)

**3. Target Achievement Timeframe**
When you expect your directional target to be reached

### Strike Selection Matrix -- First Half of Series (15+ days to expiry)

| Target Timeline | Recommended Strike | Rationale |
|----------------|-------------------|-----------|
| 5 days | Far OTM (2-3 strikes from ATM) | Swift move + ample time cushions theta |
| 15 days | ATM or slightly OTM | Balanced risk-reward |
| 25 days | Slightly ITM or ATM | Theta significant; need intrinsic protection |
| Expiry day | ITM | Only intrinsic value survives |

### Strike Selection Matrix -- Second Half of Series (<15 days to expiry)

| Target Timeline | Recommended Strike | Rationale |
|----------------|-------------------|-----------|
| Same day | Far OTM (2-3 strikes) | News-driven leverage before theta hits |
| 5 days | Slightly OTM (1 strike) | Theta intensifies; reduce OTM exposure |
| 10 days | ATM or slightly ITM | Theta dominates; need intrinsic value |
| Expiry day | ITM | Only intrinsic value survives |

### Critical Insight on OTM Options
"People end up buying OTM options simply because the premiums are lower... the low premium creates an illusion that you won't lose much, but in reality there is a very high probability for you to lose all the money."

OTM profitability **decreases** as holding period extends relative to expiry because theta decay accelerates.

---

## Chapter 23: Case Studies -- Real Trading Examples

### Trade 1: CEAT India Put (Directional Technical Trade)

**Setup:** CEAT at Rs. 1,260, uptrend exhaustion observed
- **Action**: Bought 1220 PE at Rs. 45.75
- **Rationale**: Technical resistance, limited risk vs shorting futures
- **Result**: Stock fell to Rs. 1,244 next day; premium rose to Rs. 52; exited for Rs. 7 profit (15.3% ROI overnight)

**Expert Analysis**: For exhaustion patterns, selling calls may be better than buying puts (sideways more likely than sharp decline).

### Trade 2: Nifty RBI Policy (Delta-Neutral Short Straddle)

**Setup:** RBI announcement expected; pre-event volatility elevated
- **Action**: Short ATM straddle -- Sold 7800 CE at Rs. 203 + Sold 7800 PE at Rs. 176
- **Combined premium**: Rs. 379
- **Exit**: Before announcement; CE at 191, PE at 178; combined Rs. 369
- **Profit**: 10 points per lot (2.6% overnight)

**Key Insight**: Shorting options before events more profitable than buying both sides (Long Straddle). "The speed at which the losing leg loses value is faster than the speed at which the winning leg gains value."

### Trade 3: Infosys Q2 (Improved Short Straddle)

**Setup:** Q2 results in 4 days; volatility elevated
- **Action**: Short 1140 CE at Rs. 48 (IV 40.26%) + Short 1140 PE at Rs. 47 (IV 48%)
- **Combined premium**: Rs. 95
- **Post-results**: CE rose to Rs. 55 (IV dropped to 28%), PE dropped to Rs. 20 (IV dropped to 40%)
- **Exit combined**: Rs. 75
- **Profit**: 20 points per lot (21% over 4 days)

**Key Observation**: "The speed at which the call option shot up was lesser than the speed at which the Put option dropped its value" -- IV crush dominates directional effect.

### Trade 4: Infosys Post-Results (Fundamental Directional Trade)

**Setup:** Infosys fell 5% despite good Q2 (overreaction to guidance cut)
- **Action**: Long 1100 CE at Rs. 18.9
- **Thesis**: Market overreacted to bad news; fundamentals supportive
- **Result**: Exited October 21; more than doubled money (101% ROI in 9 days)

### Cross-Trade P&L Summary

| Trade | Strategy | Duration | ROI |
|-------|----------|----------|-----|
| CEAT | Long Put | 1 day | 15.3% |
| RBI Nifty | Short Straddle | 1 day | 2.6% |
| Infosys Q2 | Short Straddle | 4 days | 21% |
| Infosys Fund | Long Call | 9 days | 101% |

---

## Chapter 24: Physical Settlement

### What is Physical Settlement?
Stock F&O contracts at expiry require actual delivery of underlying securities rather than cash settlement. Only ITM options trigger physical settlement; OTM options expire worthless with no delivery obligation.

### Delivery Obligations

**Must TAKE Delivery (Buy shares):**
- Long futures
- Long ITM call options
- Short ITM put options

**Must GIVE Delivery (Sell shares):**
- Short futures
- Short ITM call options
- Long ITM put options

### Margin Requirements
- Normal trading: Only margin amounts (SPAN + Exposure)
- Near expiry: Must bring **100% of contract value** to take delivery or bring stocks to give delivery
- Brokers progressively increase margin requirements as expiry approaches

### Netting Off
Hedged positions offset automatically:
- Long futures + Short ITM call = No delivery obligation
- Long ITM call + Long ITM put = Positions offset
- Short futures + Long ITM call = No delivery obligation

### Important Notes
- Index options remain **cash-settled** (no physical delivery)
- Stock options are **physically settled**
- Settlement occurs T+2 for share delivery

---

## Chapter 25: Options M2M and P&L Calculation

### No Mark-to-Market for Options

Unlike futures, **options have no daily M2M process**. Reasons:
- Option buyers pay full premium upfront (maximum loss is known)
- Only sellers face open-ended risk requiring margin protection
- Since buyers haven't deposited margins, there's no basis for daily M2M

### P&L for Positions Closed Before Expiry
```
P&L = (Selling Premium - Buying Premium) x Lot Size x Number of Lots
```

**Example:**
```
Buy 2 lots Reliance 2500 CE at Rs. 76
Sell at Rs. 79
P&L = (79 - 76) x 250 x 2 = Rs. 1,500
```

### Short Position Margin Dynamics
When sellers write options, margins increase as premiums move unfavorably. Margin calls trigger around 109% utilization.

### Physical Settlement P&L at Expiry

**Long Call (ITM):**
```
Effective Purchase Price = Strike + Premium Paid
Profit = Settlement Price - Effective Price
```

**Short Call (ITM):**
```
Effective Sale Price = Strike + Premium Received
Loss = Settlement Price - Effective Price
```

**Long Put (ITM):**
```
Effective Sale Price = Strike - Premium Paid
Profit = Effective Price - Settlement Price
```

**Short Put (ITM):**
```
Effective Purchase Price = Strike - Premium Received
Loss = Effective Price - Settlement Price
```

### Key Distinctions
- **No margin requirement** for option buyers (they pay full premium)
- **Margin only for sellers** (SPAN + Exposure charges)
- **OTM at expiry**: Buyer loses premium; seller retains it
- **Settlement timing**: T+2 for physical delivery; T+1 for P&L settlement

---

# COMPREHENSIVE FORMULA REFERENCE

## Option Payoff Formulas (At Expiry)

```
Long Call P&L  = Max[0, (S - K)] - Premium
Short Call P&L = Premium - Max[0, (S - K)]
Long Put P&L   = Max[0, (K - S)] - Premium
Short Put P&L  = Premium - Max[0, (K - S)]
```

## Breakeven Formulas

```
Call Breakeven = Strike + Premium
Put Breakeven  = Strike - Premium
```

## Intrinsic Value

```
Call IV = Max[0, (Spot - Strike)]
Put IV  = Max[0, (Strike - Spot)]
```

## Premium Decomposition

```
Premium = Intrinsic Value + Time Value
Time Value = Premium - Intrinsic Value
```

## Black-Scholes Option Pricing Model

```
C = S * N(d1) - K * e^(-rT) * N(d2)
P = K * e^(-rT) * N(-d2) - S * N(-d1)

d1 = [ln(S/K) + (r + sigma^2/2) * T] / (sigma * sqrt(T))
d2 = d1 - sigma * sqrt(T)
```

## Option Greeks

```
Call Delta = N(d1)
Put Delta  = N(d1) - 1

Gamma = N'(d1) / (S * sigma * sqrt(T))

Call Theta = [-S * N'(d1) * sigma / (2*sqrt(T))] - [r*K*e^(-rT)*N(d2)]
Put Theta  = [-S * N'(d1) * sigma / (2*sqrt(T))] + [r*K*e^(-rT)*N(-d2)]

Vega = S * sqrt(T) * N'(d1)

Call Rho = K * T * e^(-rT) * N(d2)
Put Rho  = -K * T * e^(-rT) * N(-d2)

Where: N'(x) = (1/sqrt(2*pi)) * e^(-x^2/2)
```

## Put-Call Parity

```
C - P = S - K * e^(-rT)
```

## Volatility Calculations

```
Daily Return = ln(P_today / P_yesterday)
Daily Volatility = STDEV(daily returns)
Annual Volatility = Daily Volatility * sqrt(252)
N-day Volatility = Daily Volatility * sqrt(N)
```

## Price Range Predictions

```
Upper (1 SD) = Price * e^(mean + 1*SD)
Lower (1 SD) = Price * e^(mean - 1*SD)
Upper (2 SD) = Price * e^(mean + 2*SD)
Lower (2 SD) = Price * e^(mean - 2*SD)
```

## Portfolio Delta

```
Total Delta = Sum of (individual position deltas)
Long Call Delta = +delta
Short Call Delta = -delta
Long Put Delta = delta (negative value)
Short Put Delta = -delta (becomes positive)
```

## Delta as Probability

```
P(ITM at expiry) ~ |Delta|
P(OTM at expiry) ~ 1 - |Delta|
```

## Gamma Application

```
New Delta = Old Delta + (Gamma * Change in Underlying)
New Premium ~ Old Premium + (Delta * Change in Underlying)
```

## Volatility-Adjusted Stop Loss

```
Period Volatility = Daily Vol * sqrt(holding days)
Stop Loss = Entry - (Period Volatility * Entry)
```

---

# GREEKS INTERACTION SUMMARY TABLE

| Greek | Measures | Buyer Impact | Seller Impact | Highest For |
|-------|----------|-------------|---------------|-------------|
| Delta | Directional sensitivity | Positive for calls, negative for puts | Opposite of buyer | ATM options |
| Gamma | Rate of delta change | Beneficial (long gamma) | Adverse (short gamma) | ATM near expiry |
| Theta | Time decay per day | Negative (erodes value) | Positive (earns value) | ATM options |
| Vega | Volatility sensitivity | Positive (benefits from vol rise) | Negative (hurt by vol rise) | ATM with time |
| Rho | Interest rate sensitivity | Positive for calls | Negative for calls | Deep ITM, long-dated |

---

# KEY TRADING FRAMEWORKS

## When to Buy vs Sell Options

| Scenario | Action | Rationale |
|----------|--------|-----------|
| Strong directional view, limited risk appetite | Buy options | Limited loss, unlimited gain |
| Expecting sideways/range-bound | Sell options | Collect theta decay |
| Before major events (earnings, policy) | Sell straddles/strangles | Capture IV crush post-event |
| High IV environment | Sell options | Premiums rich, likely to contract |
| Low IV environment | Buy options | Premiums cheap, likely to expand |

## Option Seller Risk Management Rules
1. Never short ATM options near expiry (extreme gamma risk)
2. Monitor position delta continuously (gamma shifts exposure)
3. Use volatility cone to identify expensive options for selling
4. Keep position sizing conservative (max 35% of trading capital)
5. Exit when OTM options transition toward ATM
6. Understand: "Eat like a chicken, shit like an elephant" -- small consistent gains with potential for large losses

## IV Crush Strategy (Pre-Event)
1. Initiate 4 days before event (not 1 day)
2. Sell ATM straddle/strangle
3. Exit before announcement
4. Captures elevated pre-event IV premium
5. Avoid holding through event (directional risk)

---

# MONEYNESS QUICK REFERENCE

## Call Options
```
Deep ITM:  Strike << Spot  | Delta ~0.9-1.0  | High Premium  | Low Gamma
ITM:       Strike < Spot   | Delta ~0.6-0.8  | Moderate-High | Low Gamma
ATM:       Strike ~ Spot   | Delta ~0.5      | Moderate      | Highest Gamma
OTM:       Strike > Spot   | Delta ~0.2-0.4  | Low           | Moderate Gamma
Deep OTM:  Strike >> Spot  | Delta ~0-0.1    | Very Low      | Very Low Gamma
```

## Put Options
```
Deep ITM:  Strike >> Spot  | Delta ~-0.9 to -1.0 | High Premium  | Low Gamma
ITM:       Strike > Spot   | Delta ~-0.6 to -0.8 | Moderate-High | Low Gamma
ATM:       Strike ~ Spot   | Delta ~-0.5         | Moderate      | Highest Gamma
OTM:       Strike < Spot   | Delta ~-0.2 to -0.4 | Low           | Moderate Gamma
Deep OTM:  Strike << Spot  | Delta ~0 to -0.1    | Very Low      | Very Low Gamma
```

---

# PUT-CALL RATIO (PCR) INTERPRETATION

The Put-Call Ratio is derived from option chain data:

```
PCR = Total Put Open Interest / Total Call Open Interest
```

**Interpretation:**
| PCR Value | Market Sentiment | Trading Implication |
|-----------|-----------------|---------------------|
| > 1.0 | Bearish (more puts traded) | Contrarian: may signal bottom |
| ~ 1.0 | Neutral | Market indecision |
| < 1.0 | Bullish (more calls traded) | Contrarian: may signal top |
| > 1.5 | Extreme bearish | Strong contrarian buy signal |
| < 0.5 | Extreme bullish | Strong contrarian sell signal |

PCR is often used as a **contrarian indicator** -- extreme readings suggest the crowd may be wrong.

---

# MAX PAIN THEORY

### Definition
Max Pain is the strike price at which the **maximum number of option contracts (both calls and puts) would expire worthless**, causing maximum financial loss to option buyers and maximum benefit to option sellers/writers.

### Calculation
```
For each strike price:
  Call Pain = Sum of (Max[0, Spot - Strike] * Call OI) for all call strikes
  Put Pain  = Sum of (Max[0, Strike - Spot] * Put OI) for all put strikes
  Total Pain = Call Pain + Put Pain

Max Pain Strike = Strike price where Total Pain is MINIMUM
```

### Theory
The underlying price tends to gravitate toward the Max Pain strike at expiry because:
- Option writers (institutions) have an incentive to move prices toward max pain
- Pinning effect: hedging activities by market makers push prices toward max pain
- Works best in range-bound, low-volatility markets

### Practical Usage
- Identify the max pain level before expiry week
- Use as a reference point for expected expiry settlement
- More reliable for index options than stock options
- Less reliable during strong trending markets or high-volatility events

---

# OPTION CHAIN ANALYSIS FRAMEWORK

### Key Metrics to Analyze

1. **Open Interest (OI)**: Total outstanding contracts at each strike
   - High OI at a strike = strong support/resistance
   - Call OI buildup = resistance level
   - Put OI buildup = support level

2. **Change in OI**: Directional shift in market positioning
   - Increasing Call OI + Rising Premium = Fresh call buying (bullish)
   - Increasing Put OI + Rising Premium = Fresh put buying (bearish)
   - Increasing Call OI + Falling Premium = Fresh call writing (bearish)
   - Increasing Put OI + Falling Premium = Fresh put writing (bullish)

3. **IV Skew**: Compare IV across strikes
   - Higher IV at OTM puts vs OTM calls = Demand for downside protection
   - Uniform IV = Normal conditions

4. **Volume**: Intraday trading activity at each strike
   - High volume at specific strikes signals institutional interest
   - Volume confirms OI changes

### Reading the Option Chain

```
Calls Side | Strike | Puts Side
OI, Volume, IV, LTP, Bid-Ask | Price | OI, Volume, IV, LTP, Bid-Ask
```

- ITM calls (lower strikes) highlighted on left
- ITM puts (higher strikes) highlighted on right
- ATM strike in center with highest combined premium

---

# PAYOFF DIAGRAM CALCULATIONS

### Long Call Payoff
```
At each price point X:
  Payoff = Max(0, X - Strike) - Premium
  
Below Strike: Payoff = -Premium (flat line)
Above Strike: Payoff increases linearly at 45 degrees
At Breakeven (Strike + Premium): Payoff = 0
```

### Short Call Payoff
```
At each price point X:
  Payoff = Premium - Max(0, X - Strike)
  
Below Strike: Payoff = +Premium (flat line)
Above Strike: Payoff decreases linearly
Mirror image of Long Call
```

### Long Put Payoff
```
At each price point X:
  Payoff = Max(0, Strike - X) - Premium
  
Above Strike: Payoff = -Premium (flat line)
Below Strike: Payoff increases linearly as price falls
At Breakeven (Strike - Premium): Payoff = 0
```

### Short Put Payoff
```
At each price point X:
  Payoff = Premium - Max(0, Strike - X)
  
Above Strike: Payoff = +Premium (flat line)
Below Strike: Payoff decreases linearly
Mirror image of Long Put
```

### Combined Position Payoff
For any combination of options, the total payoff is the **sum of individual payoffs** at each price point.

---

# HISTORICAL CONTEXT

- Indian index options launched June 4, 2001
- Significant liquidity emerged in 2006 (post-Ambani demerger)
- Nearly 80% of Indian derivatives volume is options-based
- Physical settlement introduced to prevent price manipulation
- Weekly options introduced more recently for greater granularity
- India VIX provides official implied volatility measure

---

*Module compiled from all 25 chapters of Zerodha Varsity's Options Theory for Professional Trading module. All formulas, frameworks, and quantitative methods preserved for use in stock prediction and ranking systems.*
