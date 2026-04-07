# Module 13: Integrated Financial Modelling (Zerodha Varsity)

## Complete Knowledge Base for Stock Prediction & Valuation System

---

# Chapter 1: Introduction to Financial Modelling

## What is Financial Modelling?

**Definition**: Financial modelling is a systematic way to understand a company through integrated analysis of financial statements and metrics.

- **Financial**: Working with company financial statements
- **Modelling**: Laying down financials systematically, connecting statements via equations
- **Integrated**: All numbers interconnected; no part of the financial model is isolated

## Purpose & Objective

The end objective is building a valuation perspective. Models take financial statements as inputs and produce valuations as outputs. The final output determines the company's share price, which you compare against market price to identify:
- **Overvalued**: Market price > Fair price (avoid/sell)
- **Undervalued**: Market price < Fair price (buy opportunity)
- **Fairly valued**: Market price = Fair price (hold)

## The 7-8 Steps in Building Integrated Financial Models

### Step 1: Layout Setup
- Ensure Excel workbook has proper indexation and formatting consistency across sheets
- If column E contains 2018 data in one sheet, column E maintains 2018 data across ALL other sheets

### Step 2: Historical Data Extraction
- Download 5 years of annual reports
- Extract Balance Sheet and P&L data
- Use consolidated numbers, not standalone data
- Primary source: annual reports (not third-party vendors)

### Step 3: Assumption Sheet
- Dedicated sheet containing all modeling assumptions
- Assumptions should remain close to reality; deviations create model distortion
- If company revenue grew 7% YoY for five years, assume 6th year near 7% unless significant changes expected

### Step 4: Asset and Other Schedules
- **Asset Schedule**: Gross block, depreciation, net block, CAPEX
- **Reserves Schedule**: Company reserves management
- **Debt Schedule**: Debt-related line items

### Step 5: Projections
- Project Balance Sheet and P&L forward 3-5 years using assumptions and schedules

### Step 6: Cash Flow Derivation
- Derive cash flow statement using indirect method (from P&L and Balance Sheet)
- Cash flow is calculated, not extracted from reports

### Step 7: Ratios
- Liquidity ratios, Solvency ratios, Profitability ratios, Additional analytical metrics

### Step 8: Valuations
- DCF (Discounted Cash Flow) method with integrated checks, balances, and sensitivity tables

## Key Structural Concepts
- All numbers in integrated models interconnect
- Manufacturing companies have multiple moving parts that all reflect in financial metrics
- Financial modelling is an "art form" incorporating assumptions that vary by individual judgment
- Models designed for flexibility and accommodation of updates

---

# Chapter 2: Excel Workbook Setup

## Company Selection Criteria
- Pick simple businesses (avoid complex conglomerates initially)
- Manufacturing over services (easier to model)
- Limited product lines (1-2 main revenue drivers)
- Transparent, consistent annual report disclosures
- Avoid BFSI (Banks, Financial Services, Insurance) - complex regulatory structures

## Workbook Structure Setup

### Column Configuration
1. **Column A & B**: Index columns (shrink for visual separation)
2. **Column C**: Expanded for line item labels/descriptions
3. **Column D**: Another narrow separator column
4. **Row 2, Columns E-I**: Fiscal years (5 years of historical data)

### Sheet Headers and Formatting
- **Cell A1**: Sheet title (bold, 14-point font)
- **Cell A2 or A3**: Currency notation: "All numbers in INR Crores unless specified" (italics, smaller font)
- Remove gridlines to reduce visual distraction
- **Freeze panes** at cell D3 to keep headers visible while scrolling

### Color Coding Convention
- **Light blue**: Hardcoded data (facts from annual reports)
- **Other colors**: Calculated values (formulas/assumptions)

### Multi-Sheet Replication
1. Select multiple sheets simultaneously using Ctrl+click
2. Apply formatting uniformly: index columns, expand Column C, year headers
3. Apply freeze panes individually to each sheet
4. Assign unique titles: Balance Sheet, P&L, Cash Flow, Assumptions, Schedules

## Model Types
- **Main model**: Single company tracked throughout, built step-by-step
- **Helper models**: Different companies used to illustrate specific concepts

## The "Hygiene Factor"
- Systematic setup is critical
- Column E consistently represents FY16 data across ALL sheets
- Column F consistently represents FY17, and so forth
- This eliminates confusion throughout the modeling process

---

# Chapter 3: Historical Data

## Data Sources
- **Primary Source**: Consolidated financial statements from annual reports (NOT standalone)
- Download from company investor relations websites
- When discrepancies exist between years, use numbers from the most recent annual report (companies often restate prior-year figures)

## Balance Sheet Line Items to Extract

### Non-Current Assets
- Property, Plant & Equipment (Gross and Net Block)
- Financial Assets (investments, loans to employees)
- Other non-current assets
- Deferred tax assets

### Current Assets
- Inventories
- Financial Assets (cash, receivables, other)
- Current tax assets
- Other current assets

### Non-Current Liabilities
- Borrowings
- Other financial liabilities
- Provisions
- Deferred tax liabilities

### Current Liabilities
- Borrowings (current portion of non-current debt)
- Trade payables
- Other financial liabilities
- Provisions
- Current tax liabilities
- Other current liabilities

## P&L Line Items to Extract
- Revenue from operations (Net Sales)
- Other income
- Cost of materials consumed
- Employee benefits expense
- Depreciation and amortization
- Other expenses (with detailed breakdown of major components)
- Profit before tax (PBT)
- Tax expense
- Profit after tax (PAT)
- Other comprehensive income
- Earnings per share (EPS)

