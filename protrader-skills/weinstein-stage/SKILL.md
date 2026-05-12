---
name: weinstein-stage
description: Classify a stock into Stan Weinstein's 4 market-cycle stages (basing / advancing / topping / declining). Iron rule — NEVER OWN STAGE 4. Stage 2 EARLY = best entry.
trigger: When user asks "what stage is this in?" / "is this a buy zone?" / when separating buyable stocks from "avoid regardless of how good fundamentals look".
---

# Weinstein 4-Stage Analysis

## Source
Stan Weinstein, "Secrets for Profiting in Bull and Bear Markets" (1988).

## The 4 stages
- **Stage 1 — Basing.** Sideways, no trend, low volume. Watch for breakout.
- **Stage 2 — Advancing.** Price > 200-day MA, MA rising, momentum positive. BUY ZONE.
- **Stage 3 — Topping.** Price still above MA but losing momentum, distribution begins. TAKE PROFITS.
- **Stage 4 — Declining.** Price < 200-day MA, MA falling. IRON RULE: NEVER OWN.

## Stage 2 sub-classification (Sprint 3 addition, not in Weinstein original)
- **EARLY:** ret6m < 30% AND pctAbove200 < 20% — just broke base, best entry
- **MID:** ret6m < 60% AND pctAbove200 < 50% — wait for pullback to 50dma
- **LATE:** ret6m ≥ 60% OR pctAbove200 ≥ 50% — parabolic, no new entries (distribution risk)

## Inputs needed
- `f.price`, `f.dma200`, `f.dma150` (proxy for 30-week MA)
- `f.dma50` (for ma30wkRising via 50 > 150)
- `f.pctAbove200`, `f.change6m`, `f.change3m`, `f.change1m`

## Output schema
```js
{
  stage: 'STAGE_1' | 'STAGE_2' | 'STAGE_2_PROVISIONAL' | 'STAGE_2_TRANSITIONAL' | 'STAGE_3' | 'STAGE_4' | 'UNKNOWN',
  subStage: 'EARLY' | 'MID' | 'LATE',     // only when STAGE_2
  confidence: 0-100,
  reason: '...',
  recommendation: 'BUY zone...' | 'NO NEW ENTRIES...' | etc.,
  warning: 'Iron rule...' | null
}
```

## Iron rule
Stage 4 stocks are HARD-EXCLUDED from any Buy verdict regardless of how good other frameworks score them. This is non-negotiable per Weinstein.

## Caveats vs canonical
Weinstein uses weekly bars with 30-week MA + volume-confirmed breakout (≥ 2× avg). We approximate with daily 200 DMA + 6m return thresholds. The EARLY/MID/LATE sub-classification is ours, not Weinstein's — labeled as heuristic.

## Implementation
`classifyWeinsteinStage(f)` in kite-server.js.
