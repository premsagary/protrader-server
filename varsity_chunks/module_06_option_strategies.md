# Module 6: Option Strategies (Zerodha Varsity)

> Comprehensive knowledge base covering all 14 chapters from Zerodha Varsity's Option Strategies module.
> Source: https://zerodha.com/varsity/module/option-strategies/

---

## Chapter 1: Orientation

### Core Philosophy
- "You only need to know a handful of strategies but you need to know them really well."
- No strategy is a guaranteed money-making machine. Success depends on proper execution, market reading, and discipline.
- The phrase "limited risk, unlimited profit potential" is called out as a "silent P&L killer" that leads traders to blow accounts.

### Strategy Classification

**Bullish Strategies:**
1. Bull Call Spread
2. Bull Put Spread
3. Call Ratio Back Spread
4. Bear Call Ladder
5. Call Butterfly
6. Synthetic Call
7. Straps

**Bearish Strategies:**
1. Bear Call Spread
2. Bear Put Spread
3. Bull Put Ladder
4. Put Ratio Back Spread
5. Strip
6. Synthetic Put

**Neutral Strategies:**
1. Long & Short Straddles
2. Long & Short Strangles
3. Long & Short Iron Condor
4. Long & Short Butterfly
5. Box

### Behavioral Finance Warning
- Anticipating a win is more exciting than actually winning (reflexive brain vs. reflective brain).
- Winning creates addictive seeking behavior that can destroy trading accounts.
- Quality time in the markets (experience) is essential for mastery.

---

## Chapter 2: Bull Call Spread

### Strategy Setup
| Leg | Action | Strike | Type |
|-----|--------|--------|------|
| 1 | Buy | ATM | Call Option |
| 2 | Sell | OTM | Call Option |

**Requirements:** Same underlying, same expiry, same quantity per leg.

### Market Outlook
- **Moderately bullish** -- expects price appreciation but lacks aggressive conviction.
- Suitable when: company guidance suggests better-than-expected results (but magnitude uncertain), stock testing multi-year support (relief rally potential), or price at 2nd standard deviation with mean reversion expected.

### Key Formulas
| Metric | Formula |
|--------|---------|
| **Net Debit** | Premium Paid (lower strike) - Premium Received (higher strike) |
| **Max Profit** | Spread - Net Debit |
| **Max Loss** | Net Debit |
| **Breakeven** | Lower Strike + Net Debit |
| **Spread** | Higher Strike - Lower Strike |

### Numerical Example
- Nifty spot: 7,846
- Buy 7800 CE at Rs. 79 (debit)
- Sell 7900 CE at Rs. 25 (credit)
- **Net Debit:** 79 - 25 = Rs. 54
- **Max Loss:** Rs. 54 (if Nifty expires at or below 7800)
- **Max Profit:** (7900 - 7800) - 54 = Rs. 46 (if Nifty expires at or above 7900)
- **Breakeven:** 7800 + 54 = 7,854

### Payoff Table
| Market at Expiry | Lower Strike CE IV | Upper Strike CE IV | Net P&L |
|------------------|--------------------|--------------------|---------|
| 7700 | 0 | 0 | -54 |
| 7800 | 0 | 0 | -54 |
| 7854 | 54 | 0 | 0 (BE) |
| 7900 | 100 | 0 | +46 |
| 8000 | 200 | 100 | +46 |

### Strike Selection by Time to Expiry

**First Half of Series (start of expiry cycle):**
| Expected Move Timeline | Recommended Strikes |
|------------------------|---------------------|
| 5-day move | Far OTM / Far OTM |
| 15-day move | Slightly OTM / Slightly OTM |
| 25-day move | ATM / ATM |
| By expiry | ATM / ATM |

**Second Half of Series (final 15 days):**
| Expected Move Timeline | Recommended Strikes |
|------------------------|---------------------|
| 1-2 day move | Far OTM / Far OTM |
| 5-day move | Far OTM / Far OTM (reduced profitability) |
| 10-day move | Slightly OTM (1 strike from ATM) |
| On expiry | ATM strikes (losses deepen with OTM) |

### Alternative Strike Combinations
| Setup | Strikes | Net Debit | Max Profit | Breakeven | Risk:Reward |
|-------|---------|-----------|------------|-----------|-------------|
| ITM + ATM | 7700/7800 | 69 | 31 | 7769 | Unfavorable (69:31) |
| ATM + OTM (Classic) | 7800/7900 | 60 | 40 | 7860 | Moderate |
| OTM + OTM | 7900/8000 | 51 | 49 | 7951 | Attractive but high BE |

### Volatility & Greeks
- Theta decay significantly influences strike selection -- always consider theta.
- "Wider the spread, higher is the amount of money you can potentially make, but as a trade off the breakeven also increases."
- Cost reduction vs. naked call: Bull call spread reduces capital outlay by ~32% while capping upside.

---

## Chapter 3: Bull Put Spread

### Strategy Setup
| Leg | Action | Strike | Type |
|-----|--------|--------|------|
| 1 | Buy | OTM | Put Option |
| 2 | Sell | ITM | Put Option |

**Requirements:** Same underlying, same expiry, same quantity per leg.
**Type:** Credit Spread (net credit received upfront).

### Market Outlook
- **Moderately bullish** -- expects markets to stay at current levels or move higher.
- Best when: markets have declined considerably (put premiums swelled), volatility is on the higher side, plenty of time to expiry.

### Key Formulas
| Metric | Formula |
|--------|---------|
| **Net Credit** | Premium Received (higher strike) - Premium Paid (lower strike) |
| **Max Profit** | Net Credit |
| **Max Loss** | Spread - Net Credit |
| **Breakeven** | Higher Strike - Net Credit |
| **Spread** | Higher Strike - Lower Strike |