## Data Organization
- Use columns A-B for hierarchical indexing with main headings and subheadings
- Right-align all numbers, display two decimal places
- Bold subtotals and main totals
- Apply double borders for section breaks

## Verification Steps
1. Calculate subtotals for each section using formulas
2. Run balance sheet equality check: **Assets = Liabilities + Equity**
3. Cross-reference totals against annual report
4. Identify any rounding discrepancies

## Important Notes
- Companies may restate prior-year numbers due to accounting changes
- Expand large expense categories using notes to financial statements
- When new line items appear in recent years, include them with zero values for earlier years

---

# Chapter 4: Assumptions (Part 1) - Balance Sheet Assumptions

## Core Assumption Methodology

The assumption sheet projects balance sheet line items forward by:
1. Calculating historical ratios for Years 2-5
2. Computing rolling averages for projection years
3. Using these averages to forecast future periods

## Key Balance Sheet Assumptions

### Liabilities as Percentage of Gross Block

```
Ratio = Liability Line Item / Gross Block
```

**Example**: 102.74 / 310.58 = 33.08%
- Historical range should remain narrow for consistency
- Apply rolling 4-year averages for projections

### Provisions as Percentage of Gross Block
Same methodology - express provisions as percentage of gross block and project using historical averages.

### Deferred Tax Liabilities
Uses year-on-year growth rate:

```
Growth Rate = (Current Year / Prior Year) - 1
```

Then average growth rates for projection.

**Alternative (more stable)**: Deferred tax as percentage of depreciation

```
Deferred Tax % = Deferred Tax Liability / Depreciation
```

This produces more stable percentages than growth rate methods.

## Key Principles
- "Assumptions are the art bit in financial modelling; you are free to experiment"
- Resulting percentages should show "certain trend or consistency"
- Try different denominators (gross block, net block, total assets) to find most consistent ratios
- Historical calculations for Y2-Y5, then projections using rolling averages for Y6-Y10

---

# Chapter 5: Assumptions (Part 2) - P&L & Inventory Ratios

## Revenue Growth Rate Method

Net sales growth calculation:

```
Revenue Growth Rate = (Current Year Sales / Prior Year Sales) - 1
```

- Compute growth rates from historical data (Y2-Y5)
- Take rolling averages for projection years (Y6-Y10)
- Compare peer company performance for validation

## Expense Ratios as Percentage of Net Sales

ALL P&L expense items are expressed as percentages of net sales or total income:

```
Expense Ratio = Expense Line Item / Net Sales
```

Items projected this way:
- Other income (as % of net sales)
- Cost of materials consumed (as % of net sales)
- Change in inventory (as % of net sales)
- Employee benefits (as % of net sales)
- Administrative expenses (as % of net sales)
- Selling and distribution costs (as % of net sales)

Calculate historical percentages, then apply rolling averages for projections.

## Inventory Days Calculation

### Conversion Formula:

```
Inventory Days = (Average Inventory of Y1 & Y2 / Materials Consumed for Y2) x 365
```

**Example**: Average inventory = 143.25 Cr, Material consumption = 762.86 Cr:
```
Inventory Days = (143.25 / 762.86) x 365 = 68.53 days
```

### Process:
1. Convert rupee values to days inventory outstanding
2. Calculate historical inventory days (Y2-Y5)
3. Take rolling averages for projections (Y6-Y10)

## Receivables Days

```
Receivable Days = (Average Trade Receivables / Revenue) x 365
```

Convert balance sheet rupee values to days outstanding, then back to projected amounts.

## Payables Days

```
Payable Days = (Average Trade Payables / Cost of Materials or COGS) x 365
```

## Working Capital Components as Percentages

| Item | Base/Denominator |
|------|-----------------|
| Sundry debtors | Gross block (or revenue) |
| Loans & advances | Net sales |
| Other current assets | Net sales |
| Investments | Gross block (use constant % if volatile) |

## Key Rules
- Begin inventory and receivables calculations from Y2 (Y1 lacks prior-year data)
- Growth rate method useful for P&L items
- Ratio method better for balance sheet items with operational linkage
- Hardcode assumptions (like 3.5% for volatile investments) can be marked differently from calculated values

---

# Chapter 6: Revenue Model

## Revenue Model Framework

The revenue model is a sub-model within the integrated financial model designed to identify key revenue drivers.

### Common-Sense Questions to Ask:
- What products/services does the company offer?
- Where does manufacturing occur and what is production capacity?
- What geographic markets does the company serve?
- How many units sell across different markets and product categories?
- What revenue comes from each segment and geography?

## Step-by-Step Revenue Model Construction

### Phase 1: Data Organization
- Compile manufacturing capacity data (by product type or facility)
- Gather international and domestic sales volumes (in units)
- Consolidate total sales figures
- Input historical revenue data from financial statements

### Phase 2: Price Analysis

```
Average Selling Price = Revenue / Total Units Sold
```

Year-over-year price change:

```
YoY Price Change = (Current Year Price / Prior Year Price) - 1
```

### Phase 3: Growth Projections

For **sales volume growth**: examine historical trends, apply flat assumptions based on:
- Industry averages
- Management guidance from analyst calls
- Conservative estimates reflecting market conditions

For **average price inflation**: establish consistent percentage assumptions (commonly 1-4% annually)

## Revenue Forecasting Formula

