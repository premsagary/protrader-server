---
name: vcp
description: Volatility Contraction Pattern detection — progressive contractions with volume dry-up before breakout. Minervini's canonical setup. Use ONLY on stocks that pass Trend Template.
trigger: When user asks "is this setting up?" / "ready to break out?" / for entry timing on a Trend-Template-qualifying stock.
---
# VCP (Volatility Contraction Pattern)
## Source
Mark Minervini, "Trade Like a Stock Market Wizard" Ch 7.
## Rubric
- 2-6 successive contractions visible on daily chart
- Each contraction tighter than prior — ideally **halving** (25% → 12% → 6%)
- Volume **dries up** leg-over-leg
- Current price **in handle** — within 5% of pivot, range < 5%
- Pivot = recent High; breakout at pivot + ₹0.10 on heavy volume
## Two tiers in our implementation
- **Tier A** — real OHLC swing-pivot detection (when candles passed)
- **Tier B** — fundamental proxy (when no candles — looks at annualVol, change1m, pctFromHigh)
## Sequential workflow (Minervini)
1. Stock passes Trend Template (precondition)
2. Stock is in Stage 2 (Weinstein)
3. VCP forms in handle
4. Breakout above pivot on volume ≥ 40% above 50-day avg
5. ENTRY. Stop = -7% from entry (Minervini iron rule).
## Implementation
`detectVCP(f, candles)` + `_detectVCPFromCandles` in kite-server.js.
