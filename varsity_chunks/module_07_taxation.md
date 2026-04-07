# Module 7: Markets and Taxation

## Source: Zerodha Varsity
## Chapters: 8 (All extracted)

---

# Chapter 1: Introduction (Setting the Context)

## Overview
Taxation knowledge directly impacts trading profitability and compliance. This module is authored by Nithin Kamath (Zerodha founder) from a trader's perspective.

## Module Scope
- Short-term capital gains taxation
- Long-term capital gains taxation
- Speculative business income classification
- Non-speculative business income
- Section 44AD & 44ADA provisions
- ITR form filing requirements
- Turnover calculations and audit rules
- Foreign stock taxation

## Core Philosophy
- The IT department monitors all capital market activities through PAN linkage
- TIS (Taxpayer Information Summary) and AIS (Annual Information Summary) aggregate taxpayer information
- Only ~5% of Indians file returns; ~1% pay income tax
- The department actively sends notices for undeclared activities, sometimes years after the transaction

---

# Chapter 2: Basics

## 2.1 What is Income Tax?
"It is a tax levied by the Government of India on the income of every person" under the Income-tax Act, 1961.

## 2.2 Financial Year Structure
- **FY (Financial Year)**: Year income was earned (e.g., FY 2024/25 = April 1, 2024 to March 31, 2025)
- **AY (Assessment Year)**: Filing year (e.g., AY 2025/26 for FY 2024/25 income)

## 2.3 Income Tax Slabs (FY 2024/25)

### Old Regime - Individual (up to 60 years)
| Income Slab | Tax Rate |
|---|---|
| 0 to Rs 2.5L | NIL |
| Rs 2.5L - 5L | 5% of excess over Rs 2.5L |
| Rs 5L - 10L | Rs 12,500 + 20% of excess over Rs 5L |
| Above Rs 10L | Rs 1,12,500 + 30% of excess over Rs 10L |

### Old Regime - Senior Citizen (60-80 years)
| Income Slab | Tax Rate |
|---|---|
| 0 to Rs 3L | NIL |
| Rs 3L - 5L | 5% of excess over Rs 3L |
| Rs 5L - 10L | Rs 10,000 + 20% of excess over Rs 5L |
| Above Rs 10L | Rs 1,10,000 + 30% of excess over Rs 10L |

### Old Regime - Super Senior (80+ years)
| Income Slab | Tax Rate |
|---|---|
| 0 to Rs 5L | NIL |
| Rs 5L - 10L | 20% of excess over Rs 5L |
| Above Rs 10L | Rs 1,00,000 + 30% of excess over Rs 10L |

### New Regime (Budget 2024)
| Income Slab | Tax Rate |
|---|---|
| 0 to Rs 3L | NIL |
| Rs 3L - 7L | 5% of excess over Rs 3L |
| Rs 7L - 10L | Rs 20,000 + 10% of excess over Rs 7L |
| Rs 10L - 12L | Rs 50,000 + 15% of excess over Rs 10L |
| Rs 12L - 15L | Rs 80,000 + 20% of excess over Rs 12L |
| Above Rs 15L | Rs 1,40,000 + 30% of excess over Rs 15L |

### Standard Deductions
- Old Regime: Rs 50,000
- New Regime: Rs 75,000

### Rebates
- Old Regime: 5% rebate up to Rs 12,500 for income Rs 2.5L-5L
- New Regime: Rs 25,000 rebate for taxable income under Rs 7L (residents only)

## 2.4 Surcharge (All Regimes)
| Income Range | Surcharge Rate |
|---|---|
| Rs 50L - 1Cr | 10% |
| Rs 1Cr - 2Cr | 15% |
| Rs 2Cr - 5Cr | 25% |
| Above Rs 5Cr | 37% |

**Exception**: Maximum 15% surcharge on capital gains and dividends.

## 2.5 Health and Education Cess
**4%** calculated on income tax plus surcharge (if applicable).