```
Projected Revenue = Projected Units x Projected Average Price
```

Where:
```
Projected Units = Prior Year Units x (1 + Volume Growth Rate)
Projected Average Price = Prior Year Price x (1 + Price Inflation Rate)
```

## Segment-Level Analysis

Decompose revenue by:
- **Geographic split**: Domestic vs. international
- **Product categories**: Different product lines
- **Customer type**: If applicable

```
Domestic Revenue = Total Revenue - Export Revenue
```

## Validation Checks
- Ensure company is not selling more than it manufactures
- Capacity Utilization = Units Sold / Production Capacity
- Market share analysis relative to industry totals

---

# Chapter 7: Asset Schedule (Part 1)

## Core Concepts

### The Base Rule
**"The closing balance for year 1 is the opening balance for year 2."** This applies across ALL financial schedules.

### Key Definitions

**Gross Block (PP&E)**: All assets the company owns - land, buildings, plant machinery, vehicles, factory equipment. Typically the largest asset-side item.

**CAPEX**: Capital expenditure - funds used to invest, upgrade, and maintain physical assets.

**Net Block Formula**:
```
Net Block = Gross Block - Accumulated Depreciation
```

## Gross Block Tracking

```
Opening Gross Block
+ New CAPEX Investments
- Asset Disposals
= Closing Gross Block
```

## Depreciation Handling

Two separate figures exist:
- **P&L Depreciation**: Current year expense only
- **Balance Sheet Accumulated Depreciation**: Cumulative total

### Accumulated Depreciation Schedule:
```
Opening Accumulated Depreciation
+ Current Year Depreciation
- Write-offs/Disposals
= Closing Accumulated Depreciation
```

## Extracting Implicit CAPEX

```
CAPEX = Closing Gross Block - Opening Gross Block + Disposals
```

This reveals capital spending patterns not directly disclosed in financial statements.

## CAPEX Projection Methods

### Method 1: Management-Based (Preferred)
Use company guidance from investor presentations, conference calls, management interviews.

### Method 2: Average Method
Calculate historical mean CAPEX and assume continuity.

### Method 3: Variable/Taper Method
- If historically high CAPEX, gradually reduce
- If low, potentially increase
- Based on CAPEX cycle analysis

## CAPEX Types
- **Maintenance CAPEX**: Sustaining existing assets (minimum required)
- **Expansion CAPEX**: Growth investments (typically multi-year cycles)
- **Asset Disposals**: Usually one-time events (no projection needed)

---

# Chapter 8: Asset Schedule (Part 2) - Depreciation Projections

## Depreciation Projection: Proportion Technique

### Step 1: Calculate Historical Ratio
```
Depreciation Rate = Prior Year Depreciation / Gross Block
```
Example: 41.71 Cr / 538.76 Cr = 7.74%

### Step 2: Apply to Projected Gross Block
```
Projected Depreciation = Depreciation Rate x Projected Gross Block
```
Example: 7.74% x 588.77 Cr = 45.58 Cr

### Step 3: Alternative - Rolling Average
Calculate a rolling five-year average of the depreciation-to-gross-block ratio for smoother projections.

## Accumulated Depreciation Build

```
Opening Accumulated Depreciation (prior year closing)
+ Current Year Depreciation (from P&L projection)
- Depreciation Write-off (typically zero if uncertain)
= Closing Accumulated Depreciation
```

## Net Block Derivation

```
Net Block = Gross Block - Accumulated Depreciation
```

The resulting net block flows from the asset schedule into the balance sheet's fixed assets section.

## Integration Points
- Depreciation projections drive P&L expenses
- Accumulated depreciation values complete balance sheet asset sections
- Asset schedule creates foundation for debt and reserves schedules

---

# Chapter 9: Debt Schedule

## Debt Classification
- **Secured loans**: Collateralized debt backed by tradable securities
- **Unsecured loans**: Non-collateralized borrowing (typically higher interest rates)
- Focus: Non-current (long-term) debt carried across multiple years

## Building the Debt Schedule

### Opening and Closing Balances (Base Rule)
```
Opening Balance = Prior Year Closing Balance
+ New Debt Issuances
- Debt Repayments
= Closing Balance
```

Track secured and unsecured loans independently.

## Interest Expense Calculations

### Average Outstanding Debt Method

```
Average Loan Outstanding = (Opening Balance + Closing Balance) / 2
```

Calculate average across BOTH secured and unsecured debt.

### Interest Rate Derivation

```
Interest Rate (%) = Interest Expense / Average Outstanding Loan
```

Take the average interest rate across historical years for forward projections.

### Projected Interest Expense

```
Projected Interest = Interest Rate x Average Loan Outstanding (for projected year)
```

This links debt schedule outputs directly to projected P&L statements.

## Debt Projection Methodology

### Method 1: Management Guidance (Preferred)
Examine CAPEX plans through:
- Annual report disclosures
- Conference call transcripts
- Management interviews
- Investor presentations

### Method 2: Conservative Trend-Based
- Keep new issuances at zero
- Calculate average historical repayments
- Maintain debt at similar levels
- Results in conservative valuation

## Balance Sheet Integration
- Debt schedule outputs populate balance sheet non-current liability sections
- Total Borrowings = Secured Loans + Unsecured Loans (closing balances)
- Interest expense feeds into P&L projections

---

# Chapter 10: Reserves Schedule (Part 1)

## Share Capital Structure

### Three-Tier Classification