### Numerical Example
- Nifty spot: 7,805
- Buy 7700 PE at Rs. 72 (OTM)
- Sell 7900 PE at Rs. 163 (ITM)
- **Net Credit:** 163 - 72 = Rs. 91
- **Max Profit:** Rs. 91 (if Nifty expires at or above 7900)
- **Max Loss:** (7900 - 7700) - 91 = Rs. 109 (if Nifty expires at or below 7700)
- **Breakeven:** 7900 - 91 = 7,809

### Payoff Table
| Market at Expiry | 7700 PE IV | 7900 PE IV | Net Payoff |
|------------------|-----------|-----------|------------|
| 7600 | 100 | 300 | -109 |
| 7700 | 0 | 200 | -109 |
| 7809 | 0 | 91 | 0 (BE) |
| 7900 | 0 | 0 | +91 |
| 8000 | 0 | 0 | +91 |

### Strike Selection Variations
| Strikes | Spread | Net Credit | Max Loss | Max Profit | Breakeven |
|---------|--------|------------|----------|------------|-----------|
| 7500/7700 | 200 | 75 | 125 | 75 | 7625 |
| 7400/7800 | 400 | 158 | 242 | 158 | 7642 |
| 7500/7800 | 300 | 136 | 164 | 136 | 7664 |

**Principle:** The further the strikes, the larger the spread, the larger the possible reward, but also the higher the breakeven.

### Volatility & Greeks
- Thrives when volatility contracts post-entry (net short vega position).
- Rising volatility after entry increases losses; declining volatility improves P&L.
- **Theta:** Beneficial -- time decay erodes short put value faster.
- **Vega:** Negative -- position benefits from falling IV.

### Bull Call Spread vs. Bull Put Spread
- Payoff profiles are similar.
- Bull Call Spread = net debit (pay upfront). Bull Put Spread = net credit (receive upfront).
- Choice depends on which premiums are more attractively priced.

---

## Chapter 4: Call Ratio Back Spread

### Strategy Setup
| Leg | Action | Strike | Quantity | Type |
|-----|--------|--------|----------|------|
| 1 | Sell | ITM | 1 lot | Call Option |
| 2 | Buy | OTM | 2 lots | Call Option |

**Ratio:** 1:2 (sell 1, buy 2). Can scale to 2:4, 3:6, etc.
**Requirements:** Same underlying, same expiry. Must maintain the 2:1 buy-to-sell ratio.

### Market Outlook
- **Outrightly bullish** -- expects significant upward movement (not just moderate).
- Profits from large moves in the expected direction; also has limited profit if market drops.

### Payoff Characteristics
- **Unlimited profit** if market goes up significantly.
- **Limited profit** (net credit) if market goes down.
- **Predefined loss** if market stays within a range (between breakevens).

### Key Formulas
| Metric | Formula |
|--------|---------|
| **Spread** | Higher Strike - Lower Strike |
| **Net Credit** | Premium Received (ITM) - 2 x Premium Paid (OTM) |
| **Max Loss** | Spread - Net Credit |
| **Max Loss Occurs At** | Higher (OTM) Strike Price |
| **Lower Breakeven** | Lower Strike + Net Credit |
| **Upper Breakeven** | Higher Strike + Max Loss |

### Numerical Example
- Nifty spot: 7,743
- Sell 1 lot 7600 CE (ITM) at Rs. 201
- Buy 2 lots 7800 CE (OTM) at Rs. 78 each (total Rs. 156)
- **Net Credit:** 201 - 156 = Rs. 45
- **Spread:** 7800 - 7600 = 200
- **Max Loss:** 200 - 45 = Rs. 155 (occurs at 7800)
- **Lower BE:** 7600 + 45 = 7,645
- **Upper BE:** 7800 + 155 = 7,955

### Payoff Table
| Market at Expiry | 7600 CE (sold) | 7800 CE x2 (bought) | Net Payoff |
|------------------|----------------|----------------------|------------|
| 7400 | Worthless (+201) | Worthless (-156) | +45 |
| 7600 | Worthless (+201) | Worthless (-156) | +45 |
| 7645 | IV=45, net +156 | Worthless (-156) | 0 (Lower BE) |
| 7700 | IV=100, net +101 | Worthless (-156) | -55 |
| 7800 | IV=200, net +1 | Worthless (-156) | -155 (Max Loss) |
| 7955 | IV=355, net -154 | IV=155x2=310, net +154 | 0 (Upper BE) |
| 8100 | IV=500, net -299 | IV=300x2=600, net +444 | +145 |

### Strike Selection by Timing

**First Half of Series (15+ days remaining):**
- Expecting 5-15 day move: Use slightly ITM + slightly OTM combination
- Use spreads of ~300 points for consistent profits

**Second Half of Series (final 15 days):**
- Expecting 1-10 day move: Use deep ITM + slightly ITM strikes
- Avoid classic ITM + OTM combination in final days

### Volatility Impact
| Days to Expiry | Volatility Effect | Detail |
|----------------|-------------------|--------|
| 30 days | **Beneficial** | Payoff improves from -67 to +43 when vol rises 15% to 30% |
| 15 days | Moderately beneficial | Payoff improves from -77 to -47 |
| Few days | **Negative** | Increasing volatility hurts; enhances probability of OTM expiry |

**Critical Rule:** Avoid entering when volatility is already high at series start (premiums will be inflated, reducing profitability).

---

## Chapter 5: Bear Call Ladder

### Strategy Setup
| Leg | Action | Strike | Quantity | Type |
|-----|--------|--------|----------|------|
| 1 | Sell | ITM | 1 lot | Call Option |
| 2 | Buy | ATM | 1 lot | Call Option |
| 3 | Buy | OTM | 1 lot | Call Option |

**Ratio:** 1:1:1 (can scale to 2:2:2, 3:3:3, etc.)

### Market Outlook
- Despite the "bear" name, this is a **bullish strategy**.
- Used when expecting significant upward movement.
- Works best on individual stocks around quarterly earnings announcements.

