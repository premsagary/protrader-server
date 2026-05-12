---
name: industry-rs
description: O'Neil's 3-level RS — leader of leaders. Sector ranked vs Nifty, stock ranked within sector. Qualifies if BOTH percentiles ≥ 80.
trigger: When user asks "is this leading its sector?" / momentum / swing-trade screening.
---
# Industry Relative Strength
## Source
William O'Neil, IBD's 197-industry-group methodology.
## Rule
"Buy the leading stock in the leading industry." Both must be in top 20%.
## Tiers
- Sector ≥ 90 AND stock ≥ 90 → ⭐ LEADER OF LEADERS
- Sector ≥ 80 AND stock ≥ 80 → Strong (qualifies)
- Sector ≥ 70 AND stock < 50 → ⚠ Weak stock in strong sector
- Sector < 50 AND stock ≥ 70 → ⚠ Strong stock in weak sector (drag risk)
## Caveat
We use broad SECTOR_MAP (~15 sectors), not IBD's 197 industry groups. Some signal lost — "Auto" averages 4-wheelers + 2-wheelers + ancillaries which behave differently.
## Implementation
`computeIndustryRS(sym, fund)` in kite-server.js.
