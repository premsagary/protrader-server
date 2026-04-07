# Module 8: Currency, Commodity, and Government Securities

---

## Chapter 1: Currency Basics

### Historical Evolution of Currency Systems
1. **Barter Era** - Direct goods exchange (divisibility and scalability issues)
2. **Goods for Metal Era** - Gold/silver as standard denominator
3. **Gold Standard Era** - Late 19th century; currencies valued against gold reserves
4. **Modern Market-Driven Era** - Post-Bretton Woods; market determines currency values based on economic/political conditions

### Currency Market Overview
- International daily trading volume: ~$5.4-6 trillion
- Markets operate 24 hours, 6 days weekly across global time zones
- Most active when US, UK, Japanese, and Australian markets overlap
- Key participants: Central banks, corporations, banks, travelers, traders

### Currency Pair Mechanics
**Standard Format: Base Currency / Quotation Currency = Value**
- **Base Currency**: Always fixed at 1 unit
- **Quotation Currency**: Equivalent value in another currency
- Example: USD/INR = 67 means 1 USD = 67 INR

### Major Traded Pairs

| Pair | Typical Value |
|------|---------------|
| EUR/USD | ~1.11 |
| USD/JPY | ~108.94 |
| GBP/USD | ~1.44 |
| AUD/USD | ~0.72 |
| USD/CAD | ~1.31 |
| USD/CHF | ~0.99 |

### India-Specific Trading
- **Available pairs on NSE**: USD-INR, GBP-INR, EUR-INR, JPY-INR
- **Cross-currency pairs**: EUR-USD, GBP-USD (limited retail access)
- **Trading Hours**: 9:15 AM to 5:00 PM IST

---

## Chapter 2: Reference Rates and Impact of Events

### Dual View Concept
Trading a currency pair means simultaneously holding opposing positions. Buying USD/INR = bullish on USD, bearish on INR.

### Currency Strength Definitions
- **Base strengthens**: Can purchase more quotation units (USD/INR: 67 -> 68)
- **Base weakens**: Buys fewer quotation units (USD/INR: 66 -> 65)

### Two-Way Quotes (Bid-Ask Spreads)
- Example: EUR/USD 1.1269/70 (bid fully stated; ask shows final digits only)
- **Pip**: Smallest price movement unit

### RBI Reference Rate Mechanism
RBI polls randomly-selected contributing banks (11:30 AM - 12:30 PM daily) for two-way USD/INR quotes. The average becomes the official reference rate (excludes weekends/holidays).

### Cross-Rate Derivation (Crossing Technique)
- USD/INR = 67.0740 (ask)
- EUR/USD = 1.1140 (ask)
- **EUR/INR = 67.0740 x 1.1140 = 74.72 INR**

### Events Impacting Currency Pairs

| Event | Effect |
|-------|--------|
| **Increased imports** | Require USD purchase -> weakens domestic currency |
| **Increased exports** | Generate USD inflows -> strengthens domestic currency |
| **Narrowing trade deficit** | Strengthens domestic currency |
| **Widening trade deficit** | Weakens domestic currency |
| **Higher interest rates** | Attract foreign investment -> strengthens currency |
| **Dovish central bank** | Signals rate decreases -> weakens currency |
| **Hawkish central bank** | Signals rate increases -> strengthens currency |
| **High inflation** | Prompts hawkish response -> eventually strengthens currency |
| **Higher GDP growth** | Increases confidence -> strengthens currency |

### Carry Trade
Investors borrow from low-rate countries, invest in high-rate countries. Higher rates attract foreign investment, strengthening the domestic currency.

---

## Chapter 3: Interest Rate Parity and Brexit Impact

### Brexit Impact on Currencies
- GBP crashed 8.64% post-referendum - a 31-year low
- Major European indices dropped 8-10%
- Lesson: "When in confusion, do nothing" - study events before trading

### Forward Premia Formula

```
F = S x (1 + Roc x N) / (1 + Rbc x N)
```

Where:
- **F** = Future/Forward Rate
- **S** = Today's Spot Rate
- **N** = Period in Years
- **Roc** = Interest Rate in Quotation Currency
- **Rbc** = Interest Rate in Base Currency

### Worked Example
- Borrowing $10,000 at 0.5% (US) to invest at 7% (India)
- Spot rate: 67 USD/INR
- Conversion: $10,000 = Rs.670,000
- After 1 year: Rs.716,900
- Required forward rate (no-arbitrage): **71.33 INR/USD**

