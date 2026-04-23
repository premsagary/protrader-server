-- ============================================================================
-- Ops Agent + Shadow Trader tables  (ops-shadow-agent branch)
-- ============================================================================
-- Two new append-only tables that power the two agents running alongside the
-- main trading cycle from 9am-4:30pm IST:
--
--   ops_incidents        - one row per detected operational issue + any auto-
--                          remediation attempt the ops-agent made. Never
--                          patches code — only runs operational actions that
--                          already exist as admin routes.
--   agent_shadow_trades  - one row per shadow (LLM) proposal. Shadow-trader is
--                          purely observational: it never places orders. Rows
--                          record the LLM's decision + the rule-based
--                          decision on the same pick snapshot, so we can A/B
--                          them without risking capital.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ops_incidents (
  id                   SERIAL PRIMARY KEY,
  run_id               VARCHAR(40)  NOT NULL,
  detected_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  severity             VARCHAR(12)  NOT NULL,            -- info | warn | error | critical
  kind                 VARCHAR(40)  NOT NULL,            -- enum: PIPELINE_STALLED, CACHE_EMPTY,
                                                         --   KITE_TOKEN_EXPIRED, CANDIDATES_EMPTY,
                                                         --   NO_TRADES_BY_1030, DRAWDOWN_BREACH,
                                                         --   KILL_SWITCH_TRIPPED, VIX_SPIKE,
                                                         --   EOD_UNRECONCILED, STALE_PICKS,
                                                         --   AGENT_CYCLE_MISSED, HEARTBEAT_MISSED
  summary              TEXT         NOT NULL,            -- short operator-facing description
  evidence             JSONB,                            -- metrics / counters / timestamps
  action_attempted     VARCHAR(40),                      -- NONE | REFRESH_CACHE | RERUN_PIPELINE |
                                                         --   CLEAR_CONCURRENCY_LOCK | NOTIFY_ONLY
  action_result        VARCHAR(12),                      -- ok | failed | skipped | not_attempted
  action_detail        TEXT,
  resolved_at          TIMESTAMP,
  auto_resolved        BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ops_incidents_detected_at ON ops_incidents(detected_at);
CREATE INDEX IF NOT EXISTS idx_ops_incidents_kind        ON ops_incidents(kind);
CREATE INDEX IF NOT EXISTS idx_ops_incidents_severity    ON ops_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_ops_incidents_run_id      ON ops_incidents(run_id);


CREATE TABLE IF NOT EXISTS agent_shadow_trades (
  id                   SERIAL PRIMARY KEY,
  run_id               VARCHAR(40)  NOT NULL,
  decided_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
  sym                  VARCHAR(20)  NOT NULL,
  sector               VARCHAR(40),
  -- Pick snapshot (so we can reconstruct why this pick was considered)
  day_trade_score      INTEGER,
  best_setup           VARCHAR(24),
  price                NUMERIC(18,2),
  -- Shadow (LLM) decision
  shadow_decision      VARCHAR(12)  NOT NULL,            -- BUY | SKIP | ERROR
  shadow_side          VARCHAR(4),
  shadow_entry         NUMERIC(18,2),
  shadow_stop_loss     NUMERIC(18,2),
  shadow_target        NUMERIC(18,2),
  shadow_quantity      INTEGER,
  shadow_rr_ratio      NUMERIC(6,2),
  shadow_confidence    INTEGER,                          -- 0-100
  shadow_reason        TEXT,                             -- LLM's own explanation
  shadow_model         VARCHAR(60),                      -- e.g., claude-sonnet-4-6
  shadow_latency_ms    INTEGER,
  -- Rule-based (trade-agent) decision on the SAME pick for A/B comparison
  rules_decision       VARCHAR(12),                      -- BUY | REJECT | ERROR
  rules_failed_filter  VARCHAR(40),
  rules_entry          NUMERIC(18,2),
  rules_stop_loss      NUMERIC(18,2),
  rules_target         NUMERIC(18,2),
  rules_quantity       INTEGER,
  rules_rr_ratio       NUMERIC(6,2),
  -- Agreement metric: AGREE_BUY | AGREE_SKIP | DISAGREE_SHADOW_BUY |
  --                   DISAGREE_RULES_BUY | ERROR
  agreement            VARCHAR(24)  NOT NULL,
  -- Outcome tracking (filled later by the shadow evaluator when the live price
  -- either hits the shadow's trigger/SL/target or the day ends)
  outcome              VARCHAR(12),                      -- PENDING | WIN | LOSS | EXPIRED | NA
  outcome_price        NUMERIC(18,2),
  outcome_at           TIMESTAMP,
  shadow_pnl_pct       NUMERIC(8,2),
  notes                TEXT
);

CREATE INDEX IF NOT EXISTS idx_shadow_trades_decided_at ON agent_shadow_trades(decided_at);
CREATE INDEX IF NOT EXISTS idx_shadow_trades_sym        ON agent_shadow_trades(sym);
CREATE INDEX IF NOT EXISTS idx_shadow_trades_agreement  ON agent_shadow_trades(agreement);
CREATE INDEX IF NOT EXISTS idx_shadow_trades_outcome    ON agent_shadow_trades(outcome);
CREATE INDEX IF NOT EXISTS idx_shadow_trades_run_id     ON agent_shadow_trades(run_id);
