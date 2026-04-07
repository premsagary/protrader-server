# Module 1: Introduction to Stock Markets
## Zerodha Varsity Knowledge Base -- Comprehensive Extraction
### Source: https://zerodha.com/varsity/module/introduction-to-stock-markets/

---

## Chapter 1: The Need to Invest

### Core Investment Rationale
- **Three reasons to invest:** Fight inflation, create wealth, achieve a better life
- Without investing, surplus cash erodes in purchasing power over time
- Inflation acts as a silent wealth destroyer

### Compound Growth Framework
- **Future Value Formula:** `FV = PV * (1 + r)^n`
  - PV = Present Value, r = annual rate of return, n = number of years
- Example: Monthly surplus of Rs.20,000 over 20 years
  - Without investing: ~Rs.1.7 crores (just accumulation with salary growth)
  - With 12% annual return: ~Rs.4.26 crores (2.4x improvement)

### Asset Class Returns (Historical Benchmarks -- India)

| Asset Class | Typical Annual Return | Risk Level |
|---|---|---|
| Bank Fixed Deposits | 5-6% | Very Low |
| Government Bonds (G-Sec, T-Bills) | 5.5% | Lowest |
| Corporate Bonds | 9-10% | Low-Medium (default risk) |
| Gold/Silver (Bullion) | 5-8% CAGR over 20 years | Low |
| Real Estate (Rental Yield) | 2-3% yield + capital appreciation | Medium (illiquid) |
| Equities | 12-15% CAGR over 10-15 years; top companies 20%+ | High |

### Comparative 20-Year Outcomes (Rs.20,000/month surplus)
- Fixed Income (9%): Rs.3.3 crores
- Bullion (8%): Rs.3.09 crores
- Equities (15%): Rs.5.4 crores

### Asset Allocation Frameworks

**Young Professional (~30 years old):**
- 60% Equity
- 20% Precious Metals
- 20% Fixed Income

**Retired Individual:**
- 80% Fixed Income (government bonds preferred)
- 10% Equities
- 10% Precious Metals

### Key Principles for Automated Systems
- **Risk-Return Tradeoff:** Higher risk = higher expected returns
- **Inflation-Adjusted Returns:** A 9% FD with 10% inflation = net -1% real return
- **Time Horizon:** Equities outperform over extended periods (10+ years)
- **Diversification:** Spread across asset classes to manage risk

---

## Chapter 2: Regulators -- The Guardians of Capital Markets

### Market Structure

**Stock Exchanges in India:**
- **BSE (Bombay Stock Exchange):** Oldest exchange in Asia
- **NSE (National Stock Exchange):** Most actively traded exchange
- Markets are fully electronic (no physical trading floors)

### Five Categories of Market Participants
1. **Domestic Retail Participants** -- Individual investors
2. **NRIs and OCIs** -- Indians living abroad
3. **Domestic Institutions** -- Corporate entities based in India
4. **Domestic Asset Management Companies (AMCs)** -- SBI MF, HDFC AMC, ICICI Prudential, etc.
5. **Foreign Institutional Investors (FIIs)** -- Non-Indian funds, hedge funds, asset managers

### SEBI (Securities and Exchange Board of India)
**Primary Regulatory Body -- Seven Core Functions:**
1. Ensure stock exchanges conduct business fairly
2. Ensure stockbrokers conduct business fairly
3. Prevent unfair practices by participants
4. Monitor corporate use of markets
5. Protect small retail investor interests
6. Prevent large-money investors from market manipulation
7. Ensure overall market development

### Key Regulated Entities

