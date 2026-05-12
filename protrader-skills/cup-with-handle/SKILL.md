---
name: cup-with-handle
description: Cup-with-Handle pattern (O'Neil). Currently a fundamental proxy — does NOT do real U-shape geometry. Labeled "method: fundamental-proxy" in output.
trigger: When user asks about "cup pattern" / O'Neil-style base detection.
---
# Cup-with-Handle (proxy)
## Source
William O'Neil, "How to Make Money in Stocks".
## Canonical rubric (NOT fully implemented)
- Prior uptrend ≥ 30% over ≥ 12 weeks
- Cup depth 12-33% from left rim, U-shape (not V), duration ≥ 7 weeks
- Handle in upper half of cup, ≤ 15% retrace, declining volume
- Breakout above pivot on volume ≥ 40% above 50-day avg
## What we actually check (proxy)
- 6m return > 30% (proxy for "prior uptrend")
- pctFromHigh in 5-15% (proxy for "handle zone")
- RSI ≤ 70 (handle should be calmer)
- volRatio ≤ 1.5 (volume should be drying)
## Limitations
We don't have U-shape geometry detection yet. The function returns `method: 'fundamental-proxy'` to acknowledge this. Real cup detection would need swing-pivot analysis similar to VCP Tier-A.
## Implementation
`detectCupWithHandle(f)` in kite-server.js.
