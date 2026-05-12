---
name: minervini-trend-template
description: Filter stocks that are in a confirmed uptrend per Mark Minervini's 8-criterion Trend Template. Apply this as a universe filter BEFORE looking for VCP entry setups — Minervini's actual workflow.
trigger: When user asks "is this stock in a strong uptrend?" / "does it pass Minervini criteria?" / when filtering universe for swing-trade candidates.
---

# Minervini Trend Template

## Source
Mark Minervini, "Trade Like a Stock Market Wizard" (2013), Chapter 4.

## Rubric (must pass ALL 8)
1. Price > 150-day MA AND > 200-day MA
2. 150-day MA > 200-day MA
3. 200-day MA trending UP (SMA200_today > SMA200_21d_ago) — slope check, not distance
4. 50-day MA > 150-day MA AND > 200-day MA
5. Price > 50-day MA
6. Price ≥ 30% above 52-week low
7. Price within 25% of 52-week high
8. Relative Strength rating ≥ 70 (top 30% of universe vs Nifty 6-month)

## Inputs needed
- `f.price` (current LTP)
- `f.dma50`, `f.dma150`, `f.dma200` (from candles)
- `f.dma200_21dAgo` (for true slope check; falls back to multi-factor proxy)
- `f.high52w`, `f.low52w`
- `f.change6m` (for relative strength)
- Universe FUND dictionary (for top-30% cutoff)

## Output schema
```js
{
  passed: 0-8,
  total: 8,
  qualifies: passed === 8,   // canonical: ALL 8 must pass
  score: 0-100,
  criteria: [{ name, pass, detail }, ...],
  dataCompleteness: 0-1,
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}
```

## How Minervini uses it
NOT as a scoring system. As a **gate**. Stocks that don't pass are not candidates for VCP setups. He won't buy a stock unless it's in the Trend Template universe.

## Implementation
`computeMinerviniTrendTemplate(f)` in kite-server.js.

## Common gotchas
- Criterion 3 is a SLOPE check (200dma rising), not a level check. Pre-Sprint-5 we used `pctAbove200 > 5` which fails the canonical rule. Sprint 5A fixed this with `dma200_today > dma200_21d_ago`.
- Criterion 8 RS Rating is **IBD-style 1-99 percentile weighted toward recent quarter**, not raw 6m return. We use a 6m proxy with universe-rank top-30% cutoff.

## Citation
> "I want the stock to be in a clear long-term uptrend before I'll consider it. The Trend Template defines that uptrend." — Minervini, TLASMW p.74