| Entity | Examples | Function |
|---|---|---|
| Credit Rating Agencies (CRA) | CRISIL, ICRA, CARE | Rate creditworthiness of corporations/governments |
| Depositories | NSDL, CDSL | Digital safekeeping of securities in DEMAT form |
| Depository Participants (DP) | Banks, select brokers | Intermediary for DEMAT account operations |
| Merchant Bankers | Karvy, Axis Bank, Edelweiss | Facilitate IPO process |
| AMCs | HDFC AMC, SBI Capital | Pool and manage public investments |
| PMS (Portfolio Management) | Capitalmind, Motilal Oswal | Managed portfolios; minimum Rs.50 lakh investment |
| Stock Brokers | Zerodha, ICICI Direct, Sharekhan | Gateway for market access |

---

## Chapter 3: Market Intermediaries

### Three Essential Accounts for Trading
1. **Trading Account** (via broker) -- Execute buy/sell transactions
2. **DEMAT Account** (via depository participant) -- Store digital securities
3. **Bank Account** -- Fund transfers in/out of trading account

### Stock Broker Services
- Market access for stocks, bonds, ETFs, mutual funds
- Must be SEBI-registered trading member
- Three interaction modes: phone orders, self-trading terminal, API access
- Provides: margins, contract notes, fund transfers, settlement services

### Depositories
- **NSDL (National Securities Depository Limited)** and **CDSL (Central Depository Services Limited)**
- Store dematerialized (electronic) share certificates
- Cannot interact directly -- must use a registered DP

### Clearing Corporations
- **NSE Clearing Limited** (subsidiary of NSE)
- **ICCL -- Indian Clearing Corporation Limited** (subsidiary of BSE)
- Guarantee trade settlement; prevent defaults
- Handle margining for futures/options

### Historical Context
- Harshad Mehta scam (1992) catalyzed shift from physical paper certificates to dematerialization (post-1996)

---

## Chapter 4: The IPO Markets (Part 1)

### Business Funding Lifecycle

| Stage | Investor Type | Risk Level | Typical Round |
|---|---|---|---|
| Seed | Angel Investors (friends, family) | Highest | Seed / Friends & Family |
| Early | Venture Capitalists | High | Series A, B, C |
| Growth | Private Equity | Medium | Series D+ |
| Public | Retail & Institutional | Distributed | IPO |

### Key Financial Concepts

**Face Value (FV):**
- Original denomination assigned to each share at formation
- Remains static regardless of market price
- SEBI restricts range (typically Rs.1 to Rs.10)

**Company Valuation Formula:**
```
If X% equity sold for Y rupees:
Total Valuation = Y / (X / 100)
Example: 10% equity for Rs.100 Cr => Valuation = Rs.1,000 Cr
```

**Share Dilution:**
- Existing shareholders' ownership % decreases when new shares are issued
- Promoters accept dilution to raise capital
- Previous investors' notional wealth increases if valuation rises proportionally

### Capital Expenditure (CAPEX) Funding Options
1. **Internal Accruals** -- Retained profits reinvested
2. **Debt / Bank Loans** -- Creates finance charge burden (interest)
3. **Equity Raises** -- Dilutes existing shareholders but no debt obligation

### Share Capital Structure
- **Authorized Shares:** Maximum shares a company can issue
- **Allotted/Outstanding Shares:** Actually distributed to investors/promoters
- **Retained Shares:** Reserved for future use (ESOPs, incentives)

---

## Chapter 5: The IPO Markets (Part 2)

### IPO Process -- Step by Step
1. Appoint Merchant Banker(s) / Book Running Lead Manager (BRLM)
2. SEBI Registration -- submit operations details, financials, IPO rationale
3. SEBI Approval
4. Prepare DRHP (Draft Red Herring Prospectus) -- includes financials, risk disclosures, fund utilization plans
5. IPO Marketing -- roadshows, advertisements
6. Establish Price Band (lower and upper limits)
7. Book Building -- collect bids with price points and quantities
8. Closure -- determine cut-off/issue price
9. Listing Day -- stock debuts on exchange

### Pricing Mechanisms

**Book Building (Standard in India):**
- Price discovered through bidding within a price band
- Considered an effective price discovery method
- Example band: Rs.514-541 (Keystone Realtors)