1. **Authorized Share Capital**: Maximum shares a company can issue
   ```
   Max Shares = Authorized Capital / Face Value Per Share
   ```
   Example: INR 700M / Rs.5 = 140M shares

2. **Issued Share Capital**: Actual shares released (cannot exceed authorized)

3. **Subscribed & Fully Paid-Up Capital**: Shares actually purchased by investors

### Number of Shares Outstanding
```
Shares Outstanding = Share Capital Value / Face Value Per Share
```

## Reserves & Surplus Components

### 1. Securities Premium Reserve

```
Securities Premium = Total IPO Proceeds - Share Capital at Face Value
```

**Example**:
- 10,000 shares at Rs.10 face value = Rs.100,000 share capital
- IPO price Rs.250/share generates Rs.2,500,000
- Securities Premium = Rs.2,500,000 - Rs.100,000 = Rs.2,400,000

Increases ONLY when fresh equity is raised; remains unchanged otherwise.

### 2. General Reserve
Funds earmarked for general business operations without specific designation. Additions depend on management policy.

### 3. Retained Earnings (Surplus)

```
Opening Retained Earnings (prior year closing)
+ Profit After Tax (PAT from P&L)
+ Other Comprehensive Income adjustments
- Dividends Paid
- Dividend Distribution Tax
= Closing Retained Earnings
```

**Critical Link**: PAT flows from P&L to balance sheet retained earnings (liabilities side) - this is how the two statements interconnect.

### 4. Other Components
- Remeasurement gains/losses on defined benefit plans
- Ind AS 116 impacts
- Capital redemption reserves
- Contingency reserves
- Foreign currency translation reserves

## Total Equity Calculation

```
Total Equity = Share Capital + Securities Premium + General Reserve + Retained Earnings + Other Reserves
```

## Base Rule Application for All Reserve Components

```
Opening Balance (prior year closing)
+ Additions during year
- Deductions during year
= Closing Balance
```

---

# Chapter 11: Reserves Schedule (Part 2)

## Completing the Reserves Schedule

### Key Components (Example Values)
1. **Share Capital**: INR 11.39 Cr (constant unless equity raise occurs)
2. **Capital Reserves**: INR 11,500 (small, maintained for accounting)
3. **Securities Premium**: INR 31.19 Cr (consistent across periods)
4. **General Reserves**: Yearly additions linked from P&L appropriations
5. **Surplus (Retained Earnings)**: Flows directly from PAT

## Critical Dependency
Completing the reserves schedule REQUIRES fully projected P&L statements because:
- General reserve appropriations depend on PAT
- PAT relies on revenue and expense projections
- Integration occurs during the Projections step

## Data Flow
```
P&L Appropriations --> Reserves Schedule --> Balance Sheet (Equity Section)
```

---

# Chapter 12: Projections - Complete P&L & Balance Sheet

## P&L Projection Method

### Net Sales Projection (Foundation)

```
Projected Net Sales = Prior Year Sales x (1 + Projected Growth Rate)
```

**Example**: Y6 = 1,761.12 Cr x 1.3371 = 2,354.71 Cr

Growth rates calculated by averaging year-over-year percentages from five historical years.

### Revenue Line Items
All calculated as percentages of net sales from assumptions sheet:
```
Other Income = Assumption % x Net Sales
Increase in Stock = Assumption % x Net Sales
```

### Expense Projections
Same percentage-of-sales methodology:
- Material consumed = % of net sales
- Employee benefits = % of net sales
- Manufacturing expenses = % of net sales
- Administrative and selling expenses = % of net sales
- **Depreciation**: Sourced from Asset Schedule
- **Interest**: Sourced from Debt Schedule

### Profit Before Tax (PBT)
```
PBT = Total Income - Total Expenses
```

### Tax Provision
```
1. Historical Tax Rate = Tax Paid / PBT (for each year)
2. Average Tax Rate = Mean of 5 historical tax rates
3. Projected Tax = Average Tax Rate x Projected PBT
```

**Example**: Y1 tax rate = 24.15 Cr / 71.2 Cr = 34%

### Profit After Tax (PAT)
```
PAT = PBT - Tax Provision
```

## P&L Appropriations Section

### Previous Year Profit
```
Previous Year Profit = Last Year's "Balance Carried to Balance Sheet" (closing balance)
```
Base rule: closing balance of Year N = opening balance of Year N+1

### Profit Available for Appropriation
```
Profit Available = Previous Year Profit + Current Year PAT
```

### Transfer to General Reserves
```
General Reserves Transfer = % of Current Year PAT (using 5-year historical average %)
```
This flows back to the Reserves Schedule.

### Dividend & Dividend Tax
```
Dividend = % of PAT (historical average)
Dividend Tax = % of PAT (historical average)
```

### Closing Profit (Balance Carried to Balance Sheet)
```
Closing Profit = Profit Available - General Reserves Transfer - Dividend - Dividend Tax
```

## Balance Sheet Projection Method

### Gross Block: The Alpha Line Item
Like net sales in P&L, gross block drives most balance sheet assumptions. Most BS items are calculated as percentages of gross block.

### Current Liabilities & Provisions
```
Projected Current Liability = Assumption % x Projected Gross Block
```

### Shareholders' Funds & Loans
- Shareholders' equity: From Reserves Schedule
- Loans: From Debt Schedule

### Deferred Tax Liability
```
Deferred Tax = Depreciation % (from Asset Schedule)
```

## Asset Side Projections

### Inventory: Two-Step Conversion Process

**Step 1**: Convert balance sheet inventory to "inventory number of days"

