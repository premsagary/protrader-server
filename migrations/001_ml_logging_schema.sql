-- =============================================================================
-- 001_ml_logging_schema.sql
-- Data logging + outcome tracking for future ML training.
-- PLAIN POSTGRESQL (no TimescaleDB required). Schema is migration-safe —
-- when you want to convert to TimescaleDB later, run:
--   CREATE EXTENSION timescaledb;
--   SELECT create_hypertable('candles_1m',        'ts', chunk_time_interval => INTERVAL '7 days',  migrate_data => TRUE);
--   SELECT create_hypertable('candles_5m',        'ts', chunk_time_interval => INTERVAL '30 days', migrate_data => TRUE);
--   SELECT create_hypertable('features_snapshot', 'ts', chunk_time_interval => INTERVAL '7 days',  migrate_data => TRUE);
--   SELECT create_hypertable('outcome_metrics',   'ts', chunk_time_interval => INTERVAL '7 days',  migrate_data => TRUE);
-- Column names and PKs are chosen to be compatible with that future migration.
--
-- Safe to run multiple times (all CREATE ... IF NOT EXISTS).
-- No impact on existing tables.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- A. candles_1m — 1-minute OHLCV (NIFTY50 stocks only for now)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candles_1m (
  sym          TEXT          NOT NULL,
  ts           TIMESTAMPTZ   NOT NULL,              -- bar OPEN time, UTC
  open         NUMERIC(12,2) NOT NULL,
  high         NUMERIC(12,2) NOT NULL,
  low          NUMERIC(12,2) NOT NULL,
  close        NUMERIC(12,2) NOT NULL,
  volume       BIGINT        NOT NULL,
  ingested_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sym, ts)
);

-- Indexes chosen for both query performance AND future Timescale compatibility.
-- A BRIN index on ts is very cheap to maintain and ideal for time-series
-- append-only data; it becomes redundant (but harmless) after Timescale migration.
CREATE INDEX IF NOT EXISTS idx_candles_1m_ts_brin
  ON candles_1m USING BRIN (ts);
CREATE INDEX IF NOT EXISTS idx_candles_1m_sym_ts_desc
  ON candles_1m (sym, ts DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- B. candles_5m — 5-minute OHLCV (whole universe via unified pipeline)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candles_5m (
  sym          TEXT          NOT NULL,
  ts           TIMESTAMPTZ   NOT NULL,
  open         NUMERIC(12,2) NOT NULL,
  high         NUMERIC(12,2) NOT NULL,
  low          NUMERIC(12,2) NOT NULL,
  close        NUMERIC(12,2) NOT NULL,
  volume       BIGINT        NOT NULL,
  vwap         NUMERIC(12,2),
  ingested_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sym, ts)
);
CREATE INDEX IF NOT EXISTS idx_candles_5m_ts_brin
  ON candles_5m USING BRIN (ts);