**Fixed Price IPO:**
- Company sets price upfront without bidding

### Key Pricing Terms
- **Cut-off Price:** Final issue price within the band
- **Listing Price:** Market-determined price on listing day
- **Listing at Par:** Listing price = Cut-off price
- **Listing at Premium:** Listing price > Cut-off price (positive sentiment)
- **Listing at Discount:** Listing price < Cut-off price (negative sentiment)

### Subscription Metrics
- **Oversubscription:** More bids than shares offered (expressed as multiplier, e.g., 2x)
- **Under-subscription:** Fewer bids than shares (negative signal)
- Below-threshold subscription => IPO fails; investor funds released

### Green Shoe Option
- Allows issuer to authorize ~15% additional shares in event of oversubscription
- Lottery-based allocation among qualified oversubscribed bidders

### Market Transitions
- **Primary Market:** IPO bid collection period; company raises capital directly
- **Secondary Market:** Begins on listing day; shares trade on exchange; no additional capital to company

---

## Chapter 6: The Stock Markets

### How Stock Markets Work
- Electronic marketplace where differing viewpoints are expressed through trades
- Primary function: match buy and sell orders and facilitate transactions
- Different opinions between participants create trading opportunities

### What Moves Stock Prices
1. **News and Events:** Company-specific, industry-wide, or macroeconomic announcements
2. **Supply-Demand Dynamics:** More buyers than sellers pushes prices up and vice versa
- Positive news => buyers willing to pay higher => price rises
- Negative industry news => affects entire sector (sentiment contagion)

### Market Participant Types

| Type | Holding Period | Outlook |
|---|---|---|
| **Scalpers** | Seconds to minutes | Quick small profits on large volume |
| **Day Traders** | Within single trading day | Short-term intraday profit |
| **Swing Traders** | Days to weeks | Capture modest multi-day moves |
| **Growth Investors** | Months to years | Identify emerging trend companies |
| **Value Investors** | Years+ | Buy quality companies at beaten-down prices |

### Return Calculation Formulas

**Absolute Return (holding period <= 1 year):**
```
Absolute Return = [(Ending Value / Starting Value) - 1] x 100

Example: [(3550 / 3030) - 1] x 100 = 17.16%
```

**CAGR -- Compound Annual Growth Rate (holding period > 1 year):**
```
CAGR = [(Ending Value / Starting Value)^(1/n)] - 1

Where n = number of years
Example: [(3550 / 3030)^(1/2)] - 1 = 8.2% per annum over 2 years
```

**Annualization for Sub-Year Periods:**
```
Approximate Annualized Return = (Return / Months Held) x 12
Example: 17.16% in 6 months ≈ 34.32% annualized
```

### Why CAGR Matters for Automated Systems
- Normalizes returns across different time periods
- Enables fair comparison between investments with different holding durations
- Essential metric for backtesting and performance benchmarking

---

## Chapter 7: Stock Market Index -- Sensex, Nifty & How They Work

### Index Purpose
- Barometer representing overall market sentiment
- Tracks select representative stocks across key sectors
- Indicates economic health without monitoring all 5,000+ listed companies

### Major Indian Indices

| Index | Exchange | Constituents | Maintained By |
|---|---|---|---|
| S&P BSE Sensex | BSE | 30 companies | S&P (under license) |
| Nifty 50 | NSE | 50 companies | NSE Indices Limited |
| Bank Nifty | NSE | Banking sector | NSE Indices Limited |
| CNX IT | NSE | IT sector | NSE Indices Limited |

### Free-Float Market Capitalization Method

**Core Formula:**
```
Free-Float Market Cap = Free-Float Outstanding Shares x Current Stock Price
```

**Key Definitions:**
- **Outstanding Shares:** Total shares available in the market
- **Free Float:** Shares available for public trading (excludes locked-in promoter/insider holdings)

