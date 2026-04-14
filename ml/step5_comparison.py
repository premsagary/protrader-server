"""
step5_comparison.py
====================
Phase B · Step 5: does the ML model beat the existing Varsity heuristic?

Two parallel evaluations on the SAME held-out test window:

  (A) Heuristic signal:  BUY  when day_trade_score >= 60
                         (threshold chosen at Varsity's "strong-setup" cutoff).

  (B) ML signal:         BUY  when model's p(BUY) >= threshold
                         (sweep thresholds 0.40 / 0.50 / 0.60 / 0.70).

For each signal we compute on the test window:

  - Pick count / coverage
  - Precision (fraction of picks where ret_15m_pct > +0.2% — true BUYs)
  - Realised hit rate (fraction where ret_15m_pct > 0, i.e., just green)
  - Mean forward return (ret_15m_pct averaged over picks)
  - Expectancy in gross bps (mean ret × 100)

Decision rule we apply at the end:
  - ML worth deploying only if mean ret_15m on ML picks (at matched
    coverage to heuristic) beats heuristic's mean by a meaningful margin
    (> +5 bps after accounting for noise in the comparison).
  - Otherwise: keep the heuristic, collect more data, try richer models.

Requires: step3_baseline_model.py already run.
"""

from __future__ import annotations

import os
import joblib
import numpy as np
import pandas as pd

from db import load_labeled_dataset
from step3_baseline_model import (
    MODEL_DIR,
    MODEL_NAME,
    BUY_THRESHOLD,
    SELL_THRESHOLD,
)


HEURISTIC_THRESHOLDS = [50, 55, 60, 65, 70, 75]
ML_PROB_THRESHOLDS   = [0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70]


def print_section(title: str):
    print("\n" + "═" * 72)
    print(f"  {title}")
    print("═" * 72)


def summarize(picks_mask: np.ndarray, rets: np.ndarray, name: str, n_total: int) -> dict:
    n_pick = int(picks_mask.sum())
    if n_pick == 0:
        print(f"  {name:<40s}  no picks")
        return {"name": name, "n": 0}
    picked_rets = rets[picks_mask]
    precision_at_threshold = (picked_rets > BUY_THRESHOLD).mean()
    hit_rate  = (picked_rets > 0).mean()
    mean_ret  = picked_rets.mean()
    median_ret = np.median(picked_rets)
    coverage  = 100.0 * n_pick / n_total
    print(
        f"  {name:<40s}  picks={n_pick:>5d}  cov={coverage:5.2f}%  "
        f"precision={precision_at_threshold:.3f}  hit={hit_rate:.3f}  "
        f"mean={mean_ret:+.4f}%  median={median_ret:+.4f}%"
    )
    return {
        "name": name, "n": n_pick, "coverage_pct": coverage,
        "precision_buy": float(precision_at_threshold),
        "hit_rate": float(hit_rate),
        "mean_ret_pct": float(mean_ret),
        "median_ret_pct": float(median_ret),
    }