## 2.6 Marginal Relief
Prevents excess tax when income crosses threshold amounts (Rs 50L, Rs 1Cr, Rs 2Cr, Rs 5Cr). Net tax liability cannot exceed threshold tax plus income exceeding threshold.

---

# Chapter 3: Classifying Your Market Activity

## 3.1 Five Income Classification Heads
1. **Long-term Capital Gain (LTCG)**
2. **Short-term Capital Gain (STCG)**
3. **Speculative Business Income**
4. **Non-speculative Business Income**
5. **Dividend Income**

## 3.2 LTCG (Long-Term Capital Gain)
**Definition**: Profit from stocks/equity mutual funds held longer than 365 days.

### Tax Rates (Listed Equities with STT):
| Period | Rate | Exemption |
|---|---|---|
| Before July 23, 2024 | 10% | First Rs 1.25 lakh exempt |
| On/after July 23, 2024 | 12.5% | First Rs 1.25 lakh exempt |

### Unlisted Stocks:
| Period | Rate | Indexation |
|---|---|---|
| Before July 23, 2024 | 20% | With indexation |
| On/after July 23, 2024 | 12.5% | Without indexation |

### Grandfather Clause (2018 Budget)
For shares held before January 1, 2018: Acquisition cost = higher of (actual purchase price) OR (maximum traded price on January 31, 2018).

## 3.3 STCG (Short-Term Capital Gain)
**Definition**: Profit from delivery-based equity holdings between 1 day and 12 months.

| Period | Rate |
|---|---|
| Before July 23, 2024 | 15% flat |
| On/after July 23, 2024 | 20% flat |

## 3.4 Speculative Business Income
**Definition**: Profits earned by trading equity or stocks for intraday or non-delivery (Section 43(5), Income Tax Act 1961). Currency trading also qualifies.

**Tax Treatment**: Added to total income; taxed per applicable slab rates.

## 3.5 Non-Speculative Business Income
**Definition**: Income from futures & options trading on recognized exchanges (equity, commodity).

**Tax Treatment**: Added to all other income; taxed per applicable slab.

## 3.6 Dividend Income
**Current Status**: Taxable per applicable slab rates.

**Share Buyback Rule** (October 1, 2024 onwards): Treated as dividend with no expense deductions allowed.

## 3.7 Business Income Advantages
1. Low tax for income below Rs 7L (effectively zero with rebate)
2. Expense deductions: brokerage, STT, internet, phone, research, depreciation
3. Non-speculative F&O losses can offset rent/interest income (same year)
4. F&O losses carry forward 8 years against business income
5. Intraday speculative losses carry forward 4 years (only against speculative gains)

## 3.8 Business Income Disadvantages
1. 30% slab for high earners
2. Complex ITR-3 or ITR-4 required
3. Audit required if turnover exceeds Rs 10 crore OR profit < 6% of turnover

## 3.9 Loss Offset Rules Summary

| Loss Type | Same-Year Offset (Other Heads) | Same-Year Offset (Same Head) | Carry Forward | Duration |
|---|---|---|---|---|
| F&O / Non-Speculative Business | Yes | Yes | Yes | 8 years |
| Speculative / Intraday Equity | No | Yes | Yes | 4 years |
| STCG Loss | No | Yes (STCG + LTCG) | Yes | 8 years |
| LTCG Loss | No | Yes (LTCG only) | Yes | 8 years |

## 3.10 Classification Guidelines
- **F&O & Intraday Equity**: Mandatory business income classification; use ITR-3
- **Equity Delivery (Long-term, >1yr)**: Show as LTCG capital gains
- **Equity Delivery (Short-term, Low Frequency)**: Can claim as STCG capital gains
- **Equity Delivery (High Frequency)**: Best declared as non-speculative business income
- **Dual Status**: Permissible to be trader (F&O/intraday) AND investor (long-term) simultaneously
- Consistency required across years; switching classifications invites scrutiny

---

# Chapter 4: Taxation for Investors

## 4.1 LTCG Tax Rates

### Stocks/Equity (Exchange-Traded with STT)
| Period | Rate | Exemption |
|---|---|---|
| Before July 23, 2024 | 10% | First Rs 1.25L exempt |
| After July 23, 2024 | 12.5% | First Rs 1.25L exempt |