**Index Weightage Calculation:**
```
Stock Weightage = (Stock's Free-Float Market Cap / Total Index Free-Float Market Cap) x 100
```

### Top 10 Nifty 50 Constituents by Weightage (Example Snapshot)

| Rank | Company | Sector | Weightage |
|---|---|---|---|
| 1 | Reliance Industries | Oil & Gas | 11.03% |
| 2 | HDFC Bank | Banking | 8.26% |
| 3 | ICICI Bank | Banking | 7.94% |
| 4 | Infosys | IT | 7.06% |
| 5 | HDFC Ltd | Housing | 5.62% |
| 6 | TCS | IT | 4.10% |
| 7 | ITC | FMCG | 3.85% |
| 8 | Kotak Mahindra Bank | Banking | 3.51% |
| 9 | L&T | Infrastructure | 3.07% |
| 10 | Axis Bank | Banking | 3.00% |

### Stock Contribution to Index Movement
```
Contribution (points) = Stock Weightage (%) x Stock Price Change (%)

Example (simplified 2-stock index):
Stock A (50% weight) rises 10%, Stock B (50% weight) flat:
Overall Index Change = (50% x 10%) + (50% x 0%) = 5%
```

### Index Applications for Trading Systems
1. **Sentiment Indicator:** Index direction signals broad market mood
2. **Benchmarking:** Compare portfolio returns vs index returns to measure alpha
3. **Index Trading:** Trade derivatives on index (Nifty futures/options) for broad market bets
4. **Portfolio Hedging:** Short index derivatives to protect long portfolios during downturns
5. **Rebalancing Signal:** Formal index rebalancing happens quarterly

---

## Chapter 8: Commonly Used Jargons

### Market Sentiment Terms
- **Bull Market / Bullish:** Expectation of rising prices; sustained index uptrend
- **Bear Market / Bearish:** Expectation of falling prices; sustained index downtrend
- **Trend:** General market direction -- bullish (rising), bearish (falling), or sideways (flat)

### Price Data (OHLC)
- **Open:** First traded price of the session
- **High:** Highest price during the session
- **Low:** Lowest price during the session
- **Close:** Last traded price of the session (most important for analysis)
- **Volume:** Total number of shares transacted during the day

### Position Types
- **Long Position:** Buy first, sell later; profit when price rises
- **Short Position:** Sell first (borrowed), buy later; profit when price falls
  - In cash segment: must close same day (intraday only)
- **Square Off:** Closing an existing position (selling a long, buying back a short)
- **Intraday Position:** Opened and closed within the same trading session

### Price Reference Points
- **Face Value (Par Value):** Nominal value of a share; used for dividend calculations
  - Formula: `Dividend % = (Dividend per Share / Face Value) x 100`
  - Example: Infosys FV Rs.5, dividend Rs.63 => 1260% dividend
- **52-Week High/Low:** Highest and lowest prices in the last 52 weeks
- **All-Time High/Low:** Highest and lowest prices since listing

### Circuit Limits
- **Upper Circuit:** Maximum price increase allowed in a single day
- **Lower Circuit:** Maximum price decrease allowed in a single day
- Set at 2%, 5%, 10%, or 20% based on stock's volatility profile
- When hit, trading in that direction halts

### Market Segments
- **Capital Market (CM):** Stocks and ETFs; cash/spot market
- **Futures and Options (F&O):** Equity derivatives, leveraged products
- **Currency Derivatives (CDS):** Currency pair trading (USD-INR, EUR-INR, etc.)
- **Wholesale Debt Market (WDM):** Government bonds, T-Bills, corporate bonds

---

## Chapter 9: The Trading Terminal

### Order Types (Critical for Automated Trading)

**Limit Order:**
- Specify exact price you want to buy/sell at
- Executes only if market reaches your specified price
- Remains valid until market close (3:30 PM IST), then auto-cancels
- Can result in partial fills if insufficient quantity at specified price

