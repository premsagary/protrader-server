---
name: piotroski-fscore
description: Score fundamental quality 0-9 per Piotroski's 9 binary checks. Score ≥ 8 = high-quality balance sheet. Designed for VALUE stocks (bottom book-to-market quintile) — apply with a value gate.
trigger: When user asks about balance sheet quality, asks "is this fundamentally strong?", or filtering for long-only investment candidates.
---

# Piotroski F-Score

## Source
Joseph Piotroski, "Value Investing: The Use of Historical Financial Statement Information to Separate Winners from Losers", Journal of Accounting Research (2000).

## Rubric (9 binary checks)

**Profitability (4):**
1. Positive Net Income (current year)
2. Positive ROA
3. Positive Operating Cash Flow
4. OCF > Net Income (earnings quality — accruals not pumping income)

**Leverage / liquidity (3):**
5. LT Debt not increasing YoY
6. Current Ratio improving YoY
7. No significant share dilution (issued shares ≤ 1% growth YoY)

**Operating efficiency (2):**
8. Gross Margin improving YoY
9. Asset Turnover improving YoY

## Inputs needed
- Current + prior-year financials: `netIncome`, `roa`, `operatingCashFlow`, `ltDebt`/`ltDebtPrev`, `currentRatio`/`currentRatioPrev`, `sharesOutstanding`/`sharesOutstandingPrev`, `grossMargin`/`grossMarginPrev`, `assetTurnover`/`assetTurnoverPrev`

## Output schema
```js
{
  passed: 0-9,
  total: 9,
  qualifies: passed >= 8 && dataCompleteness >= 0.7,
  criteria: [...],
  tier: 'STRONG' | 'NEUTRAL' | 'WEAK',
  score: 0-100
}
```

## Threshold
- F-Score ≥ 8 = HIGH quality (Piotroski's "winners")
- F-Score ≤ 3 = LOW quality (Piotroski's "losers")
- 4-7 = middling

## Caveats
- Designed for VALUE stocks (bottom book-to-market quintile). Applied to full universe, alpha thins.
- Use as one signal in the long-term horizon, not standalone.

## Backtest result
Piotroski showed F ≥ 8 stocks outperformed S&P by +13.4%/year over 1976-1996. Robust across markets and decades.

## Implementation
`computePiotroskiFScore(f)` in kite-server.js.