### Off-Market Transfers (via DIS without STT)
LTCG taxation: **20%** for both listed and unlisted stocks.

### Gift Treatment
Gift from a relative through DIS slip is not a capital gain transaction. Qualifying relatives: spouse, siblings, parents, lineal descendants.

### Non-Equity/Debt Mutual Funds
- Holding Period for long-term: 3 years (changed from 1 year in 2014 Budget)
- LTCG Tax Rate: 20% with indexation benefit
- Post April 1, 2023: Debt funds investing <=35% in Indian equity taxed at slab rates without indexation

### Cryptocurrency/Virtual Digital Assets
Flat **30%** on gains regardless of holding period.

## 4.2 Indexation

### Formula
```
Indexed Purchase Value = Purchase Price x (CII Year of Sale / CII Year of Purchase)
```

### Policy Changes (Budget 2024)
Indexation eliminated on all investments except real estate investments made before July 23, 2024.
For eligible property: Choose between 20% LTCG with indexation (old regime) OR 12.5% without indexation (new regime).

### Sample CII Values
| Financial Year | CII |
|---|---|
| 2015-16 | 254 |
| 2020-21 | 301 |
| 2024-25 | 363 |

## 4.3 STCG Tax Rates

### Stocks/Equity (Exchange-Traded)
| Period | Rate |
|---|---|
| Before July 23, 2024 | 15% |
| After July 23, 2024 | 20% |

### Debt Mutual Funds
Taxed at applicable individual income tax slab rates.

### Cryptocurrency/Virtual Digital Assets
Flat **30%** on gains.

## 4.4 FIFO (First-In-First-Out) Method
When purchasing identical stocks multiple times, earlier purchases are considered sold first.

**Example:**
- April 10, 2014: Buy 100 shares @ Rs 800
- June 1, 2014: Buy 100 shares @ Rs 820
- May 1, 2015: Sell 150 shares @ Rs 920
- Result: 100 shares from April (LTCG): Rs 120 x 100 = Rs 12,000 (exempt)
- 50 shares from June (STCG): Rs 100 x 50 = Rs 5,000 (15% tax)

## 4.5 Securities Transaction Tax (STT)
- Current rate for equity delivery: **0.1%** of trade value
- STT CANNOT be added to cost of acquisition or deducted from sale value
- Brokerage and other charges (excluding STT) ARE deductible expenses

## 4.6 Advance Tax Requirements (STCG)
| Due Date | Cumulative % of Annual Tax |
|---|---|
| June 15 | 15% |
| September 15 | 45% |
| December 15 | 75% |
| March 15 | 100% |

Non-payment attracts ~**12% annualized interest** penalty.

## 4.7 Capital Losses
- **STCL**: Carry forward 8 years; set off against both STCG and LTCG
- **LTCL**: Set off against LTCG only
- **Cryptocurrency**: Losses CANNOT be offset against any income, including crypto gains; cannot carry forward

## 4.8 ITR Form Selection
- **ITR-2**: Salaried individuals with capital gains (no business income)
- **ITR-3**: Business income combined with capital gains

---

# Chapter 5: Taxation for Traders

## 5.1 Classification
- **Speculative Business Income (Code 21009)**: Intraday equity trading
- **Non-Speculative Business Income (Code 21010)**: F&O trading on all exchanges, high-frequency equity delivery

## 5.2 Tax Calculation
Business income combines with salary and other income, then taxed per applicable slabs.

**Example**: Salary Rs 10L + F&O profit Rs 1.5L + intraday gain Rs 1.25L = taxable income Rs 12.75L

## 5.3 Loss Carry-Forward Rules
- **Speculative losses**: Carry forward up to **4 years**; set off ONLY against speculative gains
- **Non-speculative losses**: Carry forward up to **8 years**; set off against non-speculative gains; can offset other business income same year (except salary)