### Interest Rate Parity Approximation

```
F ~ S x (1 + difference in interest rates)
F = 67 x (1 + 6.5%) = 71.35
```

### Key Principles
- **Currency with higher interest rate = future discount**: INR at 7% vs USD at 0.5% means INR trades at forward discount (67 today vs 71.35 future)
- The discount offsets the interest rate advantage, preventing arbitrage
- **Covered Interest Parity**: Hedged via forward contracts
- **Uncovered Interest Parity**: No forward hedge; relies on expected future spot rates

---

## Chapter 4: The USD/INR Pair

### Contract Specifications

| Specification | Value |
|---------------|-------|
| Lot Size | $1,000 |
| Tick Size (Pip) | 0.0025 INR |
| Trading Hours | Mon-Fri, 9:00 AM - 5:00 PM |
| Expiry Cycle | Up to 11 weekly + 12 monthly contracts |
| Last Trading Day | 2 working days before month-end at 12:30 PM |
| Settlement | Cash-settled at RBI reference rate |
| Margin | SPAN (~2%) + Exposure (~0.5%) = ~2.5% total |

### P&L Calculation Framework

**Per Pip P&L:**
```
Lot Size x Tick Size = $1,000 x 0.0025 = Rs.2.50 per pip
```

**Total P&L:**
```
Lot Size x Number of Lots x Points Moved
```

**Example:** Short 10 lots at 67.69, exit at 67.60 = 0.09 points gain
= $1,000 x 10 x 0.09 = Rs.900 profit

### Options on USD/INR
- **Expiry Style**: European
- **Premium**: Quoted in INR
- **Strikes**: ~25 (12 ITM, 12 OTM, 1 ATM) at 0.25 paise intervals
- **Settlement**: Cash-based on RBI reference rate
- **Premium Outlay** = Lot Size x Premium Per Unit = $1,000 x 0.74 = Rs.740

### Margin Efficiency
Currency derivatives require 2.25-2.5% margin vs 15-65% in equities, enabling higher leverage due to tighter trading ranges.

---

## Chapter 5: The USD/INR Pair (Part 2)

### Calendar Spread Strategy
Trade price differences between two futures contracts with different expirations rather than spot-futures spreads.

**Bull Spread (betting spread narrows):**
- Buy near-month contract
- Sell far-month contract
- Profit when long leg rises faster or short leg falls faster

**Bear Spread (opposite):**
- Short current month, Buy further month

### Volatility Metrics (8-Year Analysis)
- Average daily return: 0.025%
- Maximum daily gain: +4.01%
- Maximum daily loss: -2.962%
- Daily volatility: 0.567%
- Substantially lower than Nifty 50 (0.82% daily SD, 15.71% annualized)

### Correlation with Equity Markets
- Nifty 50 vs USDINR: **-0.12267** (2015 data)
- When domestic markets strengthen -> foreign investment inflows -> rupee strengthens -> USDINR falls
- Provides portfolio diversification benefits

### Convergence Principle
Spreads narrow approaching expiration as futures prices converge toward underlying spot values.

---

## Chapter 6: EUR, GBP, and JPY Pairs

### Contract Specifications

| Metric | EUR/INR | GBP/INR | JPY/INR |
|--------|---------|---------|---------|
| Lot Size | 1,000 EUR | 1,000 GBP | 100,000 JPY |
| Tick Size | 0.0025 INR | 0.0025 INR | 0.0025 INR |
| Margin | ~2.5% | Slightly higher | ~4.2% |
| P&L per tick | Rs.2.5 | Rs.2.5 | Rs.2.5 |

### Key Distinctions
- JPY/INR: Quoted per 100 JPY, highest margin, most volatile
- GBP/USD nicknamed "Cable"
- No seasonality detected on weekly or monthly basis (Holt-Winters analysis)
- Technical analysis works identically to equities

### Liquidity Ranking
1. USD/INR Futures
2. USD/INR ATM Options
3. GBP/INR Futures
4. EUR/INR Futures
5. JPY/INR Futures

---

## Chapter 7: Gold (Part 1) - Market Fundamentals

### MCX Gold Contract Specifications

| Contract | Lot Size | Tick Size | P&L per Tick | Margin |
|----------|----------|-----------|--------------|--------|
| Big Gold | 1 kg (1,000g) | Rs.1 | Rs.100 | ~4% |
| Gold Mini | 100g | Rs.1 | Rs.10 | ~5% |
| Gold Guinea | 8g | Rs.1 | Rs.1 | - |
| Gold Petal | 1g | Rs.1 | Rs.1 | - |