**Market Order:**
- Executes immediately at best available price
- Guarantees execution but not price
- For large orders, may fill across multiple price levels (slippage)

**Stop-Loss (SL) Order:**
- Two components: Trigger Price + Limit Price
- Trigger Price: Threshold that activates the order
- Limit Price: The price at which to execute once triggered
- Example: Buy at Rs.262.25, SL trigger at Rs.258, limit at Rs.255

**SL-Market Order:**
- Combines stop-loss trigger with market execution (guaranteed fill on trigger)

### Product Types
- **CNC (Cash and Carry / Delivery):** Hold shares indefinitely in DEMAT; no leverage
- **MIS (Margin Intraday Square-off):** Leveraged intraday trading; auto-liquidated by session end

### Market Depth (Order Book)

**Bid Side (Buyers):**
- Ranked by price (highest first)
- Shows quantity and number of buyers at each level
- Represents demand

**Ask/Offer Side (Sellers):**
- Ranked by price (lowest first)
- Shows quantity and number of sellers at each level
- Represents supply

**Market Order Execution Across Depth Levels:**
```
Example: Buy 10 shares via market order
Level 1: 2 shares @ Rs.3294.80
Level 2: 4 shares @ Rs.3294.85
Level 3: 4 shares @ Rs.3295.00
Average Price = (2*3294.80 + 4*3294.85 + 4*3295.00) / 10 = Rs.3294.90
```

### Order Book vs Trade Book
- **Order Book:** All submitted orders (Open, Completed, Rejected); can modify/cancel open orders
- **Trade Book:** Confirmed executed trades; serves as receipt with exchange order numbers

### Standard Market Depth: 5 levels (bid + ask)
### Extended Market Depth: 20 levels (Level 3 data) -- see Chapter 15

---

## Chapter 10: Clearing and Settlement Process

### T+1 Settlement Cycle (India -- from January 2023)
- India is the first country to implement T+1
- Settlement occurs one business day after trade date

### Buy-Side Timeline
**T Day (Trade Day):**
- Order placed and executed
- Broker validates sufficient funds
- Funds blocked in account (shares NOT yet in DEMAT)
- Contract note generated and emailed

**T+1 Day (Settlement):**
- Clearing corporation debits buyer's broker pool account
- Shares credited to buyer's DEMAT account
- Ownership officially established

### Sell-Side Timeline
**T Day:**
- Shares immediately "earmarked" (blocked) in DEMAT account
- Shares remain in client's DEMAT (not moved to broker pool)
- No funds credited yet

**T+1 Day:**
- Earmarked shares debited from client DEMAT
- Transferred to clearing corporation
- 100% sale proceeds credited to client account

### Earmarking System (Introduced November 2022)
- Shares remain in client's DEMAT until settlement (not in broker's pool)
- Eliminates risk of broker misuse of client securities
- Previous system: shares moved to broker pool, creating exposure risk

### Transaction Charges (Example: Rs.1,00,000 Equity Delivery Purchase)

| Charge | Rate | Amount |
|---|---|---|
| Brokerage (delivery) | 0% (Zerodha) | Rs.0 |
| STT (Securities Transaction Tax) | 0.1% | Rs.100 |
| Exchange Charges | 0.00345% | Rs.3.45 |
| GST | 18% of broker fees | Rs.0.62 |
| SEBI Charges | Rs.10 per crore | Rs.0.12 |
| Stamp Duty (buy side) | 0.015% | Rs.15 |
| **Total** | | **Rs.119.19** |

### Key Entities in Settlement Chain
1. **Broker** -- validates and documents transactions
2. **Stock Exchange** -- receives and matches orders
3. **Clearing Corporation** -- manages fund/securities transfers
4. **Depository (NSDL/CDSL)** -- maintains DEMAT accounts

---

## Chapter 11: Corporate Actions and Impact on Stock Prices

### 1. Dividends

