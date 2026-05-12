---
name: sector-breadth
description: % of sector peers above 200 DMA. Validates Industry RS — high avg return + low breadth = 1-2 stocks pumping the index (fragile).
trigger: When user asks "is the sector broadly strong?" or to confirm sector RS signal.
---
# Sector Breadth
## Tiers
- ≥ 70% peers above 200dma → STRONG (broad uptrend)
- 50-70% → OK (mixed)
- 30-50% → WEAK (narrow leadership)
- < 30% → BEARISH (broad downtrend)
## Why this matters
A "Strong" Industry RS sector with 30% breadth = single-stock outlier, fragile. With 70%+ breadth = real broad uptrend.
## Implementation
`computeSectorBreadth(f)` in kite-server.js.
