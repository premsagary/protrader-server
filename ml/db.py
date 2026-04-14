"""
db.py — Shared Postgres loader for Phase B ML scripts.

Loads the labeled dataset from features_snapshot + outcome_metrics with
strict lookahead safety enforced at query time:

    - Only rows whose outcome window is fully computed (om.mfe_pct IS NOT NULL).
    - Joined on exact (sym, ts) — no fuzzy time alignment.
    - Filtered by minimum day_trade_score if desired (to focus on actionable picks).

This module is pure I/O. Labeling and modeling live in separate scripts.
"""

from __future__ import annotations

import os
import sys
import psycopg2
import psycopg2.extras
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set. Copy it from Railway and put it in ml/.env", file=sys.stderr)
    sys.exit(1)


# Columns pulled from features_snapshot for modeling.
# Everything numeric or one-hot-encodable. Excluded: sym (too high cardinality),
# ts (time leakage proxy), price/entry_price/sl_price/tgt_price (absolute
# price levels carry stock identity by proxy).
FEATURE_COLS_NUMERIC = [
    "best_setup_score", "day_trade_score", "ch19_pass_count",
    "vwap_score", "gap_score", "breakout_score", "bounce_score",
    "rsi_5m", "stoch_k", "adx", "macd_hist",
    "ema_9", "ema_20",   # absolute — will be converted to ema_diff below
    "vwap_dist_pct", "vwap_sigma",
    "bb_pct",
    "obv",               # absolute — will be dropped; divergence flags remain
    "vol_ratio",
    "day_high_touches", "or_high_touches", "pd_high_touches", "pd_low_touches",
    "equal_highs_count", "equal_lows_count",
    "cpr_width_pct",
    "fib_strength",
    "gap_pct",
    "nifty_daily_change", "rel_strength",
    "adr_avg", "adr_used_pct", "atr_pct",
    "kelly_fraction_pct", "vol_scale",
    "rr_ratio",
]

FEATURE_COLS_BOOLEAN = [
    "macd_bull", "macd_cross", "macd_hist_rising", "macd_hist_zero_up",
    "below_1sigma", "below_2sigma", "above_2sigma",
    "bb_squeeze", "bb_squeeze_release_up", "supertrend_bull",
    "rsi_bull_div", "rsi_bear_div",
    "macd_bull_div", "macd_bear_div",
    "obv_bull_div", "obv_bear_div",
    "vol_expanding", "vol_contracting",
    "vpa_confirm_bull", "vpa_confirm_bear", "vpa_weak_rally", "vpa_weak_decline",
    "pdh_role_support", "or_high_role_support",
    "or_failed_break", "pdh_failed_break",
    "at_round_number",
    "cpr_virgin",
    "gap_unfilled",
    "candle_pattern_bull", "pattern_confirmed",
    "rsi_above_midline", "rsi_crossed_midline_up",
]

FEATURE_COLS_CATEGORICAL = [
    "best_setup",      # VWAP_RECLAIM / GAP_AND_GO / BREAKOUT / OVERSOLD_BOUNCE
    "cpr_type",        # NARROW / NORMAL / WIDE
    "fib_level",       # 61.8% / 50% / 38.2% / 78.6% / 23.6% / null
    "gap_class",       # COMMON / BREAKAWAY / CONTINUATION / EXHAUSTION / NONE
    "candle_pattern",  # Bullish Engulfing / Hammer / ... / null
    "session_trend",   # UP / DOWN / RANGE
    "session_phase",   # OPENING / MORNING / MIDDAY / AFTERNOON / LATE
    "scan_source",     # unified_pipeline / scan_day_trades / force_scan
    "grp",             # NIFTY50 / NEXT50 / MIDCAP / SMALLCAP / Custom
    "sector",
]

OUTCOME_COLS = [
    "mfe_pct", "mae_pct",
    "ret_5m_pct", "ret_15m_pct", "ret_30m_pct", "ret_60m_pct",
    "vol_during_window", "bars_observed",
]


def connect():
    return psycopg2.connect(DATABASE_URL)


def load_labeled_dataset(
    min_day_trade_score: int = 0,
    since: str | None = None,
    until: str | None = None,
    limit: int | None = None,
) -> pd.DataFrame:
    """
    Join features_snapshot with outcome_metrics on (sym, ts).

    Filters:
      - Only rows where outcome has been computed (mfe_pct IS NOT NULL)
      - Optional min day_trade_score
      - Optional ts range

    Returns a pandas DataFrame with one row per (sym, ts, scan_source).
    """
    cols = (
        ["fs.snapshot_id", "fs.sym", "fs.ts"]
        + [f"fs.{c}" for c in FEATURE_COLS_NUMERIC]
        + [f"fs.{c}" for c in FEATURE_COLS_BOOLEAN]
        + [f"fs.{c}" for c in FEATURE_COLS_CATEGORICAL]
        + [f"om.{c}" for c in OUTCOME_COLS]
    )
    select_clause = ", ".join(cols)
    where = ["om.mfe_pct IS NOT NULL"]
    params: list = []
    if min_day_trade_score > 0:
        where.append("fs.day_trade_score >= %s")
        params.append(min_day_trade_score)
    if since:
        where.append("fs.ts >= %s")
        params.append(since)
    if until:
        where.append("fs.ts < %s")
        params.append(until)
    where_sql = " AND ".join(where)
    sql = f"""
        SELECT {select_clause}
          FROM features_snapshot fs
          JOIN outcome_metrics   om ON om.sym = fs.sym AND om.ts = fs.ts
         WHERE {where_sql}
         ORDER BY fs.ts
         {'LIMIT ' + str(int(limit)) if limit else ''}
    """
    with connect() as conn:
        df = pd.read_sql(sql, conn, params=params)
    return df


if __name__ == "__main__":
    # Quick smoke test — counts rows in the labeled dataset.
    df = load_labeled_dataset(limit=100)
    print(f"Loaded {len(df)} rows.")
    if len(df):
        print("\nColumn dtypes:")
        print(df.dtypes.value_counts())
        print("\nFirst row, non-null cols:")
        row = df.iloc[0].dropna()
        print(row.to_dict())