**Step 2**: Project inventory days using historical averages

**Step 3**: Convert projected days back to Rupee value:

```
Projected Inventory = 2 x (Inventory Days x (Material Consumed / 365)) - Prior Year Inventory
```

### Other Current Assets
- **Trade receivables**: Projected as % of net sales
- **Loans and advances**: % of gross block
- **Investments**: % of gross block

### Cash and Bank Balance
**NOT projected directly** - derived from the Cash Flow Statement. This completes the full integration.

## Integration & Linkage Verification

### Data Interdependencies
1. **P&L drives Reserves**: PAT and appropriations flow to reserves schedule
2. **Reserves feed Balance Sheet**: Closing reserves become BS equity component
3. **Schedules drive both statements**: Asset schedule -> depreciation + gross block; Debt schedule -> interest + loan amounts
4. **Inventory links operations**: Material consumed drives inventory calculation

### Expected Outcome
Balance sheet gets balanced when cash and bank balance flows from cash flow statement back to balance sheet.

---

# Chapter 13: Cash Flow Statement (Indirect Method)

## Core Concept
The indirect method derives cash flow from P&L and Balance Sheet data. Derived cash flow should match the balance sheet's cash position (validation mechanism).

## Three Activity Categories

### 1. Operating Activities (Core Business)

```
PAT (Profit After Tax)
+ Depreciation (from Balance Sheet accumulated depreciation, NOT P&L)
+ Net Change in Working Capital
= Operating Cash Flow
```

#### Working Capital Adjustments

**Add (increases cash)**:
- Increase in current liabilities
- Increase in provisions
- Increase in deferred tax liabilities

**Subtract (decreases cash)**:
- Increase in inventory
- Increase in trade receivables
- Increase in other current assets
- Increase in loans/advances

**Logic**: Higher payables defer cash outflow; higher receivables lock up cash.

### 2. Investing Activities

```
- CAPEX (from Asset Schedule gross block, NOT net block)
+ Disposal of assets
- Increase in capital work-in-progress
- Increase in investments
+ Other non-current asset adjustments
= Investing Cash Flow
```

### 3. Financing Activities

```
+ Increase in share capital
+ Increase in borrowings (secured + unsecured)
- Dividends paid
- Dividend tax paid
- Past service costs of employee benefits
- Bonus share utilizations
= Financing Cash Flow
```

Note: One-time items (dividends, bonus shares) taken directly from annual figures, NOT year-over-year differences.

## Cash Balance Reconciliation

```
Opening Cash (previous year closing)
+ Net Cash Flow (Operating + Investing + Financing)
= Closing Cash Balance
```

**This closing balance MUST equal the balance sheet's cash position.** If it doesn't match, errors exist in the model.

## Critical Implementation Rules
- Extract depreciation from balance sheet/asset schedule, NOT P&L
- Begin calculations from Year 2 (Year 1 needs comparison baseline)
- Ensure formulas reference correct sheets
- Each balance sheet line must be assigned to one activity type

---

# Chapter 14: Valuation (Part 1) - Overview of Methods

## Three Primary Valuation Techniques

### 1. Relative Valuation (Comparable Company Analysis)

**Core Concept**: Companies with similar characteristics should have comparable valuations.

**Requirements for Valid Comparison**:
- Identical business type and products
- Similar size and scale
- Same geographic presence
- Comparable financials and growth
- Same regulatory environment

**Valid comparisons**: HDFC Bank vs ICICI Bank; Infosys vs TCS; Bajaj Auto vs Hero
**Invalid comparisons**: TCS vs HDFC Bank (different sectors)

**Methodology using P/E Multiple**:
```
If 3 similar car manufacturers trade at ~10x P/E:
Fair Price of 4th company = 10 x EPS of 4th company
```

**Key Multiples Used**:
- P/E (Price to Earnings)
- EV/EBITDA (Enterprise Value to EBITDA)
- P/B (Price to Book)
- P/S (Price to Sales)

**Limitations**:
- Markets may misprice entire industries (bubble scenarios)
- No two companies are truly identical
- Difficult to account for company-specific advantages

### 2. Option-Based Valuation

**Application**: When company value depends on specific event outcomes (e.g., success of new technology, drug trial results).

**Framework**: Uses options pricing theory where financial outcomes are contingent upon success criteria. Limited applicability; primarily for tech companies.

### 3. Absolute Valuation (DCF Framework) - PRIMARY METHOD

**Foundational Balance Sheet Relationship**:
```
Cash + Fixed Assets = Debt + Equity
```
Restructured:
```
Fixed Assets = Net Debt + Equity
```

**Two Approaches**:
- **Enterprise Value Method**: Values entire firm's assets; cash flows to ALL capital providers
- **Equity Value Method**: Values only equity portion; focuses on shareholder perspective

**Three Essential Components**:
1. Cash flow estimation (FCFF or FCFE)
2. Discount rate (WACC or Cost of Equity)
3. Cash flow timing (projection period)

**Fair Price Determination**:
- Overvalued: Market Price > Fair Price
- Undervalued: Market Price < Fair Price
- Fairly valued: Market Price ~ Fair Price

---

# Chapter 15: Valuation (Part 2) - FCFF & FCFE

## Free Cash Flow to Firm (FCFF)

### FCFF Formula (Starting from PAT)

```
FCFF = PAT
     + Depreciation & Amortization
     + Deferred Taxes
     + Interest Charges
     - Change in Working Capital
     - Change in Fixed Asset Investments (CAPEX)
```

