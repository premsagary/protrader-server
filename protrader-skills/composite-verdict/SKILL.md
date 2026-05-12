---
name: composite-verdict
description: ProTrader's horizon-aware composite. Reads Long-term / Momentum / Short-term horizon tiers FIRST; falls back to absolute pass count if horizons unavailable.
trigger: Final-stage roll-up. Always run last after all individual frameworks.
---
# Composite Verdict
## Inputs
All framework outputs + horizon tally outputs.
## Hard excludes (any one → AVOID regardless)
1. Promoter pledging > 40%
2. Surveillance: T2T / ASM Stage 2+ / GSM / Z group
3. Beneish M-Score flags manipulation
4. Altman DISTRESS (skipped for financials per canon)
5. Weinstein Stage 4
## Cascade (Sprint 5D — horizon-aware)
When ≥ 2 horizons evaluable:
- 2+ STRONG horizons → ⭐ STRONG BUY
- 1 STRONG + 1+ OK → ✅ BUY
- 1 STRONG + rest weak/unknown → ⏳ WATCH (long-only candidate)
- 0 STRONG + 2+ OK → ✅ BUY
- 1 OK + ≤ 1 WEAK → ⏳ WATCH
- else → ❌ AVOID

When < 2 horizons evaluable (sparse data):
- Pass count 7+ → STRONG BUY · 5+ → BUY · 3+ → WATCH · <3 → AVOID
- Non-clean-Stage-2 stocks downgrade one tier

## Why horizon-aware
Absolute pass count alone fails because many frameworks return UNKNOWN for sparse data — a stock with 2 STRONG horizons but only 2/9 frameworks fully qualifying still deserves Buy. The horizons already factor in pass-rate per timeframe.
## Implementation
`computeCompositeVerdict(analysis)` in kite-server.js.
