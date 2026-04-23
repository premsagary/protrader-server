-- ============================================================================
-- App Errors table  (ops-logs-monitor branch)
-- ============================================================================
-- A single append-upsert table that captures every error the application
-- catches or logs, deduplicated by (kind, message_hash) so one recurring
-- error is one row with a high `count` instead of thousands of rows.
--
-- This table feeds the log-pattern detectors in ops-agent.js:
--   KITE_ERROR_BURST
--   DB_POOL_EXHAUSTED
--   UNHANDLED_REJECTION_SPIKE
--   CACHE_WRITE_FAILURE
--
-- Population is gated on env flag AGENT_ERROR_SINK_ENABLED. When the flag is
-- off, the sink is a no-op and this table stays empty — the migration is
-- still safe to run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_errors (
  id                BIGSERIAL    PRIMARY KEY,
  kind              VARCHAR(40)  NOT NULL,   -- e.g., KITE_API | DB_POOL | UNHANDLED | CACHE_WRITE | GENERIC
  message_hash      CHAR(16)     NOT NULL,   -- first 16 chars of sha256(template)
  message_sample    TEXT         NOT NULL,   -- a representative message (first ~500 chars)
  sample_context    JSONB,                    -- latest ctx (stack head, run_id, sym, etc.)
  first_seen        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  count             INTEGER      NOT NULL DEFAULT 1,
  UNIQUE (kind, message_hash)
);

CREATE INDEX IF NOT EXISTS idx_app_errors_last_seen   ON app_errors(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_app_errors_kind_last   ON app_errors(kind, last_seen DESC);
