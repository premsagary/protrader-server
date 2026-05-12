---
name: promoter-pledging
description: Indian-market specific tail-risk filter. Promoter pledge > 40% = HARD EXCLUDE. Would have caught Zee, Vakrangee, Anil Ambani group, DHFL, Cox & Kings.
trigger: ALWAYS run on Indian stocks. Single biggest small/mid-cap blow-up signal.
---
# Promoter Pledging Filter
## Source
Marcellus PMS, Unifi Capital — both use this as iron-rule filter. Standard at every Indian fund desk.
## Tiers
- > 40% → CRITICAL → hard exclude regardless of other signals
- 20-40% → HIGH_RISK → flag, proceed with caution
- 10-20% → WATCH → monitor for increases
- ≤ 10% → OK / CLEAN
## Why critical for India
Indian small/mid-cap collapses cluster heavily on this signal. Promoter pledged shares with banks for personal loans; margin calls force forced-sells, share price tanks, more margin calls, death spiral.
## Data source
NSE/BSE shareholding pattern (quarterly disclosure). Field is `f.pledged` in our system.
## Implementation
`computePromoterPledgeRisk(f)` in kite-server.js.
