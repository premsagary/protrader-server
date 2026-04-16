-- ============================================================================
-- Agent audit tables  (Phase 1 — dry run)
-- ============================================================================
-- Three append-only tables build the closed-loop audit trail:
--   agent_decisions     - one row per proposal (approved OR rejected)
--   agent_trades        - one row per trade that actually got placed
--   agent_trade_events  - lifecycle events on a placed trade (order, fill, SL mod, exit)
--
-- All three carry `run_id` (one per agent cycle) + `agent_decision_id` so the
-- entire lifetime of a decision can be reconstructed from logs alone.
--
-- Phase 1 writes only to `agent_decisions` (dry run = propose + validate + log;
-- no order placement). The other two tables are created now so Phase 2 paper
-- trading doesn't need a migration.
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_decisions (
  id                    SERIAL PRIMARY KEY,
  run_id                VARCHAR(40)   NOT NULL,          -- one per agent cycle
  decided_at            TIMESTAMP     NOT NULL DEFAULT NOW(),
  agent_mode            VARCHAR(12)   NOT NULL,          -- off | dry_run | paper | live
  sym                   VARCHAR(20)   NOT NULL,
  sector                VARCHAR(40),
  -- Snapshot of the pick at decision time (so we can diff against features_snapshot)
  day_trade_score       INTEGER,
  best_setup            VARCHAR(24),
  price                 NUMERIC(18,2),
  -- Agent proposal (filled regardless of approval)
  side                  VARCHAR(4),                       -- BUY | SELL
  entry_type            VARCHAR(12),                      -- LIMIT | SL-M
  trigger_price         NUMERIC(18,2),
  entry_price           NUMERIC(18,2),
  quantity              INTEGER,
  stop_loss             NUMERIC(18,2),
  target                NUMERIC(18,2),
  rr_ratio              NUMERIC(6,2),
  confidence_score      INTEGER,
  -- Filter / constraint result
  passed_filters        JSONB,                            -- array of filter codes that passed
  failed_filter         VARCHAR(40),                      -- first filter that failed (null if all passed)
  approved              BOOLEAN       NOT NULL DEFAULT FALSE,
  rejection_reason      VARCHAR(60),                      -- enum-style code: CONSTRAINT_DAILY_LOSS_CAP etc.
  rejection_detail      TEXT,                             -- human-readable context
  -- Snapshot of verified state (for post-hoc debugging)
  state_snapshot        JSONB
);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_run_id     ON agent_decisions(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_decided_at ON agent_decisions(decided_at);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_sym        ON agent_decisions(sym);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_approved   ON agent_decisions(approved);


CREATE TABLE IF NOT EXISTS agent_trades (
  id                    SERIAL PRIMARY KEY,
  agent_decision_id     INTEGER       NOT NULL REFERENCES agent_decisions(id),
  run_id                VARCHAR(40)   NOT NULL,
  agent_mode            VARCHAR(12)   NOT NULL,           -- paper | live (dry_run never writes here)
  sym                   VARCHAR(20)   NOT NULL,
  side                  VARCHAR(4)    NOT NULL,
  entry_order_id        VARCHAR(40),                      -- Kite order id (live) or synthetic (paper)
  sl_order_id           VARCHAR(40),
  target_order_id       VARCHAR(40),
  planned_entry         NUMERIC(18,2) NOT NULL,
  planned_stop_loss     NUMERIC(18,2) NOT NULL,
  planned_target        NUMERIC(18,2) NOT NULL,
  quantity              INTEGER       NOT NULL,
  filled_at             TIMESTAMP,
  fill_price            NUMERIC(18,2),
  exit_at               TIMESTAMP,
  exit_price            NUMERIC(18,2),
  exit_reason           VARCHAR(24),                      -- SL_HIT | TARGET_HIT | TIME_EXIT | EMERGENCY | MANUAL
  pnl_rupees            NUMERIC(12,2),
  pnl_pct               NUMERIC(8,2),
  created_at            TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_trades_decision_id ON agent_trades(agent_decision_id);
CREATE INDEX IF NOT EXISTS idx_agent_trades_sym         ON agent_trades(sym);
CREATE INDEX IF NOT EXISTS idx_agent_trades_created_at  ON agent_trades(created_at);


CREATE TABLE IF NOT EXISTS agent_trade_events (
  id                    SERIAL PRIMARY KEY,
  agent_trade_id        INTEGER       NOT NULL REFERENCES agent_trades(id),
  run_id                VARCHAR(40)   NOT NULL,
  event_type            VARCHAR(32)   NOT NULL,
  -- ORDER_PLACED | ORDER_REJECTED | ORDER_FILLED | SL_MODIFIED | TRAIL_ARMED
  -- TARGET_HIT | SL_HIT | TIME_EXIT | EMERGENCY_EXIT | RECONCILE_DRIFT
  payload               JSONB,
  occurred_at           TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_trade_events_trade_id    ON agent_trade_events(agent_trade_id);
CREATE INDEX IF NOT EXISTS idx_agent_trade_events_occurred_at ON agent_trade_events(occurred_at);
