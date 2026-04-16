# ProTrader Auto-Agent — Phase 1 (Dry Run)

Rule-based intraday trading agent. Reads picks from `_dayTradeCache`, applies
filters + constraints, logs every decision to Postgres. **No Kite orders in
Phase 1.** No ML. No LLM. Fully deterministic.

## Contract

```
scanDayTrades → _dayTradeCache → agent.runCycle
                                     │
            ┌─── getVerifiedState ───┤
            │                        │
            ├─── isSystemKilled  ────┤  (kill switches)
            │                        │
            ├─── trade-agent.propose ┤  (filter chain)
            │                        │
            ├─── constraint.validate ┤  (hard rules)
            │                        │
            ├─── agent-audit.write  ─┤  (agent_decisions)
            │                        │
            └─── execution.place   ──┘  (dry_run = synthetic ids)
```

## Files

- `agent-config.js` — thresholds, modes, mode env var
- `agent-state.js` — frozen state snapshot + kill-switch
- `trade-agent.js` — deterministic filter chain + proposal builder
- `constraint-engine.js` — hard validators (risk cap, daily loss, concurrency, sector)
- `agent-audit.js` — append-only writers for the 3 audit tables
- `execution-engine.js` — adapters (dry_run live; paper + live stubbed)
- `trade-manager.js` — position poller (Phase 2 stub)
- `index.js` — `wire()` + `runCycle()` + cron
- `migrations/001_agent_tables.sql` — schema

## Wiring (one-time)

**1. Run the migration.** From Railway psql (or locally against DATABASE_URL):

```
\i protrader-server/agent/migrations/001_agent_tables.sql
```

**2. Add one block at the very end of `kite-server.js`:**

```js
// ── Auto-agent (rule-based intraday trading, Phase 1 dry-run) ────────────────
(async () => {
  try {
    const agent = require('./agent');
    await agent.bootstrap({
      app,                          // Express app (mounts /api/agent/*)
      pool,
      kite,
      isMarketOpen,
      getKiteToken:        () => process.env.KITE_ACCESS_TOKEN || null,
      getPicks:            () => _dayTradeCache,
      getNiftyDailyChange: () => _niftyDailyChangePct,
      // Optional: pass your own admin gate middleware
      // requireAdmin: (req, res, next) => _authUser?.role === 'admin' ? next() : res.status(403).end(),
    });
  } catch (e) {
    console.error('🤖 agent wiring failed:', e.message);
  }
})();
```

What `bootstrap` does:
- Reads `app_config['agent_mode_override']` — survives Railway redeploys
- Falls back to `process.env.AGENT_MODE` if no DB override
- Wires the cron (auto-skips when mode is `off`)
- Mounts 4 endpoints:
  - `GET  /api/agent/status`     — current mode + today's stats + last 20 decisions
  - `POST /api/agent/mode`       — body `{ mode }`, persists to DB
  - `POST /api/agent/run-now`    — force one cycle (debugging)
  - `GET  /api/agent/decisions`  — paginated decisions (`?limit=50`)

**3. (Optional) Set the mode env var.** Default is `off`. Or skip this — the UI tab flips mode at runtime and persists it.

```
AGENT_MODE=dry_run
AGENT_PAPER_CAPITAL=100000
```

**4. Use the UI.** After restart, log in as admin, open the 🤖 Agent tab, click `DRY_RUN`. Confirm. Watch decisions accumulate every minute during market hours.

## Modes

| Mode     | Picks filter | Validate | Audit | Place orders |
|----------|--------------|----------|-------|--------------|
| off      | no           | no       | no    | no           |
| dry_run  | yes          | yes      | yes   | no (synthetic ids only) |
| paper    | yes          | yes      | yes   | simulated (Phase 2 — NOT IMPLEMENTED) |
| live     | yes          | yes      | yes   | real (Phase 3 — NOT IMPLEMENTED) |

## Verification during dry-run

Query `agent_decisions` during market hours:

```sql
SELECT decided_at, sym, best_setup, approved,
       COALESCE(failed_filter, rejection_reason) AS why_rejected
  FROM agent_decisions
 WHERE decided_at::date = CURRENT_DATE
 ORDER BY decided_at DESC
 LIMIT 50;
```

What to look for:
- Approval rate should be < 10% of picks. Most picks fail `F_VOL_RATIO` or `F_TREND_ALIGN`.
- Distribution of `failed_filter` should be dominated by the early filters (score, RR, volume).
  If constraint-layer rejections dominate, the agent is too loose.
- Zero rows with `approved=true` and `quantity=0` — that'd indicate a sizing bug.

## Constraint summary (Phase 1)

| Constraint                     | Value     | Source |
|--------------------------------|-----------|--------|
| Risk per trade                 | 1% capital| agent-config.CONSTRAINTS.MAX_RISK_PER_TRADE_PCT |
| Daily loss cap                 | 2% capital| MAX_DAILY_LOSS_PCT |
| Max trades/day                 | 5         | MAX_TRADES_PER_DAY |
| Max concurrent                 | 3         | MAX_CONCURRENT_TRADES |
| Min RR                         | 1.5       | MIN_RR_RATIO |
| Max single-position notional   | 30%       | MAX_POSITION_PCT_OF_CAPITAL |
| No new entries after           | 14:30 IST | NO_ENTRIES_AFTER_MINS |
| Consecutive losses → cooldown  | 2 → 30 min| COOLDOWN_AFTER_N_LOSSES |
| Size-halve near loss cap       | at -1.5%  | HALVE_SIZE_AT_DAILY_LOSS_PCT |

## What Phase 1 does NOT do

- No order placement (synthetic ids in dry run).
- No trade manager (position poller is a stub).
- No armed-candidate state (proposals regenerate each cycle — fine for dry run).
- No NIFTY 5-min slope regime gate (uses day-cumulative for now).
- No Kite positions/orders query in dry_run (it's irrelevant without live orders).
- No UI change. DayTrading tab is untouched.

Phase 2 adds the paper-fill simulator + trade manager. Phase 3 adds live.

## Rollback

Set `AGENT_MODE=off` and restart. Nothing else touches the existing pipeline.