**Critical Rule**: Speculative (intraday equity) loss CANNOT offset non-speculative (F&O) gains, but speculative gains CAN be offset with non-speculative losses.

## 5.4 Advance Tax Requirements (same schedule as investors)
| Due Date | Cumulative % |
|---|---|
| June 15 | 15% |
| September 15 | 45% |
| December 15 | 75% |
| March 15 | 100% |

Penalty: **12% annualized** for non-payment.

## 5.5 Tax Audit Triggers
- Business turnover exceeds **Rs 10 crores** (FY 2024-25)
- Equity traders declaring profits below **6% of turnover** under presumptive taxation

## 5.6 Deductible Business Expenses
- Trading charges (STT, brokerage, exchange fees)
- Internet/phone bills (proportionate usage)
- Computer/electronics depreciation
- Rental expenses (proportionate if shared space)
- Professional salaries
- Advisory fees, books, subscriptions

## 5.7 BTST (Buy Today Sell Tomorrow) Treatment
- If infrequent: classified as non-speculative/STCG
- If frequent: show as speculative business income

## 5.8 ITR Filing
Traders MUST file **ITR-3** form. Must maintain complete balance sheet and P&L statements.

---

# Chapter 6: Turnover, Balance Sheet, and P&L

## 6.1 Turnover & Tax Audit Requirements

### When Audit is Required:
1. Turnover exceeds **Rs 10 crores** (100% digital transactions)
2. Section 44AD: Opted out of presumptive taxation when profit < 6% of turnover AND overall income > basic exemption limit

**Key**: "Turnover does not affect tax liability; it only determines audit necessity."

## 6.2 Business Turnover Calculation

### Delivery-Based Transactions
- Turnover = Total selling value
- Example: Buy 100 Reliance @ Rs 800, sell @ Rs 820 = Rs 82,000 turnover

### Speculative Transactions (Intraday Equity)
- Turnover = Aggregate of absolute differences (profits + losses)
- Example: Buy 100 @ 800, sell @ 820 = Rs 2,000 turnover (NOT Rs 82,000)

### Non-Speculative Transactions (F&O)
- Turnover = Total of favorable + unfavorable differences (absolute sum)
- Premium received on option sales included in turnover
- Open positions at FY-end: squared off in settlement year

### Futures Turnover Example:
- Trade 1: Buy 100 Nifty @ 26,000, sell @ 26,100 = Profit Rs 10,000
- Trade 2: Buy 100 Nifty @ 26,100, sell @ 26,050 = Loss Rs 5,000
- **Total turnover = Rs 15,000** (sum of absolute values)

### Options Turnover Example:
- Trade 1: Buy 100 puts @ 1,000, sell @ 950 = Loss Rs 5,000
- Trade 2: Buy 100 puts @ 500, sell @ 480 = Loss Rs 2,000
- **Total turnover = Rs 7,000**

### Trade-Wise vs Scrip-Wise Calculation
| Method | Approach | Compliance Level |
|---|---|---|
| **Trade-Wise** | Sum absolute P&L for each trade | Most compliant |
| **Scrip-Wise** | Average buy/sell per contract, then calculate | Less compliant |

## 6.3 Section 44AD (Presumptive Taxation)

### Audit Triggers Under 44AD:
- Turnover < Rs 10 Crore AND profit < 6% of turnover AND overall income > basic exemption limit
- Previously opted for Section 44AD; now opting out

### Exception:
No audit needed if total tax liability = zero (total income below slab limit).

## 6.4 Balance Sheet Components

### Assets:
Cash, bank deposits, investments (MFs, shares, bonds), property, vehicles, personal property (jewelry, household), computers, loans extended, land

### Liabilities:
Mortgage balance, car/personal loans, credit card balances, outstanding debts

### Formula:
```
Net Worth = Assets - Liabilities
```

## 6.5 P&L Statement

### Revenue:
Realized sale value from stock holdings, income from F&O, intraday, commodity trades

### Expenses:
Salaries, office rent, brokerage charges and taxes, advisory fees, computer depreciation

### Formula:
```
Profit = Revenue - Expenses
```

