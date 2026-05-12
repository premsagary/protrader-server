---
name: altman-zscore
description: Bankruptcy probability score. Z ≥ 2.99 = SAFE, < 1.81 = DISTRESS (hard exclude). SKIPS financials (banks/NBFCs) — Altman model does not apply to them.
trigger: When user asks about bankruptcy risk / debt safety / "is this safe from going bust?"
---
# Altman Z-Score
## Source
Edward Altman, "Financial Ratios, Discriminant Analysis and the Prediction of Corporate Bankruptcy", Journal of Finance (1968). Z'' 1995 for non-manufacturers.
## Formulas
- **Z (manufacturers):** 1.2A + 1.4B + 3.3C + 0.6D + 1.0E · SAFE ≥ 2.99 · GREY 1.81-2.99 · DISTRESS < 1.81
- **Z'' (non-mfr services):** 6.56A + 3.26B + 6.72C + 1.05D · SAFE ≥ 2.60 · GREY 1.10-2.60 · DISTRESS < 1.10
- **Financials (banks/NBFCs/insurance):** NOT_APPLICABLE — Altman explicitly excluded
## Components
- A = Working Capital / Total Assets (liquidity)
- B = Retained Earnings / Total Assets (legacy profitability)
- C = EBIT / Total Assets (operating profit)
- D = Market Cap / Total Liabilities (solvency)
- E = Sales / Total Assets (efficiency, mfr only)
## Iron rule
DISTRESS zone = hard exclude regardless of other signals. Sprint 5A fixed financials being wrongly routed to Z'' which made them all DISTRESS.
## Implementation
`computeAltmanZScore(f)` in kite-server.js.