### Component Breakdown

**Starting Point**: Profit After Tax (PAT)

**Non-Cash Additions**:
- Depreciation and amortization: accounting entries, not actual cash outflows - must be added back
- Deferred taxes: postponed tax payments, not actual cash outflows

**Interest Add-Back**: Interest is added because it was deducted before arriving at PAT. Since FCFF belongs to BOTH debt and equity holders, interest paid to debt holders must be restored.

**Working Capital Adjustment**:
- Increase in working capital = REDUCES free cash
- Decrease in working capital = FREES up cash

**Capital Expenditures**: Cash invested in long-term assets for future operations.

### FCFF Formula (Starting from EBIT)

```
FCFF = EBIT x (1 - Tax Rate)
     + Depreciation & Amortization
     + Deferred Taxes
     - Change in Working Capital
     - CAPEX
```

Both methods yield identical results when tax shields are properly applied.

## Free Cash Flow to Equity (FCFE)

```
FCFE = FCFF
     - Interest Payments
     - Principal Repayments
     + New Debt Issued
```

**Alternative derivation**:
```
FCFE = PAT
     + Depreciation & Amortization
     + Deferred Taxes
     - Change in Working Capital
     - Change in Fixed Assets
     - Principal Repayment
     + New Borrowing
```

**Also expressed as**:
```
FCFE = FCFF + Net Debt
Where: Net Debt = New Debt Issued - Principal Repayment
```

## Discount Rates

### For FCFF: Use WACC

```
WACC = (Weight of Debt x Cost of Debt) + (Weight of Equity x Cost of Equity)
```

**Example**:
- Debt = 125 Cr at 9%
- Equity = 225 Cr at 15%
- WACC = (9% x 125 + 15% x 225) / 350 = **13.85%**

### For FCFE: Use Cost of Equity

```
Cost of Equity = Risk-Free Rate + Risk Premium
```

The cost of equity is ALWAYS higher than WACC because equity holders assume greater risk than debt holders.

---

# Chapter 16: Valuation (Part 3) - Risk Premium & Tax Shield

## Cost of Equity via CAPM (Capital Asset Pricing Model)

```
Re = Rf + Beta x (Rm - Rf)
```

Where:
- **Re** = Required return on equity (Cost of Equity)
- **Rf** = Risk-free rate
- **Beta (B)** = Stock's systematic risk measure
- **Rm** = Expected market return
- **(Rm - Rf)** = Market Risk Premium (Equity Risk Premium)
- **Beta x (Rm - Rf)** = Stock-specific Risk Premium

### Risk-Free Rate (Rf)
Best proxy: **10-year Government bond yield**
- India reference: 10-year GoI bond yield (~7.46%)
- Assumes virtually zero default risk

### Market Rate (Rm)
Long-term market average return: typically **8-12%** depending on economic outlook.

### Beta (B)
Measures stock price sensitivity relative to market:
- Beta > 1: More volatile than market (higher risk)
- Beta = 1: Moves with market
- Beta < 1: Less volatile than market (lower risk)

### CAPM Example Calculation

```
Rf = 7.4586%
Beta = 1.3
Rm = 8.5%

Re = 7.4586% + 1.3 x (8.5% - 7.4586%)
Re = 7.4586% + 1.3 x 1.0414%
Re = 7.4586% + 1.3538%
Re = 8.81%
```

## Tax Shield on Interest

Interest payments reduce taxable income, creating a tax benefit.

### Interest Tax Shield Formula

```
Effective Interest = Interest x (1 - Tax Rate)
Tax Shield = Interest x Tax Rate
```

### Example Calculation

```
EBIT = 700 Cr
Interest = 70 Cr (10% rate)
Tax Rate = 25%

Without interest: Tax = 700 x 25% = 175 Cr
With interest: Tax = (700 - 70) x 25% = 630 x 25% = 157.5 Cr
Tax Shield = 175 - 157.5 = 17.5 Cr

Effective (post-tax) Interest = 70 x (1 - 25%) = 52.5 Cr
```

## Revised FCFF Formula with Tax Shield

### Method 1 (Starting with PAT):
```
FCFF = PAT + Depreciation + Amortization + Interest x (1 - Tax Rate) + Deferred Taxes - Working Capital Changes - CAPEX
```

### Method 2 (Starting with EBIT):
```
FCFF = EBIT x (1 - Tax Rate) + Depreciation + Amortization + Deferred Taxes - Working Capital Changes - CAPEX
```

Both methods yield identical results.

### FCFE from FCFF:
```
FCFE = FCFF + Net Debt
Where: Net Debt = New Borrowing - Principal Repayment
```

---

# Chapter 17: WACC Calculation & Terminal Growth

## WACC (Weighted Average Cost of Capital)

### Basic WACC Formula

```
WACC = (Wd x Kd) + (We x Ke)
```

Where:
- **Wd** = Weight of debt = Debt / (Debt + Equity)
- **Kd** = Cost of debt (pre-tax)
- **We** = Weight of equity = Equity / (Debt + Equity)
- **Ke** = Cost of equity (from CAPM)

### Example - Basic WACC

```
Debt = Rs. 300 Cr, Equity = Rs. 200 Cr
Debt holders expect 8%, Equity holders expect 12%
Total Capital = 500 Cr

Wd = 300/500 = 60%
We = 200/500 = 40%

WACC = (60% x 8%) + (40% x 12%) = 4.8% + 4.8% = 9.6%
```