## 6.6 Book-Keeping Requirements
1. **Bank Book**: Excel download of bank statements with transaction nature notes; retain all expense bills
2. **Trading Book**: Automatically maintained by broker (P&L statement, ledger, contract notes)

---

# Chapter 7: ITR Forms (The Finale)

## 7.1 Paying Taxes vs Filing Returns
- **Paying**: Occurs through TDS when employed
- **Filing**: Formally communicates all income sources via ITR forms; mandatory regardless of additional tax owed

## 7.2 ITR Form Selection Guide

| Form | Use Case | Restrictions |
|---|---|---|
| **ITR-1** | Salary, interest, single house property (up to Rs 50L) | No capital gains or business income |
| **ITR-2** | Salary, interest, house property, capital gains | No business/profession income |
| **ITR-3** | All income heads including business/profession | Most comprehensive |
| **ITR-4** | Presumptive taxation (Section 44AD) only | No capital gains, no loss carry forward |

## 7.3 Presumptive Income Scheme (Section 44AD)

### Key Rules:
- Declare **6%** of business turnover as presumptive profit
- Turnover limit: Up to **Rs 3 crores** (FY 2023-24 onwards with 95% digital receipts)
- Previous limit: Rs 2 crores
- Eliminates need for detailed books of accounts and mandatory audit
- Advance tax payment required only by **March 15th**
- **Once opted out of 44AD, cannot re-enter for 5 consecutive financial years**

## 7.4 Filing Deadlines and Penalties

| Deadline | Condition |
|---|---|
| **July 31st** | Without audit |
| **September 30th** | With audit |
| Within 1 year of FY end | Belated return |

### Penalty Structure:
- Late filing: **Rs 1,000** (income <= Rs 5L) or **Rs 5,000** (above Rs 5L)
- Updated return (Section 139(8A)): Additional **25% tax** if filed within 12 months of AY; **50%** if within 24 months

## 7.5 Decision Tree for Traders
1. Only capital gains + salary: **ITR-2**
2. Trading income (business) + other income: **ITR-3**
3. Trading income < 6% turnover + turnover < Rs 3Cr: Consider **ITR-4 with 44AD**
4. Multiple income types (salary + trading + investments): **ITR-3**

## 7.6 Loss Carry Forward Requirements
- F&O losses: up to **8 years**
- Speculative losses: up to **4 years**
- **MUST file return before due date** to claim carry forward
- Set-off is mandatory; cannot be deferred

---

# Chapter 8: Foreign Stocks and Taxation

## 8.1 Rules for Global Investing

### Liberalised Remittance Scheme (LRS)
- Annual limit: **USD 2.5 lakh** per financial year
- Covers all foreign spending (investments, education, travel, etc.)

### Tax Collection at Source (TCS)
- Rate: **20%** (previously 5% before October 2023)
- Trigger: Foreign spending exceeding **Rs 7 lakh** annually (Rs 10 lakh from FY25)
- Budget 2024: Salaried employees can offset TCS against TDS on salary

### Remittance Requirements
- Sale proceeds must return to India within **180 days**
- Exception: Funds reinvested abroad within 180 days
- Funds cannot remain idle in foreign accounts

### Disclosure
- All foreign assets MUST be disclosed in ITR
- Non-disclosure carries penalties under Black Money Act, 2015

## 8.2 Residency Status
**Indian Resident**: Must pay taxes on global (worldwide) income.

**Qualification Criteria:**
- Stayed in India **182+ days** in a financial year, OR
- Stayed **60+ days** in current year AND **365+ days** in preceding 4 years

## 8.3 Tax on Foreign Stocks - Capital Gains

### Holding Period Classification
- **LTCG**: 24+ months holding
- **STCG**: Up to 24 months

### Tax Rates (Post July 23, 2024)
| Category | Rate | Notes |
|---|---|---|
| LTCG | 12.5% | No indexation benefit |
| STCG | Slab rate | Added to total income |

### Previous Rules (April 1 - July 22, 2024)
- LTCG: 20% with indexation benefit
- STCG: Slab rate