### Universal P&L Formula
```
P&L per tick = (Lot Size / Quotation) x Tick Size
Example: (1,000g / 10g) x Rs.1 = Rs.100 per tick
```

### Contract Value Calculation
For Rs.31,331 per 10g:
- Contract value = (1,000 x 31,331) / 10 = Rs.31,33,100
- Margin = Rs.1,25,868 / Rs.31,33,100 ~ 4%

### Key Rules
- Price quotation: Rupees per 10 grams (inclusive of all taxes and levies)
- Most recent contract is most liquid
- Positions must close 4 days before expiry to avoid physical delivery
- Settlement is physical (delivery is compulsory)
- Daily volume: 12,000-13,000 lots (~Rs.4,500 crore)

---

## Chapter 8: Gold (Part 2) - Trading Strategies

### Price Discovery
- **London Fix**: Twice daily (10:30 AM and 3:00 PM), 10-11 banks participate, 10-15 minute process
- **India**: Indian Bullion Association aggregates dealer quotes

### CME vs MCX Price Disparity
**Futures Pricing Formula:**
```
F = S x e^(rt)
```
India includes additional costs: CIF, customs duty, cess, bank processing -> legitimate price variance, NOT arbitrage

### Factors Driving Gold Prices

| Factor | Impact |
|--------|--------|
| Global uncertainties | Safe-haven demand increases |
| Inflation | Gold as hedge (8% CAGR since 1970 vs 5-6% inflation) |
| USD weakness | Increases commodity demand -> gold appreciation |
| USD strength | Reduces gold demand |
| Federal rate increases | Strengthen dollar -> weaken gold |
| Actual USD-Gold correlation | ~0.3 (weak) |

### Trading Framework
- **Long-term charts** (2+ years): Identify trend direction and conviction
- **Short-term charts** (daily/intraday): Identify entry/exit setups
- Technical analysis is "the best way to trade gold" - fundamentals too complex for daily use
- Use Gold ETFs (GoldBees) for multi-month positions vs rolling futures

---

## Chapter 9: Silver

### Supply-Demand Dynamics
- Global demand: 1,170.5 million ounces
- Global supply: 1,040.6 million ounces (deficit position)
- Demand growth: ~2.5% annually; Supply growth: ~1.4%
- Prices influenced by Chinese and Indian manufacturing/industrial growth

### Gold-Silver Correlation
- **Intraday**: 0.7 (30-minute data)
- **End-of-Day**: ~0.8
- Enables pair trading strategies
- Silver-crude oil correlation is erratic and unreliable

### MCX Silver Contract Specifications

| Contract | Lot Size | Tick Size | P&L/Tick | Margin | Settlement |
|----------|----------|-----------|----------|--------|------------|
| Silver (30kg) | 30 kg | Rs.1 | Rs.30 | ~5-6% | Physical (mandatory) |
| Silver Mini | 5 kg | Rs.1 | Rs.5 | ~6.27% | Cash or Physical |
| Silver Micro | 1 kg | Rs.1 | Rs.1 | ~5.1% | Cash or Physical |
| Silver 1000 | 1 kg | Rs.1 | Rs.1 | ~6.2% | Physical only |

**P&L Formula:** (Lot Size / Quotation Unit) x Tick Size
- For 30kg: (30 / 1) x Rs.1 = Rs.30 per tick

### Key Considerations
- London-set prices, inclusive of import duties and taxes
- Most liquid: nearest expiry contracts
- Physical delivery: 30kg contract mandatory, forced closure before expiry month
- Technical analysis and quantitative pair trading recommended

---

## Chapter 10: Crude Oil (Part 1) - Historical Context

### OPEC Breakeven Points by Country

| Country | Breakeven ($/barrel) |
|---------|---------------------|
| Iran | $130.70 |
| Algeria | $130.50 |
| Nigeria | $122.50 |
| Venezuela | $117.50 |
| Saudi Arabia | $106.00 |
| Iraq | $100.60 |
| UAE | $77.30 |
| Qatar | $60.00 |
| Kuwait | $54.00 |

### Four Triggers for 2014-2015 Price Collapse
1. **American Shale Oil Disruption**: Technologically viable, cheaper extraction displaced OPEC exports
2. **Lack of Coordinated OPEC Action**: Cutting production considered more expensive than pumping
3. **China's Demand Contraction**: Economic slowdown reduced commodity demand
4. **Market Speculation**: Heavy short positions amplified the selloff