**Definition:** Portions of company profits distributed to shareholders on a per-share basis.

**Key Formulas:**
```
Dividend Yield (%) = (Dividend per Share / Face Value) x 100
Dividend Yield on CMP = (Dividend per Share / Current Market Price) x 100
```

**Timeline:**
- Declaration Date: AGM approval
- Record Date: Company reviews shareholder register (~30 days post-declaration)
- Ex-Dividend Date: Last date to own shares for dividend eligibility (typically = record date under T+1)
- Payout Date: Funds remitted

**Price Impact:** Stock price drops by approximately the dividend amount on ex-date (cash exits balance sheet).

**Types:** Interim (mid-year), Final (year-end), Special (non-recurring)

### 2. Bonus Issue

**Definition:** Free additional shares awarded to existing shareholders from company reserves.

**Common Ratios:** 1:1, 2:1, 3:1

**Price Adjustment Formula:**
```
New Price = Old Price / (1 + Bonus Ratio)

Example (1:1 Bonus):
Before: 100 shares @ Rs.75 = Rs.7,500
After:  200 shares @ Rs.37.50 = Rs.7,500
```

**Key Property:** Face value remains unchanged; share count increases; total investment value constant.

### 3. Stock Split

**Definition:** Splitting existing shares to increase count; reduces per-share price.

**Key Difference from Bonus:** Face value changes in a split.

**Price Adjustment Formula:**
```
New Price = Old Price / Split Ratio
New Face Value = Old Face Value / Split Ratio

Example (1:2 Split, FV Rs.10):
Before: 100 shares @ Rs.900 (FV Rs.10) = Rs.90,000
After:  200 shares @ Rs.450 (FV Rs.5)  = Rs.90,000
```

### 4. Rights Issue

**Definition:** Company offers new shares to existing shareholders at discounted prices.

**Example:** 1:4 rights issue = 1 new share for every 4 held, at ~20-30% discount to market price

**Caution:** Discount alone should not drive decision; evaluate fundamentals. Market price may drop below rights price.

### 5. Buyback of Shares

**Definition:** Company repurchases its own shares from market, reducing outstanding share count.

**Strategic Rationales:**
- Improve EPS (Earnings Per Share)
- Consolidate promoter stake
- Prevent hostile takeovers
- Signal promoter confidence
- Support declining share price

**Signal:** Generally perceived as positive (company believes shares are undervalued)

### Price Adjustment for Historical Data
- Previous prices are adjusted backward using adjustment factors for accurate technical analysis
- Essential for automated backtesting: always use adjusted prices for dividends, splits, and bonuses

---

## Chapter 12: Key Events and Their Impact on Markets

### Monetary Policy Tools (RBI)

| Tool | Definition | Market Impact |
|---|---|---|
| **Repo Rate** | Rate at which RBI lends to banks | Increase => negative for markets (higher borrowing cost) |
| **Reverse Repo Rate** | Rate at which banks deposit with RBI | Increase => tightens money supply |
| **CRR (Cash Reserve Ratio)** | % of deposits banks must hold with RBI | Increase => reduces liquidity => negative for markets |

**Interest Rate Sensitive Sectors:** Banking, Automobiles, Housing/Real Estate, Metals

### Inflation Metrics

| Metric | What It Measures | Released By | Frequency |
|---|---|---|---|
| **WPI (Wholesale Price Index)** | Institutional/bulk price movements | Ministry of Commerce | Monthly |
| **CPI (Consumer Price Index)** | Retail-level prices (food, fuel, etc.) | MOSPI | Monthly |

**Key Relationship:** Rising inflation => RBI raises rates => negative for equities (typically)

### Industrial & Business Indicators

**IIP (Index of Industrial Production):**
- Monthly indicator tracking ~15 industries
- Base year: 2004-05
- Rising IIP => positive for markets
- Falling IIP => pressure on RBI to cut rates