### Key Formulas
| Metric | Formula |
|--------|---------|
| **Net Credit** | ITM Premium Received - ATM Premium Paid - OTM Premium Paid |
| **Max Loss** | Spread (ITM to ATM) - Net Credit |
| **Lower Breakeven** | Lower Strike + Net Credit |
| **Upper Breakeven** | (OTM Strike + ATM Strike) - ITM Strike - Net Credit |

### Numerical Example
- Sell 7600 CE (ITM) at Rs. 247
- Buy 7800 CE (ATM) at Rs. 117
- Buy 7900 CE (OTM) at Rs. 70
- **Net Credit:** 247 - 117 - 70 = Rs. 60
- **Spread:** 7800 - 7600 = 200
- **Max Loss:** 200 - 60 = Rs. 140 (occurs at ATM and OTM strikes, i.e., 7800-7900)
- **Lower BE:** 7600 + 60 = 7,660
- **Upper BE:** (7900 + 7800) - 7600 - 60 = 8,040

### Payoff Table
| Market at Expiry | Net Payoff | Zone |
|------------------|------------|------|
| Below 7600 | +60 | Profit (net credit) |
| 7660 | 0 | Lower Breakeven |
| 7700 | -40 | Loss zone |
| 7800 | -140 | Max Loss |
| 7900 | -140 | Max Loss |
| 8040 | 0 | Upper Breakeven |
| 8300 | +260 | Unlimited profit |

### Profit Zones
- **Below lower BE (7660):** Fixed profit = net credit
- **Between 7660 and 8040:** Loss zone, max loss of 140 at 7800-7900
- **Above upper BE (8040):** Unlimited profit potential

### Volatility Impact
| Days to Expiry | Volatility Effect | Detail |
|----------------|-------------------|--------|
| 30 days | **Beneficial** | Payoff improves from -67 to +43 (vol 15% to 30%) |
| 15 days | Moderately beneficial | Payoff improves from -77 to -47 |
| Few days | **Negative** | Higher vol enhances OTM expiry probability |

**Rule:** Avoid deployment at series start if volatility is already elevated.

---

## Chapter 6: Synthetic Long & Arbitrage

### Strategy Setup
| Leg | Action | Strike | Type |
|-----|--------|--------|------|
| 1 | Buy | ATM | Call Option |
| 2 | Sell | ATM | Put Option |

**Requirements:** Same underlying, same expiry, identical strike prices.

### Market Outlook
- Replicates a **long futures** payoff structure.
- Linear payoff -- for every point above/below breakeven, P&L changes by exactly 1 point.

### Key Formulas
| Metric | Formula |
|--------|---------|
| **Net Cost** | Call Premium Paid - Put Premium Received |
| **Breakeven** | ATM Strike + Net Cost |
| **Max Profit** | Unlimited (upside) |
| **Max Loss** | Unlimited (downside, like futures) |

### Numerical Example
- Nifty spot: 7,389; ATM Strike: 7400
- Buy 7400 CE at Rs. 107
- Sell 7400 PE at Rs. 80
- **Net Cost:** 107 - 80 = Rs. 27
- **Breakeven:** 7400 + 27 = 7,427

### Payoff Table
| Market at Expiry | 7400 CE P&L | 7400 PE P&L | Net Payoff |
|------------------|-------------|-------------|------------|
| 7200 | -107 | -120 | -227 |
| 7427 | -80 | +80 | 0 (BE) |
| 7600 | +93 | +80 | +173 |

### Put-Call Parity & Arbitrage

**Core Equation:**
```
Long Synthetic Long + Short Futures = 0
=> Long ATM Call + Short ATM Put + Short Futures = 0
```

When this equation produces non-zero P&L, an **arbitrage opportunity** exists.

### Arbitrage Example
- Nifty spot: 7,304; Futures: 7,316
- Long 7300 CE at Rs. 79.5
- Short 7300 PE at Rs. 73.85
- Short Nifty Futures at 7,316

**Result at ANY expiry level:**
| Market at Expiry | CE P&L | PE P&L | Futures P&L | Net |
|------------------|--------|--------|-------------|-----|
| 7200 | -79.5 | -26.15 | +116 | **+10.35** |
| 7300 | -79.5 | +73.85 | +16 | **+10.35** |
| 7400 | +20.5 | +73.85 | -84 | **+10.35** |

**Locked profit of 10.35 points regardless of market direction.**

### Cost Considerations for Arbitrage
- Brokerage: Traditional brokers consume 8-10 points; discount brokers reduce to 4-5 points.
- STT: ITM options at expiry trigger substantial STT charges.
- Other taxes: Service tax, stamp duty erode returns.
- **Profitability threshold:** Execute only if P&L after all expenses exceeds ~15-20 points.

### Risks
- Liquidity risk (illiquid option series)
- Execution risk (slippage on multi-leg entry)
- Opportunity risk (premiums shift before all legs execute)
- Corporate action risk (dividends, splits affect fair value)

---

## Chapter 7: Bear Put Spread

### Strategy Setup
| Leg | Action | Strike | Type |
|-----|--------|--------|------|
| 1 | Buy | ITM | Put Option |
| 2 | Sell | OTM | Put Option |

**Requirements:** Same underlying, same expiry, same quantity.
**Type:** Net Debit strategy.

### Market Outlook
- **Moderately bearish** -- expects a 4-5% correction in the near term, not a steep decline.

### Key Formulas
| Metric | Formula |
|--------|---------|
| **Net Debit** | Premium Paid (higher strike) - Premium Received (lower strike) |
| **Max Profit** | Spread - Net Debit |
| **Max Loss** | Net Debit |
| **Breakeven** | Higher Strike - Net Debit |
| **Spread** | Higher Strike - Lower Strike |

