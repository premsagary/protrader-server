---
name: magic-formula
description: Greenblatt's "cheap by quality" rank. Top 30% by combined Earnings Yield × Return on Capital. Excludes financials and utilities.
trigger: When user asks "is this undervalued?" / "value + quality screen" / long-term investor lens.
---
# Magic Formula
## Source
Joel Greenblatt, "The Little Book That Beats the Market" (2006).
## Formula
- **Earnings Yield** = EBIT / Enterprise Value · (EV = MktCap + Debt − excess cash)
- **Return on Capital** = EBIT / (Working Capital + Net Fixed Assets, excl. goodwill)
- Rank universe by EY desc, by ROC desc. Combined rank = EY rank + ROC rank.
- Qualifies if top 30% by combined rank.
## Excludes (canon)
- Financials (banks/NBFCs/insurers) — working capital undefined
- Utilities — regulated, doesn't fit
## Backtest
Greenblatt: 30.8%/yr top-30 stocks vs 12% S&P (1988-2004).
## Implementation
`computeMagicFormulaRank(symbol, fund)` in kite-server.js.
