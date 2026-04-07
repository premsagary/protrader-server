# Module 4: Futures Trading - Zerodha Varsity

> Comprehensive reference for building automated trading systems. Covers all 13 chapters with formulas, margin calculations, pricing models, hedging strategies, and open interest interpretation rules.

---

## Table of Contents

1. [Chapter 1: Background - The Forwards Market](#chapter-1-background---the-forwards-market)
2. [Chapter 2: Introducing Futures Contract](#chapter-2-introducing-futures-contract)
3. [Chapter 3: The Futures Trade](#chapter-3-the-futures-trade)
4. [Chapter 4: Leverage & Payoff](#chapter-4-leverage--payoff)
5. [Chapter 5: Margin & Mark-to-Market (M2M)](#chapter-5-margin--mark-to-market-m2m)
6. [Chapter 6: Margin Calculator (Part 1)](#chapter-6-margin-calculator-part-1)
7. [Chapter 7: Margin Calculator (Part 2)](#chapter-7-margin-calculator-part-2)
8. [Chapter 8: Shorting in Futures](#chapter-8-shorting-in-futures)
9. [Chapter 9: Nifty Futures](#chapter-9-nifty-futures)
10. [Chapter 10: Futures Pricing](#chapter-10-futures-pricing)
11. [Chapter 11: Hedging with Futures](#chapter-11-hedging-with-futures)
12. [Chapter 12: Open Interest (OI)](#chapter-12-open-interest-oi)
13. [Chapter 13: Physical Settlement](#chapter-13-physical-settlement)
14. [Quick Reference: All Formulas](#quick-reference-all-formulas)
15. [Quick Reference: Trading Rules & Decision Framework](#quick-reference-trading-rules--decision-framework)

---

## Chapter 1: Background - The Forwards Market

### What Are Derivatives?

Derivatives are financial securities whose value is derived from an underlying asset -- stocks, bonds, commodities, or currencies. The forward contract is the simplest derivative form and serves as the foundation for understanding futures contracts.

### Forward Contract Definition

A forward contract is an agreement between two parties to exchange goods for cash at a specific price on a specific future date.

**Key Characteristics:**
- **OTC Trading**: Over-the-counter agreements executed without exchange involvement
- **Customizable Terms**: Parties negotiate price, quantity, quality, and delivery date
- **Binding Obligation**: Both parties must honor the agreement regardless of subsequent price movements

**Party Designations:**
- **Buyer of the Forward**: Agrees to purchase the asset in the future (benefits if price rises)
- **Seller of the Forward**: Agrees to deliver the asset in the future (benefits if price falls)

### Detailed Example: Gold Forward Contract

- **Agreement Date**: December 9, 2014
- **Quantity**: 15 kilograms of gold (999 purity)
- **Settlement Date**: March 9, 2015 (3 months)
- **Agreed Price**: Rs.2,450/gram
- **Total Contract Value**: Rs.3.675 crores (Rs.24,50,000/kg x 15)

#### Scenario 1: Price Rises to Rs.2,700/gram

| Party | Action | Financial Impact |
|-------|--------|------------------|
| Buyer (ABC Jewelers) | Buys at Rs.2,450/gram | Saves Rs.38 lakhs |
| Seller (XYZ Dealers) | Sells at Rs.2,450/gram | Loses Rs.38 lakhs |

Market value = Rs.4.05 crores; Contract price = Rs.3.67 crores; Difference = Rs.38 lakhs

#### Scenario 2: Price Falls to Rs.2,050/gram

| Party | Action | Financial Impact |
|-------|--------|------------------|
| Buyer (ABC Jewelers) | Must buy at Rs.2,450/gram | Loses Rs.59.5 lakhs |
| Seller (XYZ Dealers) | Sells at Rs.2,450/gram | Gains Rs.59.5 lakhs |

Market value = Rs.3.075 crores; Contract price = Rs.3.67 crores; Difference = Rs.59.5 lakhs

#### Scenario 3: Price Unchanged at Rs.2,450/gram

Neither party gains or loses.

### Settlement Methods

1. **Physical Settlement**: Buyer pays full price; seller delivers the actual asset.
2. **Cash Settlement**: No delivery occurs. Parties exchange only the cash differential.

### Four Major Risks of Forward Contracts

| Risk | Description |
|------|-------------|
| **Liquidity Risk** | Difficult to find a counterparty; cannot exit before expiry |
| **Default/Counterparty Risk** | Either party may refuse to honor the contract |
| **Regulatory Risk** | No regulatory authority oversight; mutual consent only |
| **Rigidity** | Cannot modify or foreclose agreements midstream |

### Why Futures Were Created

Futures contracts were designed specifically to solve forward contract limitations:
- Standardized terms reduce counterparty risk
- Exchange backing ensures performance
- Liquidity improves through standardization
- Regulatory oversight (SEBI in India) provides protection
- Early exit becomes possible through offsetting trades

---

## Chapter 2: Introducing Futures Contract

### Core Definition

A futures contract is a **standardized, exchange-traded** agreement to exchange an asset at a predetermined price on a future date. It improves upon forward contracts by eliminating liquidity risk, default risk, regulatory risk, and structural rigidity.

### Key Features of Futures Contracts

| Feature | Detail |
|---------|--------|
| **Standardization** | All contract parameters (lot size, expiry, tick size) are predetermined and non-negotiable |
| **Exchange-Traded** | Contracts trade on regulated exchanges (NSE, BSE for equities; MCX for commodities) |
| **Tradability** | Positions can be closed at any time before expiry via offsetting trades |
| **Regulation** | SEBI regulates the Indian futures market, eliminating counterparty default risk |
| **Time-Bound** | All contracts have specific expiry dates (last Thursday of the month) |
| **Price Mirroring** | Futures prices track underlying spot prices closely |
| **Cash/Physical Settlement** | Most index futures are cash-settled; stock futures require physical settlement post Oct 2019 |

### Essential Terminology

- **Lot Size**: Minimum standardized quantity for any futures transaction (varies by underlying)
- **Contract Value**: `Lot Size x Futures Price`
- **Margin Requirement**: Percentage of contract value deposited upfront as collateral
- **Spot Price**: Current market price of the underlying asset
- **Futures Price**: Price at which the futures contract trades (mirrors spot but differs due to cost of carry)

### Forwards vs. Futures Comparison

| Aspect | Forwards | Futures |
|--------|----------|---------|
| Trading Venue | Over-the-counter (OTC) | Exchange |
| Customization | Fully negotiable | Standardized |
| Counterparty Risk | High | Virtually none (exchange guarantee) |
| Regulation | Unregulated | SEBI-regulated |
| Transferability | Non-transferable | Freely tradable |
| Contract Timeframes | Single expiry | Multiple expiry options (current, mid, far month) |
| Settlement | Flexible | Standardized (cash or physical per rules) |

---

## Chapter 3: The Futures Trade

### Trading Mechanics - Step by Step

1. **Margin Validation**: System verifies sufficient account funds to cover required margin
2. **Counterparty Matching**: Exchange locates an opposing trader with contrasting price expectations
3. **Digital Signoff**: Both parties electronically agree to contract terms
4. **Margin Blocking**: Required margin amount is frozen in the trading account

### Contract Structure Example (TCS Futures)

| Parameter | Value |
|-----------|-------|
| Instrument Type | Stock Futures |
| Expiry | Last Thursday of the month (24th Dec 2014) |
| Futures Price | Rs.2,374.90/share |
| Lot Size | 125 shares |
| Contract Value | 125 x Rs.2,374.90 = Rs.2,96,862.50 |

### P&L Scenarios

**Scenario 1 - Price increases to Rs.2,450:**
- Profit per share = Rs.2,450 - Rs.2,374.90 = Rs.75.10
- Total profit = 75.10 x 125 = **Rs.9,387.50**

**Scenario 2 - Price decreases to Rs.2,300:**
- Loss per share = Rs.2,374.90 - Rs.2,300 = Rs.74.90
- Total loss = 74.90 x 125 = **Rs.9,362.50**

### P&L Formula

```
P&L = (Exit Price - Entry Price) x Lot Size     [for LONG positions]
P&L = (Entry Price - Exit Price) x Lot Size     [for SHORT positions]
```

### Square Off (Closing Positions)

"Square off" means closing an open position by executing the opposite transaction.

| Initial Position | Square Off Action | When |
|---|---|---|
| Buy/Long (Bullish) | Sell | No longer bullish or want to exit |
| Sell/Short (Bearish) | Buy | No longer bearish or want to exit |

**Square Off Process:**
1. System locates a counterparty willing to assume your position
2. Executes transfer at current market futures price
3. Offsets the position immediately
4. Unblocks the initially frozen margin
5. Credits/debits profit/loss to trading account same day

### Key Principles

- **No holding requirement**: You can exit seconds after entering
- **Same-day settlement**: P&L credited/debited the same evening
- **Zero-sum nature**: Every rupee gained by one party is lost by the counterparty
- **Margin blocked throughout**: Margins remain frozen for the entire holding period
- **Tradability**: Contracts can be transferred between parties at any point before expiry

---

## Chapter 4: Leverage & Payoff

### What Is Leverage?

Leverage enables traders to control large asset positions with minimal capital. By depositing only a fraction (margin) of the total contract value, you gain full exposure to price movements of the entire contract.

### Spot Market vs. Futures Market Comparison

| Parameter | Spot Market | Futures Market |
|-----------|-------------|----------------|
| Capital Required | Full purchase price | Margin only (e.g., 14%) |
| Shares with Rs.1,00,000 | 42 shares @ Rs.2,362 | 250 shares (2 lots x 125) |
| Contract Value Controlled | Rs.99,204 | Rs.5,90,500 |
| Margin Required | N/A | Rs.82,670 (2 lots) |
| Profit (5.79% move) | Rs.5,746 | Rs.39,250 |
| Return on Capital | 5.79% | **47%** |
| Annualized Return | ~235% | **~1,925%** |

### Leverage Formula

```
Leverage = Contract Value / Margin Deposit
```

**Example (TCS):**
- Contract Value = Rs.2,95,250
- Margin = Rs.41,335 (14%)
- Leverage = 2,95,250 / 41,335 = **7.14x**
- Interpretation: Every Rs.1 deposited controls Rs.7.14 of exposure

### Critical Risk Formula

```
Percentage Fall to Wipe Out Margin = 1 / Leverage
```

| Leverage | % Move to Lose All Margin |
|----------|--------------------------|
| 7.14x | 14.0% |
| 10x | 10.0% |
| 20x | 5.0% |
| 42.17x | 2.3% |

### Futures Payoff Structure

For a **Long Position** at entry price P:
- Any price above P = Profit
- Any price below P = Loss
- Relationship is **linear** (straight-line payoff)
- P&L per point = Lot Size x Rs.1

For a **Short Position** at entry price P:
- Any price below P = Profit
- Any price above P = Loss
- Relationship is **linear** (mirror image of long)

### Zero-Sum Game

Futures are a wealth-transfer mechanism, not a wealth-creation mechanism. The profits made by the buyer exactly equal the losses made by the seller and vice versa. This is fundamentally different from equity investing where business growth creates new wealth.

### Key Leverage Rules

1. Leverage amplifies **both** gains and losses proportionally
2. Higher leverage = higher risk AND higher return potential
3. Post-SEBI regulations, leverage is typically restricted to approximately 5x
4. Prudent risk management suggests not exceeding 10-12x leverage
5. P&L is directly proportional to contract size and price movement magnitude

---

## Chapter 5: Margin & Mark-to-Market (M2M)

### Margin Components

```
Initial Margin (IM) = SPAN Margin + Exposure Margin
```

| Component | Description |
|-----------|-------------|
| **SPAN Margin** | Exchange-mandated minimum margin (also called Maintenance Margin). Calculated via SPAN (Standard Portfolio Analysis of Risk) methodology based on market volatility. |
| **Exposure Margin** | Additional broker-required cushion (typically 4-5% of contract value) to protect against sudden price movements. |

### Mark-to-Market (M2M) Mechanism

M2M is a **daily** accounting adjustment where profits/losses are credited or debited based on price movements, using the **previous day's closing price** as the reference point.

**Core M2M Rules:**
- Executed daily while position remains open
- Previous closing price serves as reference point
- Profit/loss settled immediately to trading account
- Reference price resets each trading day
- On the final day (square-off or expiry), actual trade price replaces closing price

### M2M Example: Hindalco Futures (Lot Size = 2,000)

| Day | Reference Price | Close/Exit Price | Daily M2M | Cumulative |
|-----|----------------|-----------------|-----------|------------|
| Day 1 (Buy) | Rs.165.00 (entry) | Rs.168.30 | +Rs.6,600 | +Rs.6,600 |
| Day 2 | Rs.168.30 | Rs.172.40 | +Rs.8,200 | +Rs.14,800 |
| Day 3 | Rs.172.40 | Rs.171.60 | -Rs.1,600 | +Rs.13,200 |
| Day 4 (Exit) | Rs.171.60 | Rs.170.10 | -Rs.3,000 | +Rs.10,200 |

**Verification**: (170.10 - 165.00) x 2,000 = Rs.10,200 (matches cumulative M2M)

### HDFC Bank Futures Example

| Detail | Value |
|--------|-------|
| Buy Price | Rs.938.70 |
| Lot Size | 250 |
| Contract Value | Rs.2,34,675 |
| SPAN Margin (7.5%) | Rs.17,600 |
| Exposure Margin (5%) | Rs.11,733 |
| Total Initial Margin | Rs.29,334 |

### Margin Call Mechanics

A **Margin Call** occurs when cash balance falls below SPAN Margin requirements.

**Warning Levels:**
1. Cash balance below Exposure Margin = **risky zone** (warning)
2. Cash balance below SPAN Margin = **margin call triggered** (must add funds)
3. Failure to add funds = **broker force-closes positions** without notice

### Four Equivalent P&L Calculation Methods

All yield identical results:

1. **Sum of daily M2M**: Add all daily M2M adjustments
2. **Cash differential**: Final cash released - Initial margin blocked
3. **Contract value differential**: Final contract value - Initial contract value
4. **Direct calculation**: `(Exit Price - Entry Price) x Lot Size`

### Why M2M Exists

M2M prevents counterparty default by:
- Reducing daily settlement risk through incremental adjustments
- Ensuring sufficient funds via continuous margin monitoring
- Creating exchange guarantee through daily obligation settlement
- Making defaults virtually impossible in regulated markets

---

## Chapter 6: Margin Calculator (Part 1) - SPAN, Exposure, Rollovers & Calendar Spreads

### Using the Margin Calculator

Required inputs:
1. **Exchange**: NFO (NSE Futures & Options), MCX (Commodities), CDS (Currency Derivatives)
2. **Product Type**: Futures or Options
3. **Specific Contract**: Select symbol from available list
4. **Quantity**: Number of shares (must be a multiple of lot size)

### Contract Expiry Structure

At any given time, NSE maintains **three simultaneous contracts**:

| Contract | Description | Example |
|----------|-------------|---------|
| **Near Month / Current Month** | Expires soonest | January 29 |
| **Mid Month** | Intermediate expiry | February 26 |
| **Far Month** | Latest expiry | March 26 |

**Pricing Rule**: Current month futures price < Mid-month price < Far-month price (under normal conditions). This reflects the cost of carry increasing with time to expiry.

### Rollover

Rolling over means closing an expiring contract and simultaneously opening an identical position in the next month's contract to extend the holding period beyond the original expiry.

**Process:**
1. Square off (close) the expiring month contract
2. Initiate the same directional position in the next month contract
3. No special mechanism needed -- just two regular trades

### Calendar Spreads

A calendar spread involves **simultaneously buying one expiry and selling another expiry** of the same underlying.

**Example: Bharat Forge**
- Buy January futures @ Rs.1,023
- Sell February futures @ Rs.1,033

**Risk Reduction:**
- If price drops 10 points: January loses Rs.2,500 but February gains Rs.2,500 = Net Rs.0
- Directional risk is nearly eliminated

**Margin Benefit:**

| Position | Individual Margin | Spread Margin |
|----------|------------------|---------------|
| January Long | Rs.37,362 | -- |
| February Short | Rs.37,629 | -- |
| Combined Spread | -- | **Rs.7,213** |

The spread margin (Rs.7,213) is dramatically lower than the sum of individual margins (~Rs.75,000) because the exchange recognizes the hedged nature of the position.

### IDEA Cellular Example

| Component | Value |
|-----------|-------|
| SPAN Margin | Rs.22,160 |
| Exposure Margin | Rs.14,730 |
| Total Initial Margin | Rs.36,890 |
| Lot Size | 2,000 shares |

For 3 lots: Enter quantity as 6,000 shares (3 x 2,000) in the calculator.

### Margin Dynamics

Margins are **not static**. They change based on:
- Underlying asset volatility (higher vol = higher SPAN)
- Time to expiry (margins may increase as expiry approaches)
- Position structure (hedged positions receive margin reductions)
- Exchange recalculation cycles (multiple times per day)

---

## Chapter 7: Margin Calculator (Part 2) - Product Types, MIS, Cover Orders & Bracket Orders

### Core Principle

**The more information you convey to the Risk Management System (RMS) about trade duration and stoploss, the lower the margin requirement.**

### Product Types and Margin Hierarchy

```
NRML (highest margin) > MIS > CO/BO (lowest margin)
```

| Product | Duration | Stoploss | Margin Level | Use Case |
|---------|----------|----------|-------------|----------|
| **NRML** | Multi-day / till expiry | Not required | Full (SPAN + Exposure) | Positional trades |
| **MIS** | Intraday only (auto square-off at 3:20 PM) | Not required | Reduced (~40% of NRML) | Intraday without SL |
| **CO** (Cover Order) | Intraday only | **Mandatory** at order entry | Significantly reduced | Intraday with SL |
| **BO** (Bracket Order) | Intraday only (square-off by 3:20 PM) | **Mandatory** + Target price | Same as CO | Intraday with SL + target |

### Why Information Reduces Margins

| Information Provided | Risk Reduced | Margin Impact |
|---------------------|-------------|---------------|
| Intraday duration | Eliminates overnight risk | Lower margin |
| Stoploss level | Caps maximum loss | Lower margin |
| Target price | Identifies exit point | No additional margin reduction (risk already capped by SL) |

### Practical Capital Calculations

**Task 1: Rs.80,000 capital**
- Buy ACC Cement futures (hold 3 days): NRML margin = Rs.48,686
- Trade Infosys futures intraday: MIS margin = Rs.27,079
- Total needed = Rs.75,765 (feasible within Rs.80,000)

**Task 2: Rs.1,20,000 capital for Wipro futures**
- NRML: Rs.36,806/lot = 3 lots maximum
- MIS: Rs.14,722/lot = 8 lots maximum

### Trailing Stoploss Technique

A method of progressively adjusting the stoploss in the direction of the trade to lock in profits.

**Example:**
1. Entry: Rs.2,175
2. Initial SL: Rs.2,150 (Rs.25 risk)
3. Target: Rs.2,220 (Rs.45 reward)
4. Price reaches Rs.2,190 (+15 pts): Move SL to Rs.2,175 (breakeven)
5. Price reaches Rs.2,205 (+30 pts): Move SL to Rs.2,190 (locks Rs.15 profit)
6. Continue adjusting based on market conditions

**Key Rule**: No fixed rules govern trailing increments; adjust based on volatility and strategy.

### Margin Calculator Sections

| Section | Coverage |
|---------|----------|
| **Equity Futures** | NRML and MIS margins for ~475 contracts |
| **BO & CO Calculator** | Requires stoploss selection; shows resulting margin |
| **Commodity Margins** | MCX-traded instruments |
| **Currency Margins** | CDS-traded pairs |

---

## Chapter 8: Shorting in Futures

### Core Concept

Shorting reverses traditional trading order: **sell first, buy later**. You profit when prices decline.

```
Short P&L = (Entry/Sell Price - Exit/Buy Price) x Lot Size
```

### Spot Market vs. Futures Market Shorting

| Aspect | Spot Market | Futures Market |
|--------|-------------|----------------|
| Overnight carry | **NOT allowed** (intraday only) | **Allowed** (until expiry) |
| Penalty for overnight | ~20% above short price ("short delivery") | None |
| Margin requirement | N/A (must have shares) | Same as long positions |
| Settlement | T+2 delivery obligation | Daily M2M |

### Why Spot Shorting Is Intraday Only

The exchange cannot differentiate between a regular sale (seller owns shares) and a short sale (seller borrows/doesn't own shares). Holding a short overnight without owning shares triggers a "short delivery" penalty.

### M2M for Short Positions

M2M applies identically to short and long positions. The reference direction is simply reversed.

**Example: Short HCL @ Rs.1,990, Lot Size = 125**

| Day | Close | Daily M2M |
|-----|-------|-----------|
| Day 1 | Rs.1,982 | +Rs.1,000 (price fell, short profits) |
| Day 2 | Rs.1,975 | +Rs.875 |

### Risk Management for Shorts

**Stoploss placement**: Always place stoplosses **ABOVE** the short entry price since losses occur when prices rise.

Example: Short at Rs.1,990 with stoploss at Rs.2,000.

### Key Rules for Shorting

1. Shorting requires reverse transaction order (sell then buy)
2. Profits materialize only when closing price < entry price
3. Losses accumulate when prices rise above entry
4. **Spot market shorts: INTRADAY MANDATORY**
5. **Futures shorts: overnight carry allowed**
6. Identical margins for both long and short positions
7. M2M mechanics are identical for both directions

---

## Chapter 9: Nifty Futures

### Why Nifty Futures Are Special

Nifty Futures is the **most widely traded futures instrument** in India, offering exceptional liquidity. The contract derives its value from the Nifty 50 Index.

### Contract Specifications

| Parameter | Value |
|-----------|-------|
| Underlying | Nifty 50 Index |
| Lot Size | 50 units (current; historically 75) |
| Expiry | Last Thursday of each month |
| Available Contracts | Current, Mid, and Far month |
| Settlement | Cash-settled (index futures cannot be physically delivered) |
| Contract Value | Futures Price x Lot Size |

**Example**: Nifty futures @ 11,484.90 x 75 lot = Rs.8,61,367

**Typical Margins:**
- NRML: ~Rs.68,810
- MIS: ~Rs.24,083
- BO/CO: ~Rs.12,902

### Impact Cost Formula

Impact cost measures the true cost of executing a trade, accounting for order book depth.

```
Ideal Price = (Best Buy Price + Best Sell Price) / 2

Actual Buy Price = Sum(Quantity_i x Price_i) / Total Quantity

Impact Cost (%) = ((Actual Buy Price - Ideal Price) / Ideal Price) x 100
```

**Example (Infosys, 350-share purchase):**
- Best Buy = Rs.1,657.95, Best Sell = Rs.1,658.00
- Ideal Price = (1,657.95 + 1,658.00) / 2 = Rs.1,657.98
- Actual execution: (15 x 1,658 + 335 x 1,658.20) / 350 = Rs.1,658.19
- Impact Cost = ((1,658.19 - 1,657.98) / 1,657.98) x 100 = **0.012%**

**Nifty Impact Cost**: ~0.0082% (extremely liquid)

### Seven Strategic Advantages of Trading Nifty

| # | Advantage | Detail |
|---|-----------|--------|
| 1 | **Diversification** | 50 stocks across major sectors; single adverse event has minimal impact |
| 2 | **Manipulation Resistance** | Collective movement of 50 companies is virtually impossible to manipulate |
| 3 | **Superior Liquidity** | Near-zero impact cost; easy entry/exit at any size |
| 4 | **Lower Margins** | 12-15% vs. 45-60% for individual stock futures |
| 5 | **Macro Analysis** | Requires broad economic perspective, not company-specific research |
| 6 | **Technical Analysis Effectiveness** | High liquidity prevents manipulation, allowing pure supply-demand dynamics |
| 7 | **Reduced Volatility** | ~16-17% annualized vs. 30%+ for individual stocks |

### Risk Profile

| Risk Type | Nifty Exposure | Stock Exposure |
|-----------|---------------|----------------|
| **Systematic Risk** (market-wide) | YES | YES |
| **Unsystematic Risk** (company-specific) | NO (diversified away) | YES |

Trading Nifty eliminates unsystematic risk while maintaining systematic risk exposure.

---

## Chapter 10: Futures Pricing

### The Futures Pricing Formula (Cost of Carry Model)

```
Futures Price = Spot Price x [1 + rf x (x/365)] - d
```

Where:
- **Spot Price** = Current market price of the underlying
- **rf** = Risk-free rate (annualized; typically use 91-day T-Bill rate or RBI repo rate)
- **x** = Number of days to contract expiry
- **d** = Dividend expected on the underlying before expiry (0 for index futures)

This formula reflects **Spot-Future Parity** -- the theoretical relationship between spot and futures prices.

### Key Pricing Concepts

| Term | Definition |
|------|-----------|
| **Basis / Spread** | Futures Price - Spot Price |
| **Fair Value** | Theoretical futures price from the formula |
| **Market Price** | Actual trading price (may deviate from fair value) |
| **Premium (Contango)** | Futures > Spot (natural state with positive interest rates) |
| **Discount (Backwardation)** | Futures < Spot (demand-supply imbalance) |

### Convergence Principle

```
As expiry approaches: Futures Price --> Spot Price
On expiry day: Futures Price = Spot Price (ALWAYS)
```

The spread is widest at the start of a contract series (maximum time value) and systematically narrows to zero at expiry.

### Practical Calculation Example

**Infosys (7 days to expiry):**
- Spot Price = Rs.2,280.50
- Risk-free rate = 8.3528%
- Days to expiry = 7

```
Fair Value = 2,280.50 x [1 + 0.083528 x (7/365)]
           = 2,280.50 x [1 + 0.001602]
           = 2,280.50 x 1.001602
           = Rs.2,283.15 (approx Rs.2,283)
```

Actual market price observed: Rs.2,284 (Rs.1 difference due to market friction costs)

### Arbitrage Strategies

#### Cash & Carry Arbitrage

Triggered when futures trade **significantly above** fair value.

**Execution:**
1. Buy underlying in spot market
2. Simultaneously sell futures contract
3. Hold until expiry (convergence guaranteed)
4. Profit = Futures Price - Spot Price - Transaction Costs

**Profit is locked in** regardless of final price direction, as both positions converge at expiry.

#### Calendar Spread Arbitrage

**Execution:**
1. Identify which contract month is relatively overpriced
2. Sell the expensive contract (usually near-term trading above fair value)
3. Buy the relatively cheap contract (usually mid-term near fair value)
4. Capture the spread as near-term expires

### Premium vs. Discount Interpretation

| Condition | Signal |
|-----------|--------|
| Futures at Premium (Contango) | Normal state; cost of carry positive |
| Futures at Discount (Backwardation) | Unusual; signals strong selling pressure or expected dividend |
| Premium expanding | Increasing bullish sentiment |
| Premium shrinking | Decreasing bullish sentiment or approaching expiry |
| Discount expanding | Increasing bearish sentiment |

---

## Chapter 11: Hedging with Futures

### What Is Hedging?

Hedging is a technique to ensure your market position is not adversely affected by unfavorable price movements. It creates market neutrality by establishing a counter-position in derivatives.

### Why Hedge?

1. **Mathematical asymmetry**: A 25% decline requires a 33.33% gain to recover
2. **Avoids market timing**: Eliminates transaction costs and tax complications of selling/repurchasing
3. **Insulates positions**: Creates market neutrality regardless of price direction

### Risk Classification

| Risk Type | Description | Mitigation |
|-----------|-------------|------------|
| **Systematic Risk** | Market-wide: GDP, interest rates, inflation, geopolitics | **Hedging** with index futures |
| **Unsystematic Risk** | Company-specific: revenue decline, management issues | **Diversification** (21+ stocks optimal) |

**Key distinction**: Diversification and hedging are **separate strategies**, not substitutes.

### Single Stock Hedge

For a long spot position, create a counter-position in futures:
- Long 250 Infosys shares @ Rs.2,284 (spot)
- Short Infosys Futures @ Rs.2,285
- Result: Net-neutral regardless of price movement

### Beta (b) - The Sensitivity Measure

Beta quantifies a stock's price sensitivity relative to market movements.

```
Beta Interpretation:
  b = 1.0  : Moves exactly with market
  b > 1.0  : More volatile than market (aggressive)
  b < 1.0  : Less volatile than market (defensive)
  b <= 0   : Inverse market correlation
```

**Calculation**: Use Excel's `=SLOPE()` function comparing daily returns of target stock against Nifty index returns over a 6-month period.

**Example**: If Nifty drops 1% and a stock with b=1.3 is expected to drop 1.3%.

### Portfolio Hedging Process (Step-by-Step)

#### Step 1: Calculate Portfolio Beta

```
Portfolio Beta = SUM(Stock_Beta_i x (Stock_Investment_i / Total_Portfolio_Value))
```

Example:

| Stock | Investment | Beta | Weight | Weighted Beta |
|-------|-----------|------|--------|--------------|
| Stock A | Rs.2,00,000 | 0.80 | 25.0% | 0.200 |
| Stock B | Rs.1,50,000 | 1.20 | 18.75% | 0.225 |
| Stock C | Rs.3,00,000 | 1.50 | 37.5% | 0.563 |
| Stock D | Rs.1,50,000 | 1.10 | 18.75% | 0.206 |
| **Total** | **Rs.8,00,000** | -- | -- | **1.223** |

#### Step 2: Calculate Hedge Value

```
Hedge Value = Portfolio Beta x Total Portfolio Value
```

Hedge Value = 1.223 x Rs.8,00,000 = **Rs.9,78,400**

#### Step 3: Calculate Number of Futures Lots Required

```
Number of Lots = Hedge Value / (Nifty Futures Price x Lot Size)
```

Number of Lots = 9,78,400 / (9,025 x 25) = 9,78,400 / 2,25,625 = **4.33 lots**

(Round to 4 for under-hedge or 5 for over-hedge)

#### Step 4: Execute the Hedge

**Short** 4.33 lots of Nifty Futures (round as appropriate).

### Hedge Verification Example

If Nifty drops 500 points (5.5%):

| Component | Calculation | Impact |
|-----------|------------|--------|
| Short Futures Gain | 4.33 x 25 x 500 | +Rs.54,125 |
| Portfolio Loss | 6.78% x Rs.8,00,000 | -Rs.54,240 |
| **Net Result** | | **~Rs.0** (fully hedged) |

(Portfolio drops 6.78% because Portfolio Beta 1.223 x 5.5% market drop = 6.78%)

### Master Hedge Formula

```
Hedge Ratio = (Portfolio Beta x Portfolio Value) / (Index Futures Price x Lot Size)
```

### Perfect vs. Imperfect Hedges

| Type | Description |
|------|-------------|
| **Under-hedge** | Fewer lots than required; partial protection |
| **Over-hedge** | More lots than required; excess protection exposure |
| **Perfect hedge** | Exact correspondence (rare due to fractional lots) |

### Hedging Limitations

- Stocks without futures contracts can only be hedged via portfolio-level Nifty futures
- Small positions (< 1 contract value) cannot be hedged with futures alone
- Hedging creates zero P&L: protects against losses BUT also prevents gains
- Benefits emerge **only if** anticipated adverse movements actually occur

---

## Chapter 12: Open Interest (OI)

### Definition

Open Interest (OI) is the total number of futures (or options) contracts currently outstanding (open) in the market. Every trade involves two parties -- one buyer (long) and one seller (short) -- creating one contract.

### OI Change Rules

| Event | OI Impact |
|-------|-----------|
| New buyer + New seller = New contract created | **OI Increases** |
| Existing buyer closes + Existing seller closes = Contract destroyed | **OI Decreases** |
| Existing holder transfers to new holder = Position transfer | **OI Unchanged** |

### Practical Example (5-Day Walkthrough)

| Day | Event | OI Change | Running OI |
|-----|-------|-----------|------------|
| Monday | 10 new contracts created | +10 | 10 |
| Tuesday | 8 contracts transferred between sellers | 0 | 10 |
| Wednesday | 5 new contracts + some closures | +5 | 15 |
| Thursday | 15 new contracts added | +15 | 30 |
| Friday | 20 contracts squared off | -20 | 10 |

### OI vs. Volume

| Aspect | Open Interest | Volume |
|--------|--------------|--------|
| **Nature** | Cumulative (carries forward) | Daily (resets to zero each day) |
| **What it measures** | Open/outstanding contracts | Total trades executed |
| **Direction** | Can increase or decrease | Always increases during the day |
| **Counting** | 1 buy + 1 sell = 1 OI | 1 buy + 1 sell = 1 volume |

### Volume-Price Interpretation Framework

| Price | Volume | Interpretation | Signal |
|-------|--------|---------------|--------|
| Increasing | Increasing | Strong buying interest | **Bullish** |
| Decreasing | Decreasing | Selling pressure weakening | **Bearish trend may reverse** |
| Decreasing | Increasing | Strong selling interest | **Bearish continuation** |
| Increasing | Decreasing | Buying interest weakening | **Bullish trend may reverse** |

### OI-Price Interpretation Framework (CRITICAL FOR TRADING SYSTEMS)

| Price | OI | Interpretation | Signal |
|-------|-----|---------------|--------|
| Increasing | Increasing | Fresh long positions entering (Long Build-up) | **Bullish** |
| Decreasing | Decreasing | Long positions exiting / unwinding (Long Unwinding) | **Bearish weakening** |
| Decreasing | Increasing | Fresh short positions building (Short Build-up) | **Bearish** |
| Increasing | Decreasing | Short positions covering / exiting (Short Covering) | **Bullish weakening** |

### Combined Price + Volume + OI Framework

| Price | Volume | OI | Market Condition |
|-------|--------|-----|-----------------|
| Up | Up | Up | Strong bullish (new longs entering with conviction) |
| Up | Up | Down | Short covering rally (not sustainable) |
| Up | Down | Up | Cautious bullish (weak participation) |
| Up | Down | Down | Weak rally (likely to reverse) |
| Down | Up | Up | Strong bearish (new shorts entering with conviction) |
| Down | Up | Down | Long unwinding (not panic; existing longs exiting) |
| Down | Down | Up | Cautious bearish (weak participation) |
| Down | Down | Down | Weak decline (likely to reverse) |

### Critical Warning Signal

**If there is abnormally high OI backed by rapid price increase or decrease, exercise extreme caution.** This signals excessive euphoria and leverage buildup in the market, which often precedes sharp reversals.

### OI as Liquidity Indicator

Higher OI = Greater market liquidity = Better bid-ask spreads = Lower impact costs for entry/exit.

---

## Chapter 13: Physical Settlement of F&O Contracts

### Background

SEBI mandated physical settlement of all stock F&O contracts starting **October 2019** to curb excessive speculation and artificial price suppression.

### What Is Physical Settlement?

All stock futures and options contracts held at expiry require **physical delivery** of the underlying shares. You must either take delivery (buy shares) or give delivery (deliver shares) of the actual underlying.

### Why Physical Settlement Was Introduced

Under cash settlement, traders could hold excessive short positions using minimal margin, artificially suppressing stock prices. Physical settlement forces traders to either purchase shares or use SLB (Securities Lending & Borrowing) to deliver.

### Settlement Obligations at Expiry

#### Must TAKE Delivery (Receive Shares):
- **Long Futures** (you bought futures, must accept shares)
- **Long ITM Call Options** (you bought calls that are in-the-money)
- **Short ITM Put Options** (you sold puts that are in-the-money)

#### Must GIVE Delivery (Deliver Shares):
- **Short Futures** (you sold futures, must deliver shares)
- **Short ITM Call Options** (you sold calls that are in-the-money)
- **Long ITM Put Options** (you bought puts that are in-the-money)

**Important**: Only ITM (In-The-Money) options are physically settled. OTM (Out-of-The-Money) options expire worthlessly without delivery obligations.

### Index Futures Exception

**Index futures (Nifty, Bank Nifty, etc.) remain CASH-SETTLED** because you cannot physically deliver an index. Only individual stock derivatives require physical settlement.

### Netting Off Positions

Offsetting positions of the same underlying and same expiration date can be netted. Example: Holding both long futures and short ITM put on the same stock can offset delivery obligations.

### Margin Impact of Physical Settlement

| Period | Margin Required |
|--------|----------------|
| Normal trading | SPAN + Exposure margin |
| Approaching expiry (last few days) | Progressively increases |
| At expiry (physical settlement) | **100% of contract value** (full delivery margin) |

### Practical Implications for Trading Systems

1. **Auto-square-off**: Most brokers auto-close positions before expiry if the account cannot support physical delivery margins
2. **Capital planning**: Traders must plan for 100% margin requirement if holding through expiry
3. **SLB mechanism**: Short sellers must arrange share borrowing for delivery
4. **STT implications**: Physical delivery attracts different STT rates than cash settlement

---

## Quick Reference: All Formulas

### Core Trading Formulas

```
Contract Value = Lot Size x Futures Price

P&L (Long)  = (Exit Price - Entry Price) x Lot Size
P&L (Short) = (Entry Price - Exit Price) x Lot Size

Leverage = Contract Value / Margin Deposited

% Move to Wipe Out Margin = 1 / Leverage (or = Margin% of Contract Value)
```

### Margin Formulas

```
Initial Margin = SPAN Margin + Exposure Margin

Margin Hierarchy: NRML > MIS > CO/BO
```

### Futures Pricing Formula (Cost of Carry Model)

```
Futures Price = Spot Price x [1 + rf x (x/365)] - d

Where:
  rf = Risk-free rate (annualized)
  x  = Days to expiry
  d  = Expected dividend before expiry

Basis = Futures Price - Spot Price
```

### Convergence

```
On Expiry: Futures Price = Spot Price (ALWAYS)
```

### Impact Cost Formula

```
Ideal Price = (Best Buy + Best Sell) / 2
Actual Buy Price = SUM(Qty_i x Price_i) / Total Qty
Impact Cost (%) = ((Actual Buy - Ideal Price) / Ideal Price) x 100
```

### Hedging Formulas

```
Portfolio Beta = SUM(Beta_i x Weight_i)
  where Weight_i = Investment_i / Total Portfolio Value

Hedge Value = Portfolio Beta x Total Portfolio Value

Number of Lots = Hedge Value / (Nifty Futures Price x Lot Size)

Expected Portfolio Loss = Portfolio Beta x Market Decline (%) x Portfolio Value
```

### M2M (Mark-to-Market)

```
Daily M2M = (Today's Close - Reference Price) x Lot Size
  where Reference Price = Previous day's close (or entry price on Day 1)

Total P&L = Sum of all daily M2M adjustments
```

---

## Quick Reference: Trading Rules & Decision Framework

### Position Entry Rules

| Market View | Action | Product Type | Margin |
|-------------|--------|-------------|--------|
| Bullish (price will rise) | Buy Futures (go Long) | NRML/MIS/CO/BO | Depends on product |
| Bearish (price will fall) | Sell Futures (go Short) | NRML/MIS/CO/BO | Same as long |
| Neutral (hedge existing) | Short Nifty Futures against portfolio | NRML | Full SPAN+Exposure |

### OI-Based Trading Signals

| Signal | Price | OI | Action |
|--------|-------|-----|--------|
| Long Build-up | Rising | Rising | Bullish -- Consider buying |
| Short Build-up | Falling | Rising | Bearish -- Consider shorting |
| Long Unwinding | Falling | Falling | Longs exiting -- Trend weakening |
| Short Covering | Rising | Falling | Shorts exiting -- Rally may not sustain |
| High OI + Sharp Move | Either | Very High | **DANGER** -- Excessive leverage, reversal likely |

### Margin Management Rules

1. Never let cash balance fall below SPAN margin
2. Maintain buffer above Exposure margin for safety
3. Account for daily M2M debits when sizing positions
4. Plan for 100% margin if holding stock futures through expiry (physical settlement)
5. Use MIS/CO/BO for intraday to optimize capital utilization

### Expiry-Related Rules

1. Futures and spot prices **always converge** on expiry day
2. Near-month contracts have highest liquidity
3. Rollover to next month before expiry if continuing position
4. Physical settlement applies to all stock F&O at expiry (not index)
5. OTM options expire worthless; only ITM options require settlement

### Arbitrage Conditions

| Condition | Strategy |
|-----------|----------|
| Futures >> Fair Value | Cash & Carry: Buy spot + Sell futures |
| Near-month >> Mid-month (relative to fair value) | Calendar Spread: Sell near + Buy mid |
| Futures at unusual discount | Reverse Cash & Carry: Sell spot + Buy futures |

### Risk Management Rules

1. Leverage of 10-12x maximum recommended
2. Always use stoplosses (above entry for shorts, below entry for longs)
3. Trailing stoplosses to lock in profits during momentum trades
4. Monitor OI for signs of excessive leverage buildup
5. Hedging eliminates gains AND losses -- use only when protection is specifically needed
6. Diversification across 21+ stocks optimally reduces unsystematic risk