CREATE INDEX IF NOT EXISTS idx_candles_5m_sym_ts_desc
  ON candles_5m (sym, ts DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- C. features_snapshot — ONE ROW per stock per scoring cycle.
--    This is THE dataset row for future ML training.
--    Every scored pick (trade taken or not) MUST land here.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS features_snapshot (
  snapshot_id   BIGSERIAL,
  sym           TEXT          NOT NULL,
  ts            TIMESTAMPTZ   NOT NULL,             -- bar time for the scan
  ingested_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  scan_source   TEXT          NOT NULL,             -- 'unified_pipeline' | 'scan_day_trades' | 'force_scan'
  price         NUMERIC(12,2) NOT NULL,
  sector        TEXT,
  grp           TEXT,                               -- Nifty50 / Next50 / Midcap / Smallcap / Custom

  -- ── BEST-SETUP summary ─────────────────────────────────
  best_setup       TEXT,                            -- VWAP_RECLAIM / GAP_AND_GO / BREAKOUT / OVERSOLD_BOUNCE
  best_setup_score INT,
  day_trade_score  INT,
  ch19_pass_count  SMALLINT,

  -- ── Per-setup raw scores ───────────────────────────────
  vwap_score       INT,
  gap_score        INT,
  breakout_score   INT,
  bounce_score     INT,

  -- ── Indicators ────────────────────────────────────────
  rsi_5m           NUMERIC(6,2),
  stoch_k          NUMERIC(6,2),
  adx              NUMERIC(6,2),
  macd_hist        NUMERIC(12,4),
  macd_bull        BOOLEAN,
  macd_cross       BOOLEAN,
  macd_hist_rising BOOLEAN,
  macd_hist_zero_up BOOLEAN,
  ema_9            NUMERIC(12,2),
  ema_20           NUMERIC(12,2),

  -- ── VWAP family ───────────────────────────────────────
  vwap             NUMERIC(12,2),
  vwap_dist_pct    NUMERIC(6,3),
  vwap_sigma       NUMERIC(12,4),
  vwap_upper_1     NUMERIC(12,2),
  vwap_lower_1     NUMERIC(12,2),
  vwap_upper_2     NUMERIC(12,2),
  vwap_lower_2     NUMERIC(12,2),
  below_1sigma     BOOLEAN,
  below_2sigma     BOOLEAN,
  above_2sigma     BOOLEAN,

  -- ── Bollinger ─────────────────────────────────────────
  bb_pct           NUMERIC(6,3),
  bb_squeeze       BOOLEAN,
  bb_squeeze_release_up BOOLEAN,

  supertrend_bull  BOOLEAN,

  -- ── Divergences ───────────────────────────────────────
  rsi_bull_div     BOOLEAN,
  rsi_bear_div     BOOLEAN,
  macd_bull_div    BOOLEAN,
  macd_bear_div    BOOLEAN,
  obv              NUMERIC(18,2),
  obv_bull_div     BOOLEAN,
  obv_bear_div     BOOLEAN,

  -- ── Volume ────────────────────────────────────────────
  vol_ratio        NUMERIC(8,3),
  vol_expanding    BOOLEAN,
  vol_contracting  BOOLEAN,
  vpa_confirm_bull BOOLEAN,
  vpa_confirm_bear BOOLEAN,
  vpa_weak_rally   BOOLEAN,
  vpa_weak_decline BOOLEAN,

  -- ── S/R levels ────────────────────────────────────────
  day_high         NUMERIC(12,2),
  day_low          NUMERIC(12,2),
  pd_high          NUMERIC(12,2),
  pd_low           NUMERIC(12,2),
  or_high          NUMERIC(12,2),
  or_low           NUMERIC(12,2),
  or_range         NUMERIC(12,2),
  day_high_touches SMALLINT,
  or_high_touches  SMALLINT,
  pd_high_touches  SMALLINT,
  pd_low_touches   SMALLINT,
  equal_highs_count SMALLINT,
  equal_lows_count  SMALLINT,
  pdh_role_support BOOLEAN,
  or_high_role_support BOOLEAN,
  or_failed_break  BOOLEAN,
  pdh_failed_break BOOLEAN,
  round_number     NUMERIC(12,2),
  at_round_number  BOOLEAN,

  -- ── CPR (Varsity M2 Ch 22) ────────────────────────────
  cpr_pp           NUMERIC(12,2),
  cpr_bc           NUMERIC(12,2),
  cpr_tc           NUMERIC(12,2),
  cpr_r1           NUMERIC(12,2),
  cpr_r2           NUMERIC(12,2),
  cpr_r3           NUMERIC(12,2),
  cpr_s1           NUMERIC(12,2),
  cpr_s2           NUMERIC(12,2),
  cpr_s3           NUMERIC(12,2),
  cpr_width_pct    NUMERIC(6,3),
  cpr_type         TEXT,                            -- NARROW / NORMAL / WIDE
  cpr_virgin       BOOLEAN,

  -- ── Fibonacci (Ch 16) ─────────────────────────────────
  fib_level        TEXT,
  fib_strength     SMALLINT,

  -- ── Gap (Ch 7) ────────────────────────────────────────
  gap_pct          NUMERIC(6,3),
  gap_unfilled     BOOLEAN,
  gap_class        TEXT,                            -- NONE/COMMON/BREAKAWAY/CONTINUATION/EXHAUSTION

  -- ── Candlestick (Ch 5-10) ─────────────────────────────
  candle_pattern       TEXT,
  candle_pattern_bull  BOOLEAN,
  pattern_confirmed    BOOLEAN,
  session_trend        TEXT,                        -- UP/DOWN/RANGE

  -- ── RSI midline (Ch 14) ───────────────────────────────
  rsi_above_midline    BOOLEAN,
  rsi_crossed_midline_up BOOLEAN,

  -- ── Context ───────────────────────────────────────────
  nifty_daily_change NUMERIC(6,3),
  rel_strength       NUMERIC(6,3),
  adr_avg            NUMERIC(6,3),
  adr_used_pct       SMALLINT,
  atr_pct            NUMERIC(6,3),
  session_phase      TEXT,                          -- OPENING/MORNING/MIDDAY/AFTERNOON/LATE

  -- ── Sizing reference (not a sizing decision here) ────
  kelly_fraction_pct NUMERIC(6,2),
  vol_scale          NUMERIC(4,2),

  -- ── Trade plan at scan time (for outcome comparison) ─
  entry_price        NUMERIC(12,2),
  sl_price           NUMERIC(12,2),
  tgt_price          NUMERIC(12,2),
  rr_ratio           NUMERIC(5,2),

  -- One snapshot per (stock, bar, source). Replays are idempotent.
  PRIMARY KEY (sym, ts, scan_source)
);

CREATE INDEX IF NOT EXISTS idx_fs_ts_brin        ON features_snapshot USING BRIN (ts);
CREATE INDEX IF NOT EXISTS idx_fs_sym_ts_desc    ON features_snapshot (sym, ts DESC);
CREATE INDEX IF NOT EXISTS idx_fs_best_setup_ts  ON features_snapshot (best_setup, ts DESC);
CREATE INDEX IF NOT EXISTS idx_fs_score_ts       ON features_snapshot (day_trade_score DESC, ts DESC)
  WHERE day_trade_score >= 30;
-- snapshot_id must be queryable (FK target from trade_log)
CREATE INDEX IF NOT EXISTS idx_fs_snapshot_id    ON features_snapshot (snapshot_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- D. trade_log — one row per executed trade; updated in-place at exit
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_log (
  trade_id        BIGSERIAL     PRIMARY KEY,
  snapshot_id     BIGINT,                           -- loose FK to features_snapshot.snapshot_id
  sym             TEXT          NOT NULL,

  entry_time      TIMESTAMPTZ   NOT NULL,
  entry_price     NUMERIC(12,2) NOT NULL,
  position_size   INT           NOT NULL,
  side            TEXT          NOT NULL DEFAULT 'LONG',
  sl_price        NUMERIC(12,2) NOT NULL,
  tgt_price       NUMERIC(12,2) NOT NULL,
  setup           TEXT,
  mode            TEXT          NOT NULL,           -- 'paper' | 'shadow' | 'live'

  exit_time       TIMESTAMPTZ,
  exit_price      NUMERIC(12,2),
  exit_reason     TEXT,                             -- SL / TGT / TIME / MANUAL / SQUAREOFF

  gross_pnl       NUMERIC(14,2),
  brokerage       NUMERIC(10,2) DEFAULT 0,
  stt             NUMERIC(10,2) DEFAULT 0,
  exchange_fee    NUMERIC(10,2) DEFAULT 0,
  sebi_fee        NUMERIC(10,2) DEFAULT 0,
  stamp_duty      NUMERIC(10,2) DEFAULT 0,
  gst             NUMERIC(10,2) DEFAULT 0,
  total_fees      NUMERIC(10,2) GENERATED ALWAYS AS
                  (COALESCE(brokerage,0)+COALESCE(stt,0)+COALESCE(exchange_fee,0)
                   +COALESCE(sebi_fee,0)+COALESCE(stamp_duty,0)+COALESCE(gst,0)) STORED,
  net_pnl         NUMERIC(14,2),

  kite_order_id_entry TEXT,
  kite_order_id_exit  TEXT,
  notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_trades_sym_entry  ON trade_log (sym, entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_open       ON trade_log (sym) WHERE exit_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_trades_mode       ON trade_log (mode, entry_time DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- E. outcome_metrics — filled asynchronously by outcome-engine.js
--    Lookahead safety: only rows with ts < NOW() - 31min are processed.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outcome_metrics (
  snapshot_id        BIGINT        NOT NULL,
  sym                TEXT          NOT NULL,
  ts                 TIMESTAMPTZ   NOT NULL,        -- matches features_snapshot.ts
  entry_ref_price    NUMERIC(12,2) NOT NULL,

  mfe_price          NUMERIC(12,2),
  mfe_ts             TIMESTAMPTZ,
  mfe_pct            NUMERIC(7,3),
  mae_price          NUMERIC(12,2),
  mae_ts             TIMESTAMPTZ,
  mae_pct            NUMERIC(7,3),

  ret_5m_pct         NUMERIC(7,3),
  ret_15m_pct        NUMERIC(7,3),
  ret_30m_pct        NUMERIC(7,3),
  ret_60m_pct        NUMERIC(7,3),

  vol_during_window  NUMERIC(7,4),
  bars_observed      SMALLINT,

  -- Time-to-hit at common thresholds (null if never hit in 30-min window)
  time_to_plus_0_3pct   INT,   -- seconds from ts
  time_to_plus_0_5pct   INT,
  time_to_plus_0_8pct   INT,
  time_to_plus_1_0pct   INT,
  time_to_minus_0_3pct  INT,
  time_to_minus_0_5pct  INT,
  time_to_minus_0_8pct  INT,
  time_to_minus_1_0pct  INT,

  -- Label placeholders — stay NULL until ML phase
  label_triple_barrier SMALLINT,
  label_fwd_ret_30m    SMALLINT,

  computed_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  computed_version     TEXT          NOT NULL DEFAULT 'v1',

  PRIMARY KEY (sym, ts)
);
CREATE INDEX IF NOT EXISTS idx_outcome_ts_brin   ON outcome_metrics USING BRIN (ts);
CREATE INDEX IF NOT EXISTS idx_outcome_sym_ts    ON outcome_metrics (sym, ts DESC);
CREATE INDEX IF NOT EXISTS idx_outcome_snapshot  ON outcome_metrics (snapshot_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- F. writer_dead_letter — durable retry buffer for the ml-logger module
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS writer_dead_letter (
  id           BIGSERIAL     PRIMARY KEY,
  target       TEXT          NOT NULL,              -- 'features_snapshot' / 'candles_1m' / ...
  payload      JSONB         NOT NULL,
  error_msg    TEXT,
  enqueued_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  retries      SMALLINT      NOT NULL DEFAULT 0,
  last_retry   TIMESTAMPTZ,
  next_retry   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  resolved     BOOLEAN       NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_dl_pending
  ON writer_dead_letter (next_retry, id)
  WHERE resolved = FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- G. Data-quality view — one-shot sanity check
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_data_coverage AS
SELECT
  date_trunc('hour', fs.ts)                               AS hour,
  COUNT(DISTINCT fs.sym)                                  AS symbols,
  COUNT(*)                                                AS snapshots,
  COUNT(*) FILTER (WHERE om.snapshot_id IS NOT NULL)      AS with_outcome,
  ROUND(100.0 * COUNT(*) FILTER (WHERE om.snapshot_id IS NOT NULL)
                     / NULLIF(COUNT(*),0), 1)             AS pct_outcome_complete
FROM features_snapshot fs
LEFT JOIN outcome_metrics om ON om.sym = fs.sym AND om.ts = fs.ts
WHERE fs.ts > NOW() - INTERVAL '7 days'
GROUP BY date_trunc('hour', fs.ts)
ORDER BY hour DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- H. Deployment marker (lets you check whether migration ran)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT        PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO schema_migrations (version) VALUES ('001_ml_logging_schema')
  ON CONFLICT (version) DO NOTHING;