### Dollar-Oil Inverse Relationship
- Higher oil prices widen US current account deficit -> weaken dollar
- When oil peaked at $148 (2008), USD/EUR traded at 1.6
- Lower oil prices strengthen dollar relative to emerging currencies

### Impact on India (Net Oil Importer)
- **Positive**: Reduced petroleum subsidies, lower fiscal deficit, inflation relief
- **Negative**: Export contraction to oil-dependent economies
- Oil Marketing Companies (HPCL, BPCL, IOC) directly benefit from lower crude

---

## Chapter 11: Crude Oil (Part 2) - The Ecosystem

### Three-Tier Industry Structure

| Tier | Function | Oil Price Impact | Examples |
|------|----------|-----------------|----------|
| **Upstream** | Exploration, drilling, extraction | Benefit from higher prices | ONGC, Cairn, Shell, BP |
| **Midstream** | Transport via pipelines, tankers | Prefer stability | TransCanada, Spectra |
| **Downstream** | Refine into petrol, diesel, etc. | Benefit from lower prices | BPCL, HPCL, IOC |

**See-Saw Relationship**: Upstream and downstream companies share inverse relationship with oil prices.

### Crude Oil Benchmarks

| Benchmark | API Gravity | Sulfur | Exchange |
|-----------|------------|--------|----------|
| WTI | 39.6 (very light) | 0.26% (very sweet) | NYMEX |
| Brent | 38.06 (light) | 0.37% (sweet) | ICE |

- **MCX crude oil follows WTI, not Brent**
- API > 10 = lighter than water; Sulfur < 0.5% = "sweet"

### Supply-Demand Tracking
- **High inventory** = oversupply/low demand -> price decline
- **Low inventory** = strong demand -> price rise
- Data sources: EIA (weekly), OECD inventory positions
- **Dollar Index** (not spot rates) used for USD-crude correlation

---

## Chapter 12: Crude Oil (Part 3) - The Contract

### MCX Contract Specifications

| Spec | Big Crude | Crude Mini |
|------|-----------|------------|
| Lot Size | 100 barrels | 10 barrels |
| Tick Size | Rs.1 | Rs.1 |
| P&L per Tick | Rs.100 | Rs.10 |
| Expiry | 19th-20th of month | Same |
| Settlement | Cash-settled | Cash-settled |

**Contract Value:** Lot size x Price (e.g., 100 x 3,198 = Rs.319,800)

**Margin:**
- NRML (overnight): ~9-9.5% of contract value
- MIS (intraday): ~4.5-4.8%

### Arbitrage Framework
When two contracts trade at different prices: buy cheaper, sell expensive, match contract values.
- Example: Big at 3,221, Mini at 3,217 -> trade 10 mini vs 1 big -> 4 points risk-free per unit
- Caveat: algorithms typically capture these quickly

### Trading Rules
- New contract launched each month, 6 months in advance
- Trade current-month contracts for maximum liquidity
- Transition to next-month 15-16 days before expiry
- Average daily volume: Rs.3,000+ crores

---

## Chapter 13: Copper and Aluminium

### Copper Fundamentals
- Daily traded value: ~Rs.2,050 crores (55,000 lots)
- Applications: Electrical wiring, EV motors, construction, telecom
- Global demand: 24 million tons (half from China and Japan)

### Copper Contract Specifications

| Spec | Big Copper | Mini Copper |
|------|-----------|-------------|
| Lot Size | 1 MT (1,000 kg) | 250 kg |
| Tick Size | Rs.0.05 | Rs.0.05 |
| P&L per Tick | Rs.50 | Rs.12.50 |
| NRML Margin | ~7.8% | Lower |
| Expiry | Last day of month | Same |

### Aluminium Fundamentals
- 8% of Earth's crust (3rd most abundant element)
- Manufacturing: 17.4 MWh per MT; Recycling: only 5% of that energy
- Global production: 56 million tons (4% YoY growth)
- Applications: Smartphones, aircraft (Boeing 747 = ~70,000 kg aluminium), automotive

### Aluminium Contract Specifications

| Spec | Big Aluminium | Mini Aluminium |
|------|--------------|----------------|
| Lot Size | 5 MT (5,000 kg) | 1 MT (1,000 kg) |
| Tick Size | Rs.0.05 | Rs.0.05 |
| P&L per Tick | Rs.250 | Rs.50 |
| NRML Margin | ~5.6% | ~5.7% |
| Expiry | Last day of month | Same |