### Numerical Example
- Buy 7600 PE (ITM) at Rs. 165
- Sell 7400 PE (OTM) at Rs. 73
- **Net Debit:** 165 - 73 = Rs. 92
- **Spread:** 7600 - 7400 = 200
- **Max Profit:** 200 - 92 = Rs. 108 (if Nifty expires at or below 7400)
- **Max Loss:** Rs. 92 (if Nifty expires at or above 7600)
- **Breakeven:** 7600 - 92 = 7,508

### Payoff Table
| Market at Expiry | Net Payoff |
|------------------|------------|
| 7800 | -92 |
| 7600 | -92 |
| 7508 | 0 (BE) |
| 7400 | +108 |
| 7200 | +108 |

### Strike Selection by Time to Expiry

**First Half of Series (ample time):**
| Timeline | Higher Strike | Lower Strike |
|----------|--------------|--------------|
| 5 days | Far OTM | Far OTM |
| 15 days | ATM | Slightly OTM |
| 25 days | ATM | OTM |
| At expiry | ATM | OTM |

**Second Half of Series (limited time):**
| Timeline | Higher Strike | Lower Strike |
|----------|--------------|--------------|
| Same day | OTM | OTM |
| 5 days | ITM/OTM | OTM |
| 10 days | ITM/OTM | OTM |
| At expiry | ITM/OTM | OTM |

### Volatility Impact
| Days to Expiry | Volatility Sensitivity |
|----------------|------------------------|
| 30 days | Does not vary much |
| 15 days | Varies moderately |
| 5 days | Varies significantly |

**Rule:** Advisable to take bear put spread only when volatility is expected to increase (especially in the 2nd half of the series).

### Greeks Analysis
- **Combined Delta Example:** Long 7600 PE delta (-0.618) + Short 7400 PE delta (+0.342) = **-0.276**
- Negative delta confirms bearish bias: premiums rise when market falls.
- If combined delta equals zero, the strategy is "Delta Neutral."

---

## Chapter 8: Bear Call Spread

### Strategy Setup
| Leg | Action | Strike | Type |
|-----|--------|--------|------|
| 1 | Sell | ITM | Call Option |
| 2 | Buy | OTM | Call Option |

**Requirements:** Same underlying, same expiry, same quantity.
**Type:** Credit Spread (receives net credit upfront).

### Market Outlook
- **Moderately bearish** -- expects market to decline or stay at current levels.
- Best when: markets have rallied considerably (call premiums swelled), volatility is elevated, ample time to expiry.

### Key Formulas
| Metric | Formula |
|--------|---------|
| **Net Credit** | Premium Received (ITM) - Premium Paid (OTM) |
| **Max Profit** | Net Credit |
| **Max Loss** | Spread - Net Credit |
| **Breakeven** | Lower Strike + Net Credit |
| **Spread** | Higher Strike - Lower Strike |

### Numerical Example
- Nifty spot: 7,222
- Sell 7100 CE (ITM) at Rs. 136
- Buy 7400 CE (OTM) at Rs. 38
- **Net Credit:** 136 - 38 = Rs. 98
- **Spread:** 7400 - 7100 = 300
- **Max Profit:** Rs. 98 (if Nifty expires at or below 7100)
- **Max Loss:** 300 - 98 = Rs. 202 (if Nifty expires at or above 7400)
- **Breakeven:** 7100 + 98 = 7,198

### Volatility Impact
| Days to Expiry | Sensitivity |
|----------------|-------------|
| 30+ days | Minimal volatility sensitivity |
| 15 days | Moderate volatility impact |
| 5 days | Significant volatility variation |

---

## Chapter 9: Put Ratio Back Spread

### Strategy Setup
| Leg | Action | Strike | Quantity | Type |
|-----|--------|--------|----------|------|
| 1 | Sell | ITM | 1 lot | Put Option |
| 2 | Buy | OTM | 2 lots | Put Option |

**Ratio:** 1:2 (sell 1, buy 2). Can scale proportionally.

### Market Outlook
- **Outrightly bearish** -- expects significant downward movement.
- Superior to buying plain vanilla puts due to net credit received.

### Payoff Characteristics
- **Unlimited profit** if market goes down significantly.
- **Limited profit** (net credit) if market goes up.
- **Predefined loss** if market stays within a range.

### Key Formulas
| Metric | Formula |
|--------|---------|
| **Spread** | Higher Strike - Lower Strike |
| **Net Credit** | ITM Put Premium Received - 2 x OTM Put Premium Paid |
| **Max Loss** | Spread - Net Credit |
| **Max Loss Occurs At** | Lower (OTM) Strike Price |
| **Upper Breakeven** | Lower Strike + Max Loss |
| **Lower Breakeven** | Lower Strike - Max Loss |

### Numerical Example
- Nifty spot: 7,506
- Sell 1 lot 7500 PE (ITM) at Rs. 134
- Buy 2 lots 7200 PE (OTM) at Rs. 46 each (total Rs. 92)
- **Net Credit:** 134 - 92 = Rs. 42
- **Spread:** 7500 - 7200 = 300
- **Max Loss:** 300 - 42 = Rs. 258 (occurs at 7200)
- **Upper BE:** 7200 + 258 = 7,458
- **Lower BE:** 7200 - 258 = 6,942

### Payoff Table
| Market at Expiry | Net Payoff | Zone |
|------------------|------------|------|
| 7600 | +42 | Profit (above ITM strike) |
| 7458 | 0 | Upper Breakeven |
| 7200 | -258 | Max Loss (at OTM strike) |
| 6942 | 0 | Lower Breakeven |
| 6800 | +142 | Unlimited profit zone |

### Greeks
- Overall position delta: +0.55 + (-0.29) + (-0.29) = **-0.03** (near delta-neutral at setup, slight bearish bias).

### Volatility Impact
| Days to Expiry | Volatility Effect | Detail |
|----------------|-------------------|--------|
| 30+ days | **Beneficial** | Payoff improves from -57 to +10 (vol 15% to 30%) |
| 15 days | Moderate benefit | Payoff improves from -77 to -47 |
| Few days | Minimal impact | Focus shifts to directional movement |