def main():
    print_section("STEP 5 · HEURISTIC vs ML — TEST-WINDOW COMPARISON")

    preds_path = os.path.join(MODEL_DIR, f"{MODEL_NAME}_test_predictions.csv")
    if not os.path.exists(preds_path):
        print(f"Missing {preds_path}. Run step3_baseline_model.py first.")
        return

    preds = pd.read_csv(preds_path, parse_dates=["ts"])
    preds = preds.dropna(subset=["ret_15m_pct"]).reset_index(drop=True)
    n_total = len(preds)
    print(f"Test window: {n_total:,} rows  ({preds['ts'].min()} → {preds['ts'].max()})")
    print(f"Test-window mean ret_15m: {preds['ret_15m_pct'].mean():+.4f}% "
          f"(median {preds['ret_15m_pct'].median():+.4f}%)\n")

    rets = preds["ret_15m_pct"].values

    # ── A. Heuristic signal sweep ─────────────────────────────────────
    print_section("5.A  Heuristic picks (day_trade_score >= threshold)")
    heur_results = []
    for t in HEURISTIC_THRESHOLDS:
        mask = preds["day_trade_score"].fillna(-1).values >= t
        heur_results.append(summarize(mask, rets, f"day_trade_score >= {t}", n_total))

    # Choose a heuristic baseline at score >= 60 for head-to-head
    heur_mask_60 = preds["day_trade_score"].fillna(-1).values >= 60
    heur_summary_60 = next((h for h in heur_results if h["name"] == "day_trade_score >= 60"), None)

    # ── B. ML signal sweep ────────────────────────────────────────────
    print_section("5.B  ML picks (p(BUY) >= threshold)")
    ml_results = []
    for thr in ML_PROB_THRESHOLDS:
        mask = preds["p_buy"].values >= thr
        ml_results.append(summarize(mask, rets, f"p(BUY) >= {thr:.2f}", n_total))

    # ── C. Matched-coverage head-to-head ──────────────────────────────
    # To fairly compare, we pick the ML threshold that yields the SAME
    # pick count (±10%) as heuristic @ score >= 60, then compare.
    print_section("5.C  Matched-coverage head-to-head (heuristic @60 vs ML @ matching pick count)")
    if heur_summary_60 and heur_summary_60["n"] > 0:
        target_n = heur_summary_60["n"]
        # Pick ML threshold whose pick count is closest to target_n
        best_ml = None
        for r in ml_results:
            if r.get("n", 0) > 0:
                diff = abs(r["n"] - target_n)
                if best_ml is None or diff < best_ml["diff"]:
                    best_ml = {"row": r, "diff": diff}
        if best_ml:
            h = heur_summary_60
            m = best_ml["row"]
            print(f"  Heuristic (score >= 60):   n={h['n']:>4d}   mean_ret={h['mean_ret_pct']:+.4f}%   "
                  f"hit={h['hit_rate']:.3f}   precision={h['precision_buy']:.3f}")
            print(f"  ML ({m['name']}):  n={m['n']:>4d}   mean_ret={m['mean_ret_pct']:+.4f}%   "
                  f"hit={m['hit_rate']:.3f}   precision={m['precision_buy']:.3f}")
            delta_ret  = m["mean_ret_pct"] - h["mean_ret_pct"]
            delta_prec = m["precision_buy"] - h["precision_buy"]
            delta_hit  = m["hit_rate"] - h["hit_rate"]
            print(f"\n  Δ mean_ret:   {delta_ret:+.4f}%  ({delta_ret*100:+.1f} bps)")
            print(f"  Δ precision:  {delta_prec:+.3f}")
            print(f"  Δ hit_rate:   {delta_hit:+.3f}")

            # Decision rule
            print_section("5.D  Deployment decision")
            if delta_ret > 0.05:
                print("  ✅  ML beats heuristic by > +5 bps mean ret at matched coverage.")
                print("      → worth proceeding to a richer model (XGBoost) and shadow-testing.")
            elif delta_ret > 0.0:
                print("  🟡  ML edges out heuristic but within noise (< +5 bps).")
                print("      → collect more data (need more test samples for a stable read).")
            else:
                print("  ❌  ML does NOT beat heuristic at matched coverage.")
                print("      → DO NOT deploy. Work on features / labels / data volume first.")
        else:
            print("  ML had no picks at any threshold — model is trivially HOLD-biased.")
    else:
        print("  Heuristic produced zero picks at score >= 60 in this window.")

    # ── Dump comparison table to CSV ──────────────────────────────────
    all_rows = (
        [{**r, "signal_type": "heuristic"} for r in heur_results if r.get("n", 0) > 0]
        + [{**r, "signal_type": "ml"}        for r in ml_results   if r.get("n", 0) > 0]
    )
    out_path = os.path.join(MODEL_DIR, f"{MODEL_NAME}_comparison.csv")
    pd.DataFrame(all_rows).to_csv(out_path, index=False)
    print(f"\nSaved full comparison: {out_path}")


if __name__ == "__main__":
    main()