### Risk Lesson: Sumitomo Copper Scandal (1995)
- Yasuo Hamanaka controlled ~5% of global copper reserves
- Combined spot market dominance with large LME futures positions
- Losses reached ~$5 billion when Chinese production flooded markets

---

## Chapter 14: Lead and Nickel

### Lead
- Earliest discovered metal (figurines from 4000 BC)
- Primary use: lead-acid storage batteries
- Toxic and carcinogenic
- Market: Relatively stable, range-bound pricing

| Contract | Lot Size | Tick Size | P&L/Tick | NRML Margin |
|----------|----------|-----------|----------|-------------|
| Big Lead | 5,000 kg (5 MT) | Rs.0.05 | Rs.250 | ~11.7% |
| Lead Mini | 1,000 kg (1 MT) | Rs.0.05 | Rs.50 | ~11.7% |

### Nickel
- Primary use: stainless steel manufacturing (65% of production)
- Production has outstripped demand (downward price pressure)

| Contract | Lot Size | Tick Size | P&L/Tick | NRML Margin |
|----------|----------|-----------|----------|-------------|
| Big Nickel | 250 kg | Rs.0.10 | Rs.25 | ~10% |
| Nickel Mini | 100 kg | Rs.0.10 | Rs.10 | ~10% |

### Trading Approach
- Trade price action, not fundamentals
- Focus on current-month contracts for liquidity
- Lead has highest margin requirements in commodity markets (11.7%)
- Both settle on last day of month with physical delivery options

---

## Chapter 15: Natural Gas

### Fundamentals
- Non-renewable hydrocarbon gas mixture, primarily methane
- India: 7th largest global producer (~2.5% of worldwide production)
- Uses: Power generation, industrial fuel, LPG conversion, fertilizer

### MCX Contract Specifications

| Specification | Value |
|---------------|-------|
| Price Quote | Rs. per mmBtu |
| Lot Size | 1,250 mmBtu |
| Tick Size | Rs.0.10 |
| P&L per Tick | Rs.125 |
| Contract Expiry | 25th of every month |
| NRML Margin | ~15% |
| MIS Margin | ~7% |

**Contract Value:** 1,250 x Rs.217.3 = Rs.271,625

### Price Impact Factors
1. **Inventory Data**: Increases -> price down; Decreases -> price up
2. **US Weather**: Cold winters -> increased consumption -> depleted inventory -> higher prices
3. **Hurricanes**: Disrupt supply -> bullish pressure
4. **Crude Oil Correlation**: Historical high correlation, recently weakened

### Risk Lesson: Amaranth Hedge Fund Disaster (2006)
- $9 billion fund, star trader Brian Hunter
- Highly leveraged natural gas positions (1:8 leverage ratio)
- Nature didn't cooperate: no hurricanes, supplies kept flowing
- 20% single-day price decline triggered panic
- **$6 billion loss** - "Risk management sits above all"

---

## Chapter 16: Commodity Options

### Key Differences from Equity Options
- **Underlying**: Futures contracts, not spot prices ("derivatives on derivatives")
- **Pricing Model**: Black 76 model (NOT Black-Scholes) - standard B&S calculators produce incorrect Greeks
- **Settlement**: Devolvement into futures positions at expiry

### Contract Specifications
- Lot size matches underlying futures
- European exercise style
- 31 strikes available (15 above ATM, 15 below, 1 ATM)
- Margins: SPAN + Exposure for writers; full premium for buyers

### Devolvement Mechanism (Options to Futures)

| Position | Devolves Into |
|----------|---------------|
| Long Call | Long Futures |
| Short Call | Short Futures |
| Long Put | Short Futures |
| Short Put | Long Futures |

### Close-to-Money (CTM) Classification
- Two strikes above AND below ATM
- CTM options require explicit exercise instruction
- Without instruction, CTM options expire worthless
- ITM (non-CTM) options auto-settle unless "Contrary Instruction" issued

### Devolvement Margin
- Half of margin due one day before expiry
- Remaining half due on expiry day
- Profitable positions offset margin requirements

---

## Chapter 17: Cross Currency Pairs

### Available Pairs on NSE

| Element | EUR/USD | GBP/USD | USD/JPY |
|---------|---------|---------|---------|
| Lot Size | 1,000 EUR | 1,000 GBP | 1,000 USD |
| Tick Size | 0.0001 | 0.0001 | 0.01 |
| Contracts | 12 monthly | 12 monthly | 12 monthly |
| Expiry | 2 days before month-end | Same | Same |