**Rule:** Avoid deploying if volatility is already significantly elevated at series start.

---

## Chapter 10: The Long Straddle

### Strategy Setup
| Leg | Action | Strike | Type |
|-----|--------|--------|------|
| 1 | Buy | ATM | Call Option |
| 2 | Buy | ATM | Put Option |

**Requirements:** Same underlying, same expiry, same (ATM) strike price.

### Market Outlook
- **Direction-neutral, volatility-bullish** -- expects a large move in either direction.
- "The market can move in any direction, but it has to move."

### Key Formulas
| Metric | Formula |
|--------|---------|
| **Total Cost** | Call Premium + Put Premium |
| **Max Loss** | Total Premium Paid (occurs at strike price) |
| **Upper Breakeven** | ATM Strike + Total Premium |
| **Lower Breakeven** | ATM Strike - Total Premium |
| **Max Profit** | Unlimited (in either direction) |

### Numerical Example
- Nifty at 7,579; ATM Strike: 7600
- Buy 7600 CE at Rs. 77
- Buy 7600 PE at Rs. 88
- **Total Cost:** 77 + 88 = Rs. 165
- **Max Loss:** Rs. 165 (if Nifty expires exactly at 7600)
- **Upper BE:** 7600 + 165 = 7,765
- **Lower BE:** 7600 - 165 = 7,435

### Payoff Table
| Market at Expiry | Net Payoff |
|------------------|------------|
| 7200 | +235 |
| 7435 | 0 (Lower BE) |
| 7600 | -165 (Max Loss) |
| 7765 | 0 (Upper BE) |
| 8000 | +235 |

### Delta Neutrality
- Call delta: +0.5
- Put delta: -0.5
- **Net delta: 0** -- no directional bias at setup.

### Volatility Requirements
1. **Low volatility at entry** -- lower premiums reduce setup cost.
2. **Increasing volatility during holding period** -- expanding option values enhance profits.
3. **Large underlying price movement** -- must exceed breakeven points.
4. **Time-bound moves** -- must occur within expiration window.

### Critical Warning: Volatility Trap
- Buying straddles before major events (earnings, policy announcements) can backfire.
- If the event outcome matches expectations, volatility collapses (vol crush), destroying premiums.
- The trap: "bought at high volatility and sold at low volatility."
- Best results when entry occurs at subdued volatility AND actual results dramatically diverge from consensus.

### When to Deploy
- Entry during relatively subdued volatility.
- Expecting significant event with uncertain outcome.
- Sufficient time remains before expiration.
- Actual results expected to diverge dramatically from consensus.

---

## Chapter 11: The Short Straddle

### Strategy Setup
| Leg | Action | Strike | Type |
|-----|--------|--------|------|
| 1 | Sell | ATM | Call Option |
| 2 | Sell | ATM | Put Option |

**Requirements:** Same underlying, same expiry, same (ATM) strike price.

### Market Outlook
- **Range-bound / volatility-bearish** -- expects market to stay near current levels with no significant movement.
- Profits from time decay and volatility contraction.

### Key Formulas
| Metric | Formula |
|--------|---------|
| **Net Credit** | Call Premium + Put Premium |
| **Max Profit** | Net Premium Collected (at strike price) |
| **Upper Breakeven** | ATM Strike + Net Premium |
| **Lower Breakeven** | ATM Strike - Net Premium |
| **Max Loss** | Unlimited (in either direction) |

### Numerical Example
- Nifty at 7,589; ATM Strike: 7600
- Sell 7600 CE at Rs. 77
- Sell 7600 PE at Rs. 88
- **Net Credit:** 77 + 88 = Rs. 165
- **Max Profit:** Rs. 165 (if Nifty expires exactly at 7600)
- **Upper BE:** 7600 + 165 = 7,765
- **Lower BE:** 7600 - 165 = 7,435

### Payoff Table
| Market at Expiry | Net Payoff |
|------------------|------------|
| 7200 | -235 |
| 7435 | 0 (Lower BE) |
| 7600 | +165 (Max Profit) |
| 7765 | 0 (Upper BE) |
| 8000 | -235 |

### Greeks Impact
- **Delta:** Short 0.5 (call) + short (-0.5) (put) = 0 (neutral at setup). Position loses neutrality as market moves.
- **Theta:** Positive -- time decay benefits the position. Accelerates as expiration approaches.
- **Vega:** Negative -- benefits from falling implied volatility.

### Volatility Requirements
- **High IV at entry** -- maximizes premium collected.
- **Decreasing IV during hold** -- volatility crush after events benefits the position.

### When to Deploy
- "Short straddles can be set around major events, wherein before the event, the volatility would drive the premiums up and just after the announcement, the volatility would cool off, and so would the premiums."
- Best in low-volatility, range-bound environments.
- Around major events when expecting volatility crush post-announcement.

### Case Study: Infosys Q2 Results (October 2016)
- Stock at Rs. 1,142; ATM Strike: 1140
- Sell 1140 CE at Rs. 48 (IV: 40.26%)
- Sell 1140 PE at Rs. 47 (IV: 48%)
- **Net Premium:** Rs. 95
- **Setup:** 4 days before earnings announcement (peak volatility)
- **Result:** After results (8.7% revenue growth):
  - 1140 CE traded at 55 (IV dropped to 28%)
  - 1140 PE traded at 20 (IV dropped to 40%)
  - Net premium declined to 75
- **Profit: 20 points per lot** -- "the speed at which the call option shot up was lesser than the speed at which the Put option dropped its value."

### Risk Management
- Losses are uncapped on either side -- position management and stop-losses essential.

---

## Chapter 12: The Long & Short Strangle

### Long Strangle

#### Strategy Setup
| Leg | Action | Strike | Type |
|-----|--------|--------|------|
| 1 | Buy | OTM | Call Option |
| 2 | Buy | OTM | Put Option |

**Requirements:** Same underlying, same expiry, equidistant from ATM when possible.

