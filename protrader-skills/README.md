# ProTrader Skills

Skills are Anthropic's plugin pattern for Claude — each folder is a self-describing capability Claude can load on demand. This directory mirrors that pattern for ProTrader's 13+ analysis frameworks.

Each skill folder has a `SKILL.md` with:

- **frontmatter** — `name`, `description`, when to use it
- **rubric** — the canonical methodology being applied
- **inputs** — what fields the framework needs from `stockFundamentals` or candles
- **outputs** — what the framework returns
- **thresholds** — pass/fail bars
- **citation source** — original paper / book / IBD article

These skills are **descriptive**, not new code. The frameworks already live as functions in `kite-server.js` (computeMinerviniTrendTemplate, classifyWeinsteinStage, etc.). The Skills layer documents them in Claude-readable form so:

1. Claude (via the protrader-mcp.js MCP server) can reason about which framework to invoke for a given user question
2. Adding a new framework = new folder, no code archeology
3. The methodology is searchable / auditable / version-controlled separately from the implementation

This folder structure is inspired by Anthropic's [financial-services-plugins](https://github.com/anthropics/financial-services-plugins) repo.

## Frameworks covered

| Folder | Framework | Source | Function in kite-server.js |
|---|---|---|---|
| `minervini-trend-template/` | 8-criterion uptrend filter | Minervini 2013 | computeMinerviniTrendTemplate |
| `weinstein-stage/` | 4-stage analysis | Weinstein 1988 | classifyWeinsteinStage |
| `canslim/` | 7-letter growth + momentum | O'Neil | computeCanslim |
| `piotroski-fscore/` | 9-point quality | Piotroski 2000 | computePiotroskiFScore |
| `altman-zscore/` | Bankruptcy risk | Altman 1968 + Z'' 1995 | computeAltmanZScore |
| `magic-formula/` | EY × ROC value+quality | Greenblatt 2006 | computeMagicFormulaRank |
| `industry-rs/` | Sector + within-sector leader | O'Neil 3-level RS | computeIndustryRS |
| `accumulation-distribution/` | Institutional buying signal | O'Neil / IBD | computeAccumulationDistribution |
| `vcp/` | Volatility Contraction Pattern | Minervini Ch 7 | detectVCP |
| `cup-with-handle/` | Base + handle pattern | O'Neil | detectCupWithHandle |
| `beneish-mscore/` | Earnings manipulation | Beneish 1999 | computeBeneishMScore |
| `sloan-accruals/` | Earnings quality | Sloan 1996 | computeSloanAccruals |
| `promoter-pledging/` | Indian-market tail-risk filter | Marcellus / Unifi | computePromoterPledgeRisk |
| `fno-positioning/` | Smart-money OI tracker | derivatives-desk | computeFnoPositioning |
| `sector-breadth/` | Industry RS confirmation | IBD-style | computeSectorBreadth |
| `delivery-quality/` | Institutional accumulation (India) | Marcellus | computeDeliveryQuality |
| `pead-earnings/` | Post-earnings drift + earnings proximity | Academic anomaly | computeEarningsContext |
| `composite-verdict/` | Horizon-aware roll-up | ProTrader v2.1 | computeCompositeVerdict |