- **88% of international forex trades involve USD**; 50% are EUR/USD, GBP/USD, USD/JPY
- P&L settled in quote currency (USD/JPY), then converted to INR via RBI reference rates

### Margin Requirements
- Initial: 2% of contract value
- Extreme Loss: 1%
- Calendar spread margins: Rs.1,500 (1 month) to Rs.2,400 (4 months)

### Options
- European expiry style
- Premium in USD (EUR/USD, GBP/USD) or JPY (USD/JPY)
- 25 strikes: 12 ITM + 12 OTM + 1 ATM
- Strike intervals: 0.005 (EUR/USD, GBP/USD); 0.50 (USD/JPY)

---

## Chapter 18: Government Securities

### G-Sec Categories

| Type | Tenor | Mechanics |
|------|-------|-----------|
| **T-Bills** | 91, 182, 364 days | Issued at discount, redeemed at par (Rs.100) |
| **Bonds** | Multi-year | Semi-annual coupons + principal at maturity |

### T-Bill Yield Formula
```
Yield = [Discount Value / Bond Price] x [365 / Days to Maturity]
```
Example: Rs.97 purchase, Rs.3 gain over 91 days = ~12.4% annualized

### Bond Symbol Nomenclature
Example: 740GS2035A
- 7.40% = annualized coupon
- GS = Government Securities
- 2035 = maturity year
- A = issue version

### Bond Investment Illustration
Invest 150 units @ Rs.98.4 (discount) in 700GS2020 (7%, 2-year):
- Semi-annual interest: 3.5% x 100 x 150 = Rs.525 (x4 payments)
- Maturity: Rs.15,000 principal repayment
- Total return: Rs.17,100
- **Yield: ~7.88%** (accounts for discount purchase)

### Key Concepts
- **Yield vs Coupon**: Coupon is fixed; yield depends on purchase price
- **YTM**: Assumes coupon reinvestment at same rate
- **Clean Price**: Bond price only
- **Dirty Price**: Clean price + accrued interest
- Prices and yields move inversely

### State Development Loans (SDLs)
- State government bonds for budgetary needs
- Explicit sovereign guarantee = zero risk weighting under RBI CRAR norms
- Example: 05.75APSDL2024 = 5.75% coupon, Andhra Pradesh, 2024 maturity

### Taxation
- Interest: Taxed as "income from other sources" per slab
- LTCG (>3 years): 10% flat or 20% with indexation
- STCG (<3 years): Per income tax slab
- T-Bills: Gain = STCG at slab rate

### G-Sec vs Fixed Deposits
- Zero credit risk (sovereign guarantee)
- Competitive yields
- Tradeable in secondary market
- Tax-efficient capital gains treatment
- Interest rate risk (prices decline if rates rise)

---

## Chapter 19: Electricity Derivatives

### Market Structure
- India consumes 1,700+ TWh annually (world's 3rd largest market)
- Only ~7% traded on power exchanges (Europe trades ~50%)
- Underlying: IEX (Indian Energy Exchange)
- Derivatives: MCX/NSE

### Contract Specifications

| Specification | Value |
|---------------|-------|
| Lot Size | 50 MWh minimum |
| Trading Limit | 1-50 lots per position |
| Tick Size | Rs.1 per MWh |
| P&L per Tick | Rs.50 per contract |
| Initial Margin | 10% or SPAN (whichever higher) |
| Settlement | Cash-settled only |
| Trading Hours | 9:00 AM - 11:30 PM |
| Underlying | IEX Day Ahead Market weighted average price |

### Numerical Example
- Entry: 1 lot at Rs.3,000/MWh
- Contract value: Rs.3,000 x 50 = Rs.1,50,000
- Margin: Rs.15,000 (10%)
- If price -> Rs.3,010: Profit = 50 x 10 = Rs.500

### Six Primary Risks
1. **Derivative Cost Risk**: Hedging must offset strategy costs
2. **Speculation Divergence**: Cash settlement allows price separation from underlying
3. **Spot-Futures Divergence at Expiry**: Cash settlement permits persistent gaps
4. **Time Basis Risk**: Billing cycles misaligned with contract expiry
5. **Location Basis Risk**: Regional spot prices differ from exchange prices
6. **Quantity Basis Risk**: Under/over-estimation creates ineffective hedges

### Growth Opportunity
Current 7% exchange-traded penetration vs Europe's 50% signals significant expansion potential.