### Tax-Adjusted WACC (Effective Cost of Debt)

```
Effective Cost of Debt = Kd x (1 - Tax Rate)
```

```
Tax-Adjusted WACC = (Wd x Kd x (1 - Tax Rate)) + (We x Ke)
```

### Example - Tax-Adjusted WACC

```
Original Cost of Debt = 8%
Tax Rate = 30%
Effective Cost of Debt = 8% x (1 - 30%) = 5.6%

Revised WACC = (60% x 5.6%) + (40% x 12%)
            = 3.36% + 4.8%
            = 8.16%
```

## WACC Selection for DCF

- **FCFF (Free Cash Flow to Firm)** --> Discount using WACC
- **FCFE (Free Cash Flow to Equity)** --> Discount using Cost of Equity (Ke)

## Terminal Value

### Concept
Beyond the detailed projection period (typically 5 years), the company is expected to generate cash at a steady rate indefinitely.

### Terminal Growth Rate
- Usually equal to the **long-term inflation rate** (typically 4-5% for India)
- Represents sustainable, perpetual growth
- DCF only functions with positive cash flows

### Terminal Value Formula (Gordon Growth / Perpetuity Method)

```
Terminal Value = C x (1 + g) / (r - g)
```

Where:
- **C** = Cash flow in the last projection year
- **g** = Terminal growth rate (long-term inflation rate)
- **r** = Discount rate (WACC for FCFF, Ke for FCFE)

### Critical Warning
"The DCF model is sensitive to the terminal value because the terminal value is a huge number, so any slight change in our assumption will significantly impact our final valuation."

---

# Chapter 18: Discounted Cash Flow Analysis (DCF) - Complete Model

## DCF Model Components

### 1. Initial Assumptions Setup

Key inputs:
- **Risk-free rate**: 10-year government bond yield (~7%)
- **Beta**: Stock-specific (e.g., 1.2 = above-average volatility)
- **Expected market return**: 10-12%
- **Cost of debt**: From debt schedule (e.g., 10%)
- **Tax rate**: Historical average (e.g., 25%)
- **Target debt-to-equity ratio**: Based on capital structure (e.g., 50%)
- **Terminal growth rate**: Long-term inflation (4-5%)

### 2. Cost of Capital Calculations

**Cost of Equity (CAPM)**:
```
Ke = Rf + Beta x (Rm - Rf)
```

**WACC**:
```
WACC = (Wd x Kd x (1 - Tax Rate)) + (We x Ke)
```

Using target debt-to-equity ratio for weights.

### 3. FCFF Calculation

```
FCFF = EBIT x (1 - Tax Rate)
     + Depreciation + Amortization
     - Working Capital Changes
     - CAPEX
```

Data sources:
- EBIT: From projected P&L
- Depreciation: From asset schedule / P&L
- Working capital changes: From cash flow statement
- CAPEX: From asset schedule

### 4. Terminal Value Computation

After 5 years of discrete cash flow projections:

```
Terminal Value = Year 5 FCFF x (1 + Terminal Growth Rate) / (WACC - Terminal Growth Rate)
```

This represents the sum of all cash flows from year 6 through perpetuity, discounted back to year 5.

### 5. Present Value and Discounting

Each future cash flow is converted to present value:

```
Discount Factor = 1 / (1 + WACC)^n
```

Where n = number of years from present.

```
Present Value of Cash Flow = FCFF x Discount Factor
```

**Example**:
```
Year 8 is 3 years from present day (if present = Year 5):
PV = 294.14 / (1 + 10.25%)^3 = 219.49 Cr
```

### 6. Enterprise Value Calculation

```
Enterprise Value = Sum of PV of all projected FCFF (Years 1-5) + PV of Terminal Value
```

### 7. Equity Value Bridge

```
Equity Value = Enterprise Value - Current Debt + Current Cash
```

Current debt and cash figures come directly from the latest balance sheet.

### 8. Per-Share Valuation

```
Fair Share Price = Equity Value / Number of Outstanding Shares
```

## Complete DCF Model Flow

```
Step 1: Project Revenue (5 years)
Step 2: Project Expenses and derive EBIT
Step 3: Calculate FCFF for each projected year
Step 4: Calculate Terminal Value at end of Year 5
Step 5: Determine WACC
Step 6: Discount all FCFFs and Terminal Value to present
Step 7: Sum = Enterprise Value
Step 8: Subtract Debt, Add Cash = Equity Value
Step 9: Divide by Shares Outstanding = Fair Share Price
Step 10: Compare to Market Price
```

## Sensitivity Analysis

The model demonstrates high sensitivity to key assumptions:

### Material Cost Sensitivity
```
Material costs at 65% of sales --> Share Price = Rs.300
Material costs at 60% of sales --> Share Price = Rs.462
Change of 5% in costs --> 54% change in fair value!
```

### Terminal Growth Sensitivity
```
Terminal growth at 4.0% --> Share Price = Rs.300
Terminal growth at 4.5% --> Share Price = Rs.323
Change of 0.5% --> 7.7% change in fair value
```

### Sensitivity Table Structure
Create a matrix varying two key assumptions:
- Rows: Different WACC values (e.g., 8%, 9%, 10%, 11%, 12%)
- Columns: Different terminal growth rates (e.g., 3%, 3.5%, 4%, 4.5%, 5%)
- Cell values: Resulting fair share price for each combination

## Fair Value Range (Margin of Safety)

Rather than treating point estimates as absolute:

