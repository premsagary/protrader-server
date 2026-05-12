---
name: beneish-mscore
description: 8-variable earnings-manipulation probability score. M > -1.78 = likely manipulator → HARD EXCLUDE. Would have flagged Satyam, Manpasand, Enron, WorldCom pre-collapse.
trigger: When user asks "is the company cooking books?" / earnings quality / "should I trust the numbers?"
---
# Beneish M-Score
## Source
Messod Beneish, "The Detection of Earnings Manipulation", Financial Analysts Journal (1999).
## Formula
M = -4.84 + 0.92·DSRI + 0.528·GMI + 0.404·AQI + 0.892·SGI + 0.115·DEPI − 0.172·SGAI + 4.679·TATA − 0.327·LVGI
## Components
- DSRI = Days Sales in Receivables Index (receivables growing faster than sales = red flag)
- GMI = Gross Margin Index
- AQI = Asset Quality Index
- SGI = Sales Growth Index
- DEPI = Depreciation Index
- SGAI = SG&A Index
- TATA = Total Accruals to Total Assets (most predictive)
- LVGI = Leverage Index
## Thresholds
- M > −1.78 = LIKELY MANIPULATOR → hard exclude
- M between −2.22 and −1.78 = CAUTION grey zone
- M < −2.22 = CLEAN
## Backtest
Beneish: flagged ~75% of accounting frauds in his test set.
## Implementation
`computeBeneishMScore(f)` in kite-server.js. Needs many YoY fields; returns `tier: 'UNKNOWN'` when data insufficient.