**PMI (Purchasing Managers Index):**
- Survey-based sentiment indicator
- **Above 50:** Expansion (bullish signal)
- **Below 50:** Contraction (bearish signal)
- **Equal to 50:** No change (stasis)

### Corporate Events

**Quarterly Earnings:**
- Revenue growth, expenses, profitability, forward guidance
- Market reacts to variance vs "street expectation" (analyst consensus)
- **Beat expectations:** Positive price reaction
- **Miss expectations:** Negative price reaction
- **Meet expectations:** Flat to slightly negative

**Annual Budget (Fiscal Policy):**
- Typically late February
- Policy reforms, tax changes, duty modifications
- Creates sector-specific market reactions

### Non-Financial Events
- Geopolitical crises (wars, sanctions)
- Pandemics and natural disasters
- International trade tensions
- Supply chain disruptions
- All affect commodity prices, capital flows, and market sentiment

### Framework for Automated Event-Based Trading
1. Track RBI monetary policy dates and consensus expectations
2. Monitor CPI/WPI releases for inflation trajectory
3. Watch PMI for leading economic indicator signals
4. Parse quarterly earnings vs analyst estimates for earnings surprise signals
5. Flag geopolitical risk events for defensive positioning

---

## Chapter 13: Getting Started

### Developing a Point of View (POV)
- Most critical foundation: systematic direction on whether a stock will rise or fall
- Without a POV, you have no basis for market action

### Four Analytical Approaches

| Method | Description | Best For |
|---|---|---|
| **Fundamental Analysis (FA)** | Evaluate quarterly results, growth, valuation | Long-term investing |
| **Technical Analysis (TA)** | Chart patterns, indicators, support/resistance | Short-term and swing trading |
| **Quantitative Analysis (QA)** | Statistical measures, mean reversion | Systematic/algo trading |
| **Outside Views** | Analyst recommendations | Not recommended as sole basis |

### Matching POV to Trading Instruments
- **Bullish long-term view:** Buy in cash/spot market (delivery)
- **Bullish short-term view:** Buy futures or call options
- **Bearish view:** Short futures or buy put options
- **Neutral with defined risk:** Options strategies

### Learning Progression (Varsity Module Sequence)
1. Introduction to Stock Markets (this module)
2. Technical Analysis
3. Fundamental Analysis
4. Futures Trading
5. Options Theory
6. Options Strategies
7. Quantitative Concepts
8. Risk Management
9-16. Advanced topics (commodities, currencies, personal finance, etc.)

---

## Chapter 14: Supplementary -- Rights Issues, OFS, FPO

### Rights Issue
- Company offers new shares to existing shareholders at discounted prices
- Proportional to existing holdings (e.g., 1:4 = 1 new share per 4 held)
- Creates new shares => dilutes existing shareholding
- Example: South Indian Bank offered at Rs.14 (30% below market Rs.20)

### Offer for Sale (OFS)
- Promoters sell existing (secondary) shares to broader market
- No new shares created => no dilution
- Used to meet minimum public shareholding requirements (e.g., 25% for PSUs)
- Only for companies with market cap Rs.1,000 crores+
- Exchange provides dedicated window; allocation within T+1 days

### Follow-on Public Offering (FPO)
- Fresh shares issued after listing to raise new capital
- Requires SEBI approval via merchant bankers
- Bidding over 3-5 days via ASBA
- Creates dilution (new shares issued)
- Rarely used since OFS introduction in 2012 (lengthy process)

### Comparison Table

| Aspect | IPO | Rights Issue | OFS | FPO |
|---|---|---|---|---|
| New Shares | Yes | Yes | No | Yes |
| Dilution | Yes | Yes | No | Yes |
| Open To | Public | Existing shareholders | Public | Public |
| SEBI Approval | Yes | Yes | No (exchange window) | Yes |
| Min Market Cap | N/A | N/A | Rs.1,000 Cr | N/A |

---