```
Fair Value Range = Fair Price +/- 10% (modeling error band)
```

**Example**: Fair price = Rs.300
- Range: Rs.270 to Rs.330
- Buy if market price < Rs.270 (clearly undervalued)
- Sell if market price > Rs.330 (clearly overvalued)
- Hold if market price within range (fairly valued)

## Model Maintenance & Updates
- Any change in any number impacts the share price (fully integrated)
- Regular updates when new information arrives (quarterly results, management guidance)
- Scenario testing by changing key assumptions

---

# Summary: Complete Valuation Formula Reference

## Revenue Projection
```
Revenue(t) = Revenue(t-1) x (1 + Growth Rate)
Revenue(t) = Units(t) x Price(t)  [for unit-economics approach]
```

## Expense Projection
```
Expense(t) = Expense Ratio x Revenue(t)
```

## Profit Calculation
```
EBITDA = Revenue - Operating Expenses
EBIT = EBITDA - Depreciation - Amortization
PBT = EBIT - Interest Expense + Other Income
PAT = PBT - Tax
Tax = PBT x Average Historical Tax Rate
```

## Working Capital
```
Inventory Days = (Avg Inventory / Materials Consumed) x 365
Receivable Days = (Avg Receivables / Revenue) x 365
Payable Days = (Avg Payables / COGS) x 365
Working Capital Cycle = Inventory Days + Receivable Days - Payable Days
Change in WC = Current Year WC - Prior Year WC
```

## Asset Schedule
```
Closing Gross Block = Opening + CAPEX - Disposals
Depreciation Rate = Depreciation / Gross Block
Projected Depreciation = Rate x Projected Gross Block
Net Block = Gross Block - Accumulated Depreciation
```

## Debt Schedule
```
Closing Debt = Opening + New Issuance - Repayment
Avg Debt = (Opening + Closing) / 2
Interest Rate = Interest Expense / Avg Debt
Projected Interest = Rate x Projected Avg Debt
```

## Reserves Schedule
```
Closing Retained Earnings = Opening + PAT + OCI - Dividends - Dividend Tax
Total Equity = Share Capital + Securities Premium + Reserves + Retained Earnings
```

## Cash Flow (Indirect Method)
```
Operating CF = PAT + Depreciation + Change in WC (with sign adjustments)
Investing CF = -CAPEX + Disposals - Change in Investments
Financing CF = New Debt - Repayments + New Equity - Dividends
Net Cash Flow = Operating + Investing + Financing
Closing Cash = Opening Cash + Net Cash Flow
```

## Free Cash Flow
```
FCFF = EBIT(1-t) + D&A + Deferred Tax - Change in WC - CAPEX
FCFE = FCFF - Interest(1-t) - Repayments + New Debt
     = PAT + D&A + Deferred Tax - Change in WC - CAPEX + Net Debt
```

## CAPM (Cost of Equity)
```
Ke = Rf + Beta x (Rm - Rf)

Rf = 10-year Government Bond Yield
Beta = Covariance(Stock, Market) / Variance(Market)
Rm = Long-term expected market return (8-12%)
```

## WACC
```
WACC = Wd x Kd x (1-t) + We x Ke

Wd = Debt / (Debt + Equity)
We = Equity / (Debt + Equity)
Kd = Interest Rate on Debt
t = Tax Rate
```

## Terminal Value
```
TV = FCFF(last year) x (1 + g) / (WACC - g)

g = Terminal Growth Rate (= long-term inflation, ~4-5% India)
```

## DCF Valuation
```
Enterprise Value = Sum[ FCFF(t) / (1+WACC)^t ] + TV / (1+WACC)^n

Equity Value = Enterprise Value - Debt + Cash

Fair Share Price = Equity Value / Shares Outstanding
```

## Relative Valuation
```
P/E Ratio = Market Price / Earnings Per Share
EV/EBITDA = Enterprise Value / EBITDA
P/B Ratio = Market Price / Book Value Per Share
P/S Ratio = Market Price / Sales Per Share

Fair Price (P/E) = Peer Average P/E x Company EPS
Fair Price (EV/EBITDA) = (Peer Average EV/EBITDA x Company EBITDA - Debt + Cash) / Shares
```

## Sensitivity Analysis Framework
```
For each combination of (WACC_i, TerminalGrowth_j):
    Recalculate Enterprise Value
    Derive Fair Share Price
    Build 2D sensitivity matrix
```

## Fair Value Range (Margin of Safety)
```
Lower Bound = Fair Price x 0.90
Upper Bound = Fair Price x 1.10

Buy Signal: Market Price < Lower Bound
Sell Signal: Market Price > Upper Bound
Hold: Lower Bound <= Market Price <= Upper Bound
```

---

# Key Modeling Principles

1. **Integrated Model**: All financial statements are interconnected - changes cascade automatically
2. **Base Rule**: Closing balance of Year N = Opening balance of Year N+1 (applies to ALL schedules)
3. **Historical Basis**: 5 years of historical data forms the foundation for all projections
4. **Percentage-of-Sales**: Most P&L items projected as % of revenue
5. **Percentage-of-Gross-Block**: Most BS items projected as % of gross block
6. **Rolling Averages**: Historical ratios averaged for projection assumptions
7. **Conservative Approach**: When uncertain, err on the conservative side
8. **Validation**: Cash flow statement closing balance must match BS cash position
9. **Sensitivity**: Always test key assumptions - small changes can dramatically affect valuation
10. **Art + Science**: Financial modelling requires judgment, not just formulas