### Exchange Rate Conversion
- Use SBI **telegraphic transfer (TT) buying rate**
- Applied on last day of month preceding transaction month
- Applied to both purchase cost and sale proceeds

## 8.4 Tax on Dividends
- Classification: Income from other sources
- Taxation: Added to total income, taxed at applicable slab rate

## 8.5 Foreign ETF Taxation

### Non-India Domiciled Foreign ETFs (FY25)
- All capital gains taxed at slab rate; holding period irrelevant

### From April 1, 2025 onwards:
- LTCG (24+ months): 12.5% without indexation
- STCG (< 24 months): Slab rate

### India-Listed ETFs (Foreign Securities) from April 1, 2025:
- Holding period: **12 months** (vs 24 for direct stocks)
- LTCG: 12.5%; STCG: Slab rate

## 8.6 DTAA (Double Taxation Avoidance Agreement)

### US-India DTAA:
- **Capital Gains**: US doesn't tax non-residents on capital gains; gains taxed only in India
- **Dividends**: Taxed only in India per DTAA; US withholds 25% at source; claim credit via Form 67

## 8.7 Reporting Foreign Assets in ITR

### Required Schedules:
- **Schedule FA**: Foreign asset details
- **Schedule FSI**: Foreign source income
- **Schedule TR**: Transaction details
- **Form 67**: Foreign tax credit claim

### Calendar Year Rule
Calendar year relevant for REPORTING; financial year for TAXATION.

## 8.8 Key Special Rules

### No Rs 1.25 Lakh Exemption
Foreign stock LTCG is NOT eligible for the Rs 1.25 lakh exemption (applies only to domestic equity).

### Cross-Border Loss Adjustment
- Foreign stock losses CAN offset Indian stock gains
- Indian stock losses CAN offset foreign stock gains
- Same STCL/LTCL rules apply

### Section 54F
LTCG from foreign stocks can qualify for relief if reinvested in Indian residential property (holding 24+ months, property handover within 3 years).

### FIFO Method
Recommended for dematerialized holdings without specific lot identification (Circular No. 768, June 24, 1998).

### RSU/ESOP Treatment
- Vesting date = acquisition date
- Perquisite value added to cost base
- Subject to same LTCG/STCG rules

---

# Quick Reference: Key Tax Rates Summary

| Income Type | Tax Rate | Notes |
|---|---|---|
| LTCG (Equity, listed, STT paid) | 12.5% (post July 23, 2024) | First Rs 1.25L exempt |
| STCG (Equity, listed, STT paid) | 20% (post July 23, 2024) | Flat rate |
| Intraday Equity (Speculative) | Slab rate | Added to total income |
| F&O Trading (Non-Speculative) | Slab rate | Added to total income |
| Dividends | Slab rate | Income from other sources |
| Debt MF LTCG (>3 years) | 20% with indexation | Pre-April 2023 purchases |
| Debt MF (post April 2023) | Slab rate | No indexation |
| Cryptocurrency | 30% flat | No loss offset allowed |
| Foreign Stock LTCG (>24 months) | 12.5% | No indexation, no Rs 1.25L exemption |
| Foreign Stock STCG | Slab rate | Added to total income |

# Quick Reference: Key Thresholds

| Threshold | Value | Purpose |
|---|---|---|
| Turnover for mandatory audit | Rs 10 Crores | Tax audit trigger |
| Presumptive profit minimum | 6% of turnover | Below triggers audit |
| 44AD turnover limit | Rs 3 Crores (95% digital) | Presumptive scheme eligibility |
| STT on equity delivery | 0.1% | Securities Transaction Tax |
| Advance tax penalty interest | 12% annualized | Non-payment penalty |
| LRS annual limit | USD 2.5 lakh | Foreign remittance cap |
| TCS threshold | Rs 10 lakh (FY25) | Foreign spending |
| LTCG exemption (domestic equity) | Rs 1.25 lakh | Annual exemption |
| Late filing penalty | Rs 1,000 or Rs 5,000 | Based on income level |
