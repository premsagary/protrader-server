---
name: accumulation-distribution
description: Institutional buying signal. 25-day window count of (up ≥ 0.3% on heavy volume) minus (down ≥ 0.3% on heavy volume). Net positive = accumulating.
trigger: When user asks "are institutions buying this?" / volume-confirmed trend.
---
# Accumulation/Distribution Days
## Source
William O'Neil / IBD methodology.
## Canonical parameters (Sprint 5A recalibrated)
- 25-day rolling window (was 50)
- ±0.3% close threshold (was 0.5% — bumped from US 0.2% for Indian noise)
- Volume vs PRIOR DAY (was 50-day avg)
## Tiers
- Net ≥ 5 → ⭐ STRONG ACCUMULATION (institutional buying)
- Net ≥ 2 → ✅ Mild accumulation
- Net 0 to −4 → ⚠ Mild distribution
- Net ≤ −5 → 🚨 HEAVY DISTRIBUTION
## IBD's actual usage
Applied primarily to **indices** (Nifty / Bank Nifty) to drive the CANSLIM "M" market-direction signal. Per-stock A/D is a secondary check.
## Implementation
`computeAccumulationDistribution(candles)` in kite-server.js. Needs daily candles.
