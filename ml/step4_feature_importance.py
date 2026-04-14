"""
step4_feature_importance.py
============================
Phase B · Step 4: identify which Varsity signals actually drive the
model, which are dead weight, and which are candidates for pruning.

Two complementary views:

  (A) Logistic-regression coefficients
      - Interpretable: sign = direction, magnitude = strength.
      - Caveat: for multinomial LR there are K class vectors.
      - We summarise by taking the max abs coefficient per feature
        across classes (most-influential-role), then rank.

  (B) Permutation importance (model-agnostic, honest)
      - Shuffle one feature in the TEST set and measure how much
        accuracy drops. Large drop = feature is actually used.
      - Catches features where the coefficient is high but the
        feature is redundant with another (the coefficient matters
        in isolation but shuffling this one doesn't hurt much).

Pruning suggestions are based on a conjunction: BOTH coefficient
magnitude AND permutation importance near zero → safe to drop.

Requires: step3_baseline_model.py already run (consumes the .pkl bundle).
"""

from __future__ import annotations

import os
import joblib
import numpy as np
import pandas as pd

from sklearn.inspection import permutation_importance

from db import load_labeled_dataset
from step3_baseline_model import (
    build_feature_matrix,
    derive_labels,
    time_based_split,
    MODEL_DIR,
    MODEL_NAME,
)


TOP_N         = 20        # how many "top" features to print
PRUNE_N       = 15        # how many pruning candidates to print
PERM_N_REPEATS = 10       # permutation importance iterations


def print_section(title: str):
    print("\n" + "═" * 72)
    print(f"  {title}")
    print("═" * 72)


def main():
    print_section("STEP 4 · FEATURE IMPORTANCE")

    model_path = os.path.join(MODEL_DIR, f"{MODEL_NAME}.pkl")
    if not os.path.exists(model_path):
        print(f"Missing {model_path}. Run step3_baseline_model.py first.")
        return

    bundle = joblib.load(model_path)
    model, scaler, imputer = bundle["model"], bundle["scaler"], bundle["imputer"]
    feature_names = bundle["feature_names"]
    split_idx = bundle["split_idx"]
    classes = list(model.classes_)

    # ── A. Logistic-regression coefficient ranking ──────────────────────
    print_section("4.A  Coefficient magnitudes (logistic regression)")
    # coef_ shape: (n_classes, n_features). Summarise by max abs across classes.
    coef = np.asarray(model.coef_)
    abs_coef_max = np.abs(coef).max(axis=0)
    # Per-class sign for the feature's most-influential role
    class_of_max = np.argmax(np.abs(coef), axis=0)
    signs = np.sign([coef[class_of_max[i], i] for i in range(len(feature_names))])
    class_labels = [classes[class_of_max[i]] for i in range(len(feature_names))]

    coef_df = pd.DataFrame({
        "feature": feature_names,
        "abs_coef": abs_coef_max,
        "dominant_class": class_labels,
        "sign": signs,
    }).sort_values("abs_coef", ascending=False).reset_index(drop=True)

    print(f"Top {TOP_N} features by coefficient magnitude:")
    print(f"  {'#':>3s}  {'feature':<40s}  {'|coef|':>8s}  dom_class  sign")
    for i, row in coef_df.head(TOP_N).iterrows():
        sign_str = "+" if row["sign"] > 0 else ("-" if row["sign"] < 0 else "0")
        print(f"  {i+1:>3d}  {row['feature']:<40s}  {row['abs_coef']:8.3f}  "
              f"{row['dominant_class']:>+5d}       {sign_str}")

    # ── B. Permutation importance on test set ──────────────────────────
    print_section("4.B  Permutation importance (test set)")
    # Re-load the test slice exactly like Step 3 did so rows line up.
    df = load_labeled_dataset()
    df = df[df["ret_15m_pct"].notna()].sort_values("ts").reset_index(drop=True)
    if len(df) < split_idx + 10:
        print("Not enough data to reconstruct the test slice — re-run step 3 on latest data.")
        return

    X, names_check = build_feature_matrix(df)
    # Safety: if column set drifted since training, align columns (missing → 0)
    if names_check != feature_names:
        print("  ⚠ Feature set differs from trained model. Re-aligning by name.")
        X = X.reindex(columns=feature_names, fill_value=0)

    y = derive_labels(df)
    X_test = X.iloc[split_idx:]
    y_test = y.iloc[split_idx:]

    X_test_imp = imputer.transform(X_test)
    X_test_s   = scaler.transform(X_test_imp)

    print(f"Running permutation_importance with {PERM_N_REPEATS} repeats on {len(X_test):,} test rows...")
    perm = permutation_importance(
        model, X_test_s, y_test.values,
        n_repeats=PERM_N_REPEATS,
        random_state=42,
        scoring="accuracy",
        n_jobs=-1,
    )

    perm_df = pd.DataFrame({
        "feature": feature_names,
        "perm_mean": perm.importances_mean,
        "perm_std":  perm.importances_std,
    }).sort_values("perm_mean", ascending=False).reset_index(drop=True)

    print(f"\nTop {TOP_N} features by permutation importance:")
    print(f"  {'#':>3s}  {'feature':<40s}  {'Δacc':>9s}  {'± std':>9s}")
    for i, row in perm_df.head(TOP_N).iterrows():
        print(f"  {i+1:>3d}  {row['feature']:<40s}  {row['perm_mean']:+9.5f}  {row['perm_std']:9.5f}")

    # ── Pruning candidates: low |coef| AND low perm importance ─────────
    print_section("4.C  Pruning candidates")
    joined = coef_df.merge(perm_df, on="feature")
    # Normalise both scores to [0, 1] for a combined ranking
    joined["coef_rank"] = joined["abs_coef"].rank(pct=True)
    joined["perm_rank"] = joined["perm_mean"].rank(pct=True)
    joined["combined"]  = (joined["coef_rank"] + joined["perm_rank"]) / 2
    prune = joined.sort_values("combined").head(PRUNE_N)
    print(f"Bottom {PRUNE_N} features by combined rank (low coef AND low perm):")
    print(f"  {'#':>3s}  {'feature':<40s}  {'|coef|':>8s}  {'Δacc':>9s}")
    for i, row in prune.iterrows():
        print(f"  {i+1:>3d}  {row['feature']:<40s}  {row['abs_coef']:8.3f}  {row['perm_mean']:+9.5f}")
    print("\nNote: these are CANDIDATES for pruning. Before dropping any:")
    print("  - Double-check they aren't intentionally-low-signal safety flags")
    print("    (e.g., 'above_2sigma' may rarely fire but matter when it does).")
    print("  - Re-fit without them and verify test accuracy doesn't fall.")

    # ── Write rankings to CSV for downstream analysis ──────────────────
    rankings_path = os.path.join(MODEL_DIR, f"{MODEL_NAME}_feature_rankings.csv")
    joined.sort_values("combined", ascending=False).to_csv(rankings_path, index=False)
    print(f"\nSaved full rankings: {rankings_path}")


if __name__ == "__main__":
    main()
