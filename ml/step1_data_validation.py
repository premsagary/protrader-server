"""
step1_data_validation.py
=========================
Phase B · Step 1: inspect the raw ML dataset before any modeling.

Outputs to stdout:
  - Row count, date range, symbol count
  - Missing-value audit (% null per column)
  - Distribution of forward returns (mean, std, skew, quantiles)
  - Class balance under our proposed ±0.2% 15-min label
  - Outlier audit (values beyond 3 sigma or 1/99 percentile clips)
  - Correlation of day_trade_score with ret_15m_pct (sanity check for
    whether the existing heuristic has predictive signal at all)

Do not proceed to Step 3 until Step 1 passes the sanity bar:
  - Missing-rate for any feature <= 15%
  - Class balance: none of BUY/HOLD/SELL below 5% of total
  - No numeric column with a single value (variance > 0)
  - day_trade_score shows positive (even if weak) correlation with ret_15m
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from db import (
    load_labeled_dataset,
    FEATURE_COLS_NUMERIC,
    FEATURE_COLS_BOOLEAN,
    FEATURE_COLS_CATEGORICAL,
    OUTCOME_COLS,
)


BUY_THRESHOLD  = 0.2   # +0.2% on ret_15m_pct
SELL_THRESHOLD = -0.2  # -0.2% on ret_15m_pct


def label_series(ret_15m: pd.Series) -> pd.Series:
    """Three-class label: 1=BUY, -1=SELL, 0=HOLD. Lookahead-safe by input."""
    out = np.zeros(len(ret_15m), dtype=np.int8)
    out[ret_15m.values >  BUY_THRESHOLD]  = 1
    out[ret_15m.values <  SELL_THRESHOLD] = -1
    return pd.Series(out, index=ret_15m.index, name="label")


def print_section(title: str):
    print("\n" + "═" * 72)
    print(f"  {title}")
    print("═" * 72)


def main():
    print_section("STEP 1 · DATA VALIDATION")

    df = load_labeled_dataset()
    n = len(df)
    if n == 0:
        print("No labeled rows yet. Wait for outcome_metrics to accumulate (31+ min after snapshots), then re-run.")
        return

    # ── Basic shape ────────────────────────────────────────────────────
    print_section("1.1  Dataset shape")
    print(f"Rows:                {n:,}")
    print(f"Unique symbols:      {df['sym'].nunique()}")
    print(f"Unique scan sources: {df['scan_source'].nunique()}")
    print(f"Date range:          {df['ts'].min()}  →  {df['ts'].max()}")
    print(f"Span:                {(df['ts'].max() - df['ts'].min()).days} days")

    # ── Missingness ───────────────────────────────────────────────────
    print_section("1.2  Missing-value audit")
    missing = df.isna().mean().sort_values(ascending=False) * 100
    missing = missing[missing > 0]
    if len(missing) == 0:
        print("No missing values in any column.")
    else:
        print(f"{len(missing)} columns with some missingness:")
        for col, pct in missing.items():
            flag = " ⚠ HIGH" if pct > 15 else ""
            print(f"  {col:<32s}  {pct:6.2f}%{flag}")

    # ── Forward-return distributions ──────────────────────────────────
    print_section("1.3  Forward-return distributions")
    for col in ["ret_5m_pct", "ret_15m_pct", "ret_30m_pct", "ret_60m_pct", "mfe_pct", "mae_pct"]:
        if col not in df.columns:
            continue
        s = df[col].dropna()
        if len(s) == 0:
            print(f"  {col}: no data")
            continue
        print(f"\n  {col}  (n={len(s):,})")
        print(f"    mean:    {s.mean():+.4f}%   std: {s.std():.4f}%")
        print(f"    quantiles:  1%={s.quantile(0.01):+.3f}   5%={s.quantile(0.05):+.3f}   "
              f"25%={s.quantile(0.25):+.3f}   50%={s.quantile(0.50):+.3f}   "
              f"75%={s.quantile(0.75):+.3f}   95%={s.quantile(0.95):+.3f}   99%={s.quantile(0.99):+.3f}")
        print(f"    min/max: {s.min():+.3f}%  /  {s.max():+.3f}%")
        # Flag if more than 1% of rows are extreme outliers (> 5σ)
        sigma = s.std()
        if sigma > 0:
            extreme = ((s - s.mean()).abs() > 5 * sigma).mean() * 100
            if extreme > 1:
                print(f"    ⚠ {extreme:.2f}% of rows beyond 5σ — consider winsorizing at 1/99")

    # ── Class balance under proposed labels ──────────────────────────
    print_section("1.4  Class balance (±0.2% on ret_15m_pct)")
    if "ret_15m_pct" in df.columns and df["ret_15m_pct"].notna().any():
        sub = df[df["ret_15m_pct"].notna()].copy()
        sub["label"] = label_series(sub["ret_15m_pct"])
        vc = sub["label"].value_counts().sort_index()
        total = vc.sum()
        label_map = {-1: "SELL", 0: "HOLD", 1: "BUY"}
        print(f"  Total labeled:  {total:,}")
        for k, v in vc.items():
            pct = 100.0 * v / total
            flag = " ⚠ below 5%" if pct < 5 else ""
            print(f"    {label_map[k]:>4s}  ({k:+d}):  {v:>7,d}   {pct:5.2f}%{flag}")
        print(f"\n  Baseline (majority class) accuracy: {100.0*vc.max()/total:.2f}%")
        print("  Any ML model must beat this to be worth deploying.")
    else:
        print("  ret_15m_pct not available — outcome engine hasn't filled enough rows yet.")

    # ── Outlier audit on numeric features ────────────────────────────
    print_section("1.5  Numeric feature outlier audit (values beyond 1/99 percentile)")
    flagged = []
    for col in FEATURE_COLS_NUMERIC:
        if col not in df.columns:
            continue
        s = df[col].dropna()
        if len(s) < 10:
            continue
        p1, p99 = s.quantile(0.01), s.quantile(0.99)
        out_of_band = ((s < p1) | (s > p99)).mean() * 100
        if out_of_band > 2.5:  # normal bounded = 2%; >2.5% means heavy tails
            flagged.append((col, out_of_band, s.min(), p1, p99, s.max()))
    if not flagged:
        print("  All numeric features have tails within normal range.")
    else:
        flagged.sort(key=lambda x: -x[1])
        print(f"  {len(flagged)} features with heavy tails (>2.5% beyond 1/99 percentile):")
        print(f"  {'column':<32s}  {'%out':>6s}   {'min':>10s}  {'1%':>10s}  {'99%':>10s}  {'max':>10s}")
        for col, pct, mn, p1, p99, mx in flagged[:15]:
            print(f"  {col:<32s}  {pct:6.2f}   {mn:10.3f}  {p1:10.3f}  {p99:10.3f}  {mx:10.3f}")

    # ── Zero-variance check ──────────────────────────────────────────
    print_section("1.6  Zero-variance check")
    zero_var = []
    for col in FEATURE_COLS_NUMERIC + FEATURE_COLS_BOOLEAN:
        if col not in df.columns:
            continue
        nunique = df[col].dropna().nunique()
        if nunique <= 1:
            zero_var.append(col)
    if zero_var:
        print(f"  ⚠ {len(zero_var)} constant columns (drop these):")
        for c in zero_var:
            print(f"    {c}")
    else:
        print("  No constant columns.")

    # ── Heuristic score sanity check ─────────────────────────────────
    print_section("1.7  Sanity: does day_trade_score correlate with forward return?")
    if "day_trade_score" in df.columns and "ret_15m_pct" in df.columns:
        sub = df.dropna(subset=["day_trade_score", "ret_15m_pct"])
        if len(sub) >= 30:
            pear = sub["day_trade_score"].corr(sub["ret_15m_pct"])
            spear = sub["day_trade_score"].corr(sub["ret_15m_pct"], method="spearman")
            print(f"  Pearson  correlation:  {pear:+.4f}")
            print(f"  Spearman correlation:  {spear:+.4f}")
            if pear < 0.02 and spear < 0.02:
                print("  ⚠ Heuristic score barely correlates with outcome — ML has room to add value.")
            elif pear > 0.10:
                print("  Heuristic already has meaningful signal — ML needs to add real lift to justify deployment.")
            # Decile analysis
            sub["decile"] = pd.qcut(sub["day_trade_score"], 10, labels=False, duplicates="drop")
            decile_ret = sub.groupby("decile")["ret_15m_pct"].agg(["mean", "count"])
            print("\n  Mean ret_15m_pct by day_trade_score decile:")
            for dec, row in decile_ret.iterrows():
                bar = "█" * max(0, int(row["mean"] * 200))
                print(f"    decile {int(dec):>2d}:  n={int(row['count']):>5d}   "
                      f"mean ret = {row['mean']:+.3f}%  {bar}")
        else:
            print(f"  Only {len(sub)} rows with both fields; need >= 30 for a useful correlation.")

    # ── Exit summary ─────────────────────────────────────────────────
    print_section("Step 1 complete.")
    print("Next: step3_baseline_model.py (labeling + logistic regression + time-based split).")


if __name__ == "__main__":
    main()