## Chapter 15: Supplementary -- The 20 Market Depth (Level 3 Data)

### What is Level 3 Data?
- Displays 20 best bid and ask prices in the order book
- Standard depth shows only 5 levels; Level 3 shows 20
- Reveals liquidity distribution and hidden order concentrations

### Applications for Trading Systems

**1. Liquidity Assessment:**
- Identify liquidity pockets invisible in standard 5-depth view
- Essential for determining executable position sizes

**2. Slippage Estimation:**
- Calculate expected fill prices for large orders across multiple price levels
- Critical for market order sizing and cost estimation

**3. Position Sizing:**
- Examine depth distribution to determine reasonable position sizes given actual liquidity
- Avoid placing orders that exceed available depth

**4. Support/Resistance Validation:**
- High concentration of buy orders at a price level => potential support
- High concentration of sell orders at a price level => potential resistance
- Cross-reference with technical chart patterns for confirmation

**5. Order Flow Analysis:**
- Track changes in bid/ask depth over time
- Rapid depletion of bids signals selling pressure
- Building bid walls may signal accumulation

### Key Principle for Algorithmic Trading
"Things boil down to price, and the action traders take at that price." Level 3 data reveals trader intent through order clustering, enabling better-informed automated decisions.

---

## Consolidated Quick Reference: Formulas for Automated Systems

### Return Calculations
```
Absolute Return    = [(Exit Price / Entry Price) - 1] x 100
CAGR               = [(Exit Price / Entry Price)^(1/n)] - 1
Annualized Return  = (Period Return / Months) x 12   [approximation]
```

### Corporate Action Adjustments
```
Post-Split Price       = Pre-Split Price / Split Ratio
Post-Bonus Price       = Pre-Bonus Price / (1 + Bonus Ratio)
Post-Dividend Price    = Pre-Dividend Price - Dividend per Share
Dividend Yield         = (Annual Dividend / Current Price) x 100
```

### Index Calculations
```
Free-Float Market Cap  = Free-Float Shares x Current Price
Stock Weightage        = (Stock FFMC / Total Index FFMC) x 100
Index Contribution     = Stock Weightage x Stock Price Change %
```

### Valuation
```
Company Valuation      = Investment Amount / Equity % Sold
EPS After Buyback      = Net Income / (Original Shares - Bought Back Shares)
```

### Transaction Costs (India, Equity Delivery)
```
STT                    = 0.1% of trade value
Exchange Charges       = ~0.00345% of trade value
GST                    = 18% of (brokerage + exchange charges)
SEBI Charges           = Rs.10 per crore of trade value
Stamp Duty (buy)       = 0.015% of trade value
```

### Key Economic Indicators to Monitor
```
PMI > 50               => Expansion (bullish)
PMI < 50               => Contraction (bearish)
CPI Rising             => Rate hike likely (bearish for equities)
IIP Rising             => Economic growth (bullish)
Earnings > Consensus   => Stock price positive
Earnings < Consensus   => Stock price negative
```

---

## Data Points for System Configuration

### Indian Market Hours
- Pre-open session: 9:00 AM - 9:15 AM IST
- Normal trading: 9:15 AM - 3:30 PM IST
- Post-close session: 3:30 PM - 4:00 PM IST

### Settlement
- T+1 settlement (since January 2023)
- Earmarking system for sell-side securities

### Circuit Limits
- Individual stocks: 2%, 5%, 10%, or 20% (exchange-determined)
- Index-wide circuit breakers also apply at 10%, 15%, 20% thresholds

### Order Types for Algo Implementation
- Limit Order: Price-specific, may partial fill
- Market Order: Immediate execution, slippage risk
- Stop-Loss Order: Trigger price + limit price
- SL-Market Order: Trigger price + market execution

### Product Types
- CNC: Delivery (multi-day holding, no leverage)
- MIS: Intraday (auto-squared off by session end, with leverage)