#### Market Outlook
- **Direction-neutral, volatility-bullish** -- expects large market move, direction unknown.
- "The market will move (direction unknown) hence you have set up the strangle."

#### Key Formulas
| Metric | Formula |
|--------|---------|
| **Total Cost** | OTM Call Premium + OTM Put Premium |
| **Max Loss** | Total Premium Paid (if market stays between strikes) |
| **Upper Breakeven** | CE Strike + Total Premium |
| **Lower Breakeven** | PE Strike - Total Premium |
| **Max Profit** | Unlimited (in either direction) |

#### Numerical Example
- Nifty at 7,921
- Buy 7700 PE at Rs. 28
- Buy 8100 CE at Rs. 32
- **Total Cost:** 28 + 32 = Rs. 60
- **Upper BE:** 8100 + 60 = 8,160
- **Lower BE:** 7700 - 60 = 7,640

#### Payoff Table
| Market at Expiry | Net Payoff |
|------------------|------------|
| 7500 | +140 |
| 7640 | 0 (Lower BE) |
| 7700-8100 | -60 (Max Loss) |
| 8160 | 0 (Upper BE) |
| 8300 | +140 |

#### Volatility Requirements
- Low volatility at entry (cheaper premiums).
- Increasing volatility during holding period.
- Requires significant underlying price movement exceeding breakeven points.

#### Cost Advantage vs. Straddle
- Long strangle uses OTM options = lower premium cost.
- Tradeoff: Wider breakeven points requiring larger moves for profitability.
- Example: Straddle costs 123 points (2.07% BE distance) vs. Strangle costs 60 points (wider BE distance).

---

### Short Strangle

#### Strategy Setup
| Leg | Action | Strike | Type |
|-----|--------|--------|------|
| 1 | Sell | OTM | Call Option |
| 2 | Sell | OTM | Put Option |

**Requirements:** Same underlying, same expiry, equidistant from ATM preferred.

#### Market Outlook
- **Range-bound / volatility-bearish** -- expects market to stay within a defined range.
- Best for "stocks which are in a trading range, typically stocks in a trading range form double/triple tops and bottom."

#### Key Formulas
| Metric | Formula |
|--------|---------|
| **Net Credit** | OTM Call Premium + OTM Put Premium |
| **Max Profit** | Net Credit (if market stays between strikes) |
| **Upper Breakeven** | CE Strike + Net Credit |
| **Lower Breakeven** | PE Strike - Net Credit |
| **Max Loss** | Unlimited (in either direction) |

#### Numerical Example
- Sell 7700 PE at Rs. 28
- Sell 8100 CE at Rs. 32
- **Net Credit:** 28 + 32 = Rs. 60
- **Max Profit:** Rs. 60 (if Nifty stays between 7700 and 8100)
- **Upper BE:** 8100 + 60 = 8,160
- **Lower BE:** 7700 - 60 = 7,640

#### Payoff Table
| Market at Expiry | Net Payoff |
|------------------|------------|
| 7500 | -140 |
| 7640 | 0 (Lower BE) |
| 7700-8100 | +60 (Max Profit) |
| 8160 | 0 (Upper BE) |
| 8300 | -140 |

#### Volatility Requirements
- High volatility at entry (maximizes premium collected).
- Expect volatility to contract during holding period.
- Profits from time decay (positive theta) and volatility compression.

#### Greeks
- Delta: OTM options at ~0.3 delta each; combined delta approximately 0 (delta-neutral).
- Theta: Works in favor of short strangle.

#### Risk Management
- "Set stoploss on the entire strategy and not really on single legs."
- Use overall portfolio stop-loss rather than individual leg stops.
- Monitor for breakout/breakdown beyond short strikes.

---

### Long Strangle vs. Short Strangle Summary

| Attribute | Long Strangle | Short Strangle |
|-----------|---------------|----------------|
| Setup | Buy OTM Call + Buy OTM Put | Sell OTM Call + Sell OTM Put |
| Outlook | Large move expected, direction unknown | Range-bound, low movement expected |
| Max Profit | Unlimited | Net premium collected |
| Max Loss | Net premium paid | Unlimited |
| Volatility | Want low entry, rising after | Want high entry, falling after |
| Theta | Works against | Works in favor |
| Cost | Net debit | Net credit |

---

## Chapter 13: Max Pain & PCR Ratio

### Max Pain Theory

#### Definition
Max Pain (or "Option Pain") is the single price point at which, upon expiration, option writers experience the least financial loss. The theory posits that markets tend to expire near this level since "90% of the options expire worthless, hence option writers/sellers tend to make money more often."

#### Calculation Method (5 Steps)
1. List all available strikes with their Call and Put open interest (OI).
2. Assume market expires at each strike price.
3. Calculate total money lost by both call and put option writers at that expiration level.
4. Sum losses across call and put writers for each strike.
5. The strike with the **least combined loss** = Max Pain level.

#### Calculation Example

| Strike | Call OI | Put OI | Combined Writer Loss at Expiry |
|--------|---------|--------|-------------------------------|
| 7700 | 1,823,400 | 5,783,025 | Rs. 998,287,500 |
| 7800 | 3,448,575 | 4,864,125 | Rs. 438,277,500 |
| 7900 | 5,367,450 | 2,559,375 | Rs. 7,095,375,000 |

**Result:** Strike 7800 shows minimum writer loss = **Max Pain level is 7800.**

#### Practical Modifications (Author's Approach)
1. Calculate Max Pain 15 days before expiration.
2. Add a 5% safety buffer (~1.5-2 standard deviations away).
3. Create an expiration range rather than targeting exact price.
4. Write call options beyond the upper buffer boundary.
5. Avoid writing puts ("panic spreads faster than greed").
6. Hold positions through expiry without averaging.

#### Usage for Trading
- Identify strikes for writing options (sell calls above Max Pain + buffer, puts below).
- Establish probable expiration range for position planning.
- Support strategy setup for spreads and naked positions.
- **Limitation:** Max Pain changes daily as OI fluctuates.

