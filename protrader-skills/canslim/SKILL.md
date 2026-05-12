---
name: canslim
description: 7-letter growth + momentum rubric (Current earnings, Annual earnings, New high, Supply/demand, Leader, Institutional, Market direction). Qualifies if ≥6 of 7 letters score ≥70.
trigger: When user asks "is this a CANSLIM stock?" / "growth + momentum filter" / for swing-trade screening.
---
# CANSLIM (William O'Neil)
## Source
William O'Neil, "How to Make Money in Stocks", IBD methodology.
## The 7 letters
- **C** — Current quarterly EPS YoY ≥ 25% (ideally accelerating QoQ)
- **A** — Annual EPS growth ≥ 25% over 3y AND ROE ≥ 17%
- **N** — New: at actual 52-week high (within 2-3%), new product / new mgmt
- **S** — Supply/demand: small free float (not market cap), volume > 1.5× avg
- **L** — Leader: RS rating ≥ 80 (top 20% vs Nifty 6m)
- **I** — Institutional sponsorship: promoter holding, FII/DII flows, delivery %
- **M** — Market direction: VIX not panic + Nifty trending + breadth healthy
## Output
`computeCanslim(f) → { letters: {C,A,N,S,L,I,M}, score, passingLetters, qualifies }`
## Iron rule
O'Neil's "M" letter is global — when market is in a confirmed downtrend (Stage 3-4 on indices, VIX panic, distribution-day count > 5), DO NOT BUY breakouts regardless of individual stock signals. 3 of 4 stocks follow the market.
## Implementation
`computeCanslim(f)` in kite-server.js.
