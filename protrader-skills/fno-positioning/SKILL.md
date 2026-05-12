---
name: fno-positioning
description: Smart-money tracker via F&O option chain. PCR / max-pain / ATM IV classification. Only ~200 F&O stocks have data.
trigger: When user asks about derivatives positioning / "what are big players doing?"
---
# F&O OI Positioning
## Source
Standard derivatives-desk vocabulary. Indian prop shops use this daily.
## Signals
- **PCR > 1.3** (puts overwritten) → contrarian BULLISH
- **PCR < 0.7** (calls overwritten / FOMO) → contrarian BEARISH
- **Spot < maxPain by >2%** → magnet pulls UP toward expiry
- **Spot > maxPain by >2%** → magnet pulls DOWN toward expiry
- **ATM IV > 40** → elevated, event priced in
- **ATM IV < 18** → calm
## Tier output
BULLISH / NEUTRAL / BEARISH based on factor vote count.
## Data source
`_marketDataCache.optionData[sym]` — cached F&O option chain with PCR, max pain, ATM IV.
## Implementation
`computeFnoPositioning(f)` in kite-server.js.
