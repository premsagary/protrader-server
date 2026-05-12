---
name: sloan-accruals
description: (Net Income − CFO) / Total Assets. Negative = earnings backed by cash (HIGH QUALITY). Top decile (most positive) historically underperforms by ~10%/yr.
trigger: When user asks "earnings quality" / "are the profits real?"
---
# Sloan Accruals
## Source
Richard Sloan, "Do Stock Prices Fully Reflect Information in Accruals and Cash Flows about Future Earnings?", The Accounting Review (1996).
## Formula
Accruals = (Net Income − Cash from Operations) / Total Assets
## Tiers
- ≤ −0.05 → HIGH_QUALITY (cash > earnings)
- −0.05 to 0.05 → OK (typical range)
- 0.05 to 0.10 → CAUTION (earnings outpacing cash)
- > 0.10 → LOW_QUALITY (warning — earnings far ahead of cash)
## Backtest
Sloan: bottom decile beat top decile by ~10%/yr. Still robust globally.
## Implementation
`computeSloanAccruals(f)` in kite-server.js.
