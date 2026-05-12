---
name: pead-earnings
description: Post-Earnings Announcement Drift detector + earnings-imminent flag. Most-replicated academic anomaly. Gap > 3% on 2× volume = PEAD setup.
trigger: When user asks "did this just report?" / "what about earnings?" / for breakout follow-through.
---
# PEAD + Earnings Proximity
## Source
Bernard & Thomas 1989 PEAD anomaly. IBD's literal "earnings gap up on volume" buy trigger.
## Two signals
1. **PEAD active**: gap > 3% on 2× volume in last 5 sessions → setup
2. **Earnings imminent**: f.nextEarningsDate within 5 trading days → WAIT (don't enter pre-earnings)
## Output tiers
- WAIT_EARNINGS — earnings in ≤ 5 days
- PEAD_ACTIVE — recent gap on volume
- MILD_STRENGTH — recent gap weak (1.5-3% on 1.5× volume)
- NEUTRAL — no signal
## Backtest
PEAD has been the most replicated equity anomaly in finance academia — earnings surprises continue trending 3-9 months. IBD turned it into a trade trigger.
## Implementation
`computeEarningsContext(f, candles)` in kite-server.js.