---

### Put-Call Ratio (PCR)

#### Formula
```
PCR = Total Put Open Interest / Total Call Open Interest
```

#### Example
- Put OI: 37,016,925
- Call OI: 42,874,200
- PCR = 37,016,925 / 42,874,200 = **0.863**

#### Interpretation Levels
| PCR Value | Interpretation | Trading Signal |
|-----------|---------------|----------------|
| Above 1.3 | Extreme bearishness | Oversold, reversal upward possible |
| Around 1.0 | Normal market activity | Neutral |
| 0.5 - 1.0 | Regular trading range | No extreme signal |
| Below 0.5 | Extreme bullishness | Overbought, reversal downward possible |

#### Contrarian Logic
When traders become heavily bearish or bullish (extreme PCR values), most participants have already positioned themselves, leaving few to drive prices further. Positions eventually square off, driving prices in the opposite direction. PCR thus serves as a **contrarian indicator.**

#### Key Caveats
- Threshold values differ between indices (e.g., Nifty uses 1.3 as extreme) and individual stocks.
- Works best combined with other technical and fundamental analysis.
- Requires backtesting for specific underlyings.

---

## Chapter 14: Iron Condor

### Strategy Setup
| Leg | Action | Strike | Type |
|-----|--------|--------|------|
| 1 | Buy | Further OTM | Put Option (protection) |
| 2 | Sell | Slightly OTM | Put Option |
| 3 | Sell | Slightly OTM | Call Option |
| 4 | Buy | Further OTM | Call Option (protection) |

**Key Rule:** Strike distribution must be even -- "The PE and CE that you buy should have even strike distribution from the sold strike."

**Execution Sequence (Critical):** Buy far OTM call first, then sell OTM call, then buy far OTM put, then sell OTM put. "You need to have a long position first before initiating the short position."

### Market Outlook
- **Market neutral / range-bound** -- profits when underlying stays within a defined range.
- Works best "when Nifty stays within a range."

### Key Formulas
| Metric | Formula |
|--------|---------|
| **Net Credit** | (Sold Put Premium + Sold Call Premium) - (Bought Put Premium + Bought Call Premium) |
| **Max Profit** | Net Premium Received |
| **Max Loss** | Spread - Net Premium Received |
| **Upper Breakeven** | Sold Call Strike + Net Premium |
| **Lower Breakeven** | Sold Put Strike - Net Premium |
| **Spread** | Difference between sold strike and its protective (bought) strike |

### Numerical Example
- Nifty at 9,972.9
- Buy 9600 PE at Rs. 105.05 (far OTM protection)
- Sell 9800 PE at Rs. 165.25 (slightly OTM)
- Sell 10100 CE at Rs. 145.25 (slightly OTM)
- Buy 10300 CE at Rs. 77.00 (far OTM protection)
- **Net Credit:** (165.25 + 145.25) - (105.05 + 77.00) = Rs. 128.45 per unit (Rs. 9,634 total)
- **Spread:** 200 points (9800-9600 or 10300-10100)
- **Max Profit:** Rs. 128.45 (if Nifty stays between 9800 and 10100)
- **Max Loss:** 200 - 128.45 = Rs. 71.55 (if Nifty breaches beyond bought strikes)
- **Upper BE:** 10100 + 128.45 = 10,228.45
- **Lower BE:** 9800 - 128.45 = 9,671.55

### Payoff Structure
| Market Zone | Payoff |
|-------------|--------|
| Below 9600 (far below bought put) | -71.55 (Max Loss) |
| 9671.55 | 0 (Lower BE) |
| 9800 - 10100 (between sold strikes) | +128.45 (Max Profit) |
| 10228.45 | 0 (Upper BE) |
| Above 10300 (far above bought call) | -71.55 (Max Loss) |

### Iron Condor vs. Short Strangle

| Attribute | Iron Condor | Short Strangle |
|-----------|-------------|----------------|
| Max Profit | Lower (pays for protection) | Higher (no protection cost) |
| Max Loss | **Capped** (defined) | **Unlimited** |
| Margin Required | Much lower (~Rs. 44,303) | Higher (~Rs. 1,45,090) |
| ROI | 21% (9,643/44,303) | 16% (23,288/1,45,090) |
| Risk Visibility | Complete | Open-ended |

### Margin Advantage
- Short Strangle margin: ~Rs. 1,45,090
- Iron Condor margin (with 80% spread reduction): ~Rs. 44,303
- Iron Condor achieves **higher ROI** (21% vs. 16%) despite lower absolute profit, due to dramatically reduced capital requirements.

### Volatility & Greeks
- Great way to trade volatility during high-premium environments.
- Short premium collection partially finances long protective positions.
- Natural hedging against gamma and theta decay near expiration.
- Benefits from volatility contraction post-entry.

---

## Cross-Strategy Comparison: When to Use Each

### By Market Outlook

| Market View | Strategies | Key Differentiator |
|-------------|------------|-------------------|
| **Moderately Bullish** | Bull Call Spread, Bull Put Spread | Call spread = debit; Put spread = credit |
| **Strongly Bullish** | Call Ratio Back Spread, Bear Call Ladder | Unlimited upside potential |
| **Moderately Bearish** | Bear Put Spread, Bear Call Spread | Put spread = debit; Call spread = credit |
| **Strongly Bearish** | Put Ratio Back Spread | Unlimited downside profit |
| **Large Move Expected (direction unknown)** | Long Straddle, Long Strangle | Straddle = ATM (costlier, tighter BE); Strangle = OTM (cheaper, wider BE) |
| **Range-Bound / No Movement** | Short Straddle, Short Strangle, Iron Condor | Iron Condor = defined risk; Straddle/Strangle = unlimited risk |
| **Synthetic Directional** | Synthetic Long | Replicates futures payoff |
| **Arbitrage** | Synthetic Long + Short Futures | Risk-free locked profit |

