---
name: delivery-quality
description: Indian-market institutional accumulation proxy. % of trades resulting in delivery vs intraday flips. > 60% = institutional buyers dominant.
trigger: When user asks "are long-only buyers here?" / Indian retail vs institutional check.
---
# Delivery Quality
## Source
Marcellus's "informed-buyer" framework. Standard at every Indian PMS.
## Tiers
- ≥ 60% → INSTITUTIONAL (high-conviction accumulation)
- 45-60% → STRONG_HANDS (long-only buyers dominant)
- 30-45% → MIXED
- 20-30% → SPECULATIVE (short-term flippers dominant)
- < 20% → CHURN (pure speculation, no institutional)
## Why India-specific
US has real-time fund-ownership feeds. India doesn't — delivery % is the canonical proxy. NSE publishes daily delivery % via securityInfo endpoint.
## Data source
`_marketDataCache.deliveryData[sym].deliveryPct` — populated by NSE pre-open + intraday fetch.
## Implementation
`computeDeliveryQuality(f)` in kite-server.js.