### By Volatility Regime

| Volatility Condition | Suitable Strategies | Logic |
|----------------------|---------------------|-------|
| **Low Vol, Expecting Rise** | Long Straddle, Long Strangle, Call/Put Ratio Back Spreads | Buy cheap premiums, benefit from vol expansion |
| **High Vol, Expecting Decline** | Short Straddle, Short Strangle, Iron Condor, Bull Put Spread, Bear Call Spread | Sell expensive premiums, benefit from vol crush |
| **High Vol at Entry** | Credit spreads (Bull Put, Bear Call) | Swelled premiums increase credit received |
| **Low Vol at Entry** | Debit spreads (Bull Call, Bear Put) | Cheaper entry costs |

### Risk-Reward Summary

| Strategy | Max Profit | Max Loss | Type |
|----------|-----------|----------|------|
| Bull Call Spread | Spread - Net Debit | Net Debit | Defined |
| Bull Put Spread | Net Credit | Spread - Net Credit | Defined |
| Bear Put Spread | Spread - Net Debit | Net Debit | Defined |
| Bear Call Spread | Net Credit | Spread - Net Credit | Defined |
| Call Ratio Back Spread | Unlimited (upside) | Spread - Net Credit | Semi-defined |
| Put Ratio Back Spread | Unlimited (downside) | Spread - Net Credit | Semi-defined |
| Bear Call Ladder | Unlimited (upside) | Spread - Net Credit | Semi-defined |
| Long Straddle | Unlimited (both) | Total Premium Paid | Defined loss |
| Short Straddle | Total Premium Collected | Unlimited (both) | Defined profit |
| Long Strangle | Unlimited (both) | Total Premium Paid | Defined loss |
| Short Strangle | Total Premium Collected | Unlimited (both) | Defined profit |
| Iron Condor | Net Premium | Spread - Net Premium | Fully defined |
| Synthetic Long | Unlimited (upside) | Unlimited (downside) | Undefined |

### Breakeven Formula Quick Reference

| Strategy | Breakeven Formula |
|----------|-------------------|
| Bull Call Spread | Lower Strike + Net Debit |
| Bull Put Spread | Higher Strike - Net Credit |
| Bear Put Spread | Higher Strike - Net Debit |
| Bear Call Spread | Lower Strike + Net Credit |
| Call Ratio Back Spread | Lower BE: Lower Strike + Net Credit; Upper BE: Higher Strike + Max Loss |
| Put Ratio Back Spread | Upper BE: Lower Strike + Max Loss; Lower BE: Lower Strike - Max Loss |
| Bear Call Ladder | Lower BE: Lower Strike + Net Credit; Upper BE: (OTM + ATM) - ITM - Net Credit |
| Long Straddle | Upper: Strike + Premium; Lower: Strike - Premium |
| Short Straddle | Upper: Strike + Premium; Lower: Strike - Premium |
| Long Strangle | Upper: CE Strike + Premium; Lower: PE Strike - Premium |
| Short Strangle | Upper: CE Strike + Premium; Lower: PE Strike - Premium |
| Iron Condor | Upper: Sold CE Strike + Net Credit; Lower: Sold PE Strike - Net Credit |

---

## Additional Strategy Notes (Referenced but not standalone chapters)

### Covered Call
- **Setup:** Long stock + Sell OTM Call
- **Outlook:** Neutral to mildly bullish
- **Max Profit:** (Strike - Stock Price) + Premium Received
- **Max Loss:** Stock Price - Premium Received (stock drops to zero)
- **Breakeven:** Stock Purchase Price - Premium Received
- **When to use:** Own shares, expect limited upside, want to generate income from holdings
- **Volatility:** Benefits from elevated IV (higher premium collected)

### Protective Put
- **Setup:** Long stock + Buy ATM/OTM Put
- **Outlook:** Bullish on stock but want downside protection (insurance)
- **Max Profit:** Unlimited (stock appreciates)
- **Max Loss:** (Stock Price - Put Strike) + Put Premium (capped at put strike level)
- **Breakeven:** Stock Price + Put Premium
- **When to use:** Own shares with unrealized gains, worried about near-term risk, want to hold through uncertainty
- **Volatility:** Cheaper when IV is low; expensive during high IV periods

### Iron Butterfly
- **Setup:** Sell ATM Call + Sell ATM Put + Buy OTM Call + Buy OTM Put
- **Outlook:** Very tight range-bound expectation; market expected to stay near current price
- **Max Profit:** Net Premium Collected
- **Max Loss:** Spread - Net Premium
- **Breakeven Upper:** ATM Strike + Net Premium
- **Breakeven Lower:** ATM Strike - Net Premium
- **Difference from Iron Condor:** Iron Butterfly sells ATM options (same strike for both sold legs) while Iron Condor sells OTM options (different strikes for sold legs). Iron Butterfly has higher max profit but narrower profit zone.

---

## Key Principles Across All Strategies

1. **Strike selection depends on time to expiry:** Use ATM strikes with ample time; shift to OTM/ITM combos as expiry approaches.

2. **Volatility regime matters:** Credit strategies benefit from high IV (sell expensive premiums); Debit strategies benefit from low IV (buy cheap premiums).

3. **Theta decay accelerates near expiry:** Short option positions benefit; long option positions suffer.

4. **Wider spreads = higher potential profit but higher breakeven:** Always trade off reward vs. probability.

5. **Delta neutrality:** Strategies with zero net delta (straddles, strangles at setup) have no directional bias but gain from movement magnitude.

6. **Execution sequence for multi-leg strategies:** Always establish long (protective) legs before short legs to manage margin requirements.

7. **Risk management:** For short strategies, set stop-loss on entire strategy, not individual legs.

8. **No holy grail:** "None of the strategies discussed here is a sure shot money making machine." Success depends on reading market conditions correctly and applying strategies with discipline.
