"""
step3_baseline_model.py
========================
Phase B · Step 3: train a simple multinomial logistic regression on the
Varsity feature set, evaluated with a STRICT TIME-BASED train/test split.

Step 2 (labeling) is embedded here because the label derivation depends
on which horizon we pick (ret_15m_pct). Separate file would be ceremony
for what is effectively a single function.

Label rule:
    BUY  (1)  if  ret_15m_pct  >  +0.2%
    SELL (-1) if  ret_15m_pct  <  -0.2%
    HOLD (0)  otherwise

Train/test split:
    Earliest 80% of rows by ts  →  train
    Latest   20% of rows by ts  →  test
    No random shuffle, ever. This matches how the model would see data
    in production (past → future) and avoids lookahead via shuffled folds.

Outputs:
    - Overall accuracy
    - Per-class precision / recall / F1
    - Confusion matrix
    - Saved model + scaler + column list to model_store/logreg_v1.pkl
    - Test-set predictions dumped to CSV for downstream comparison.
"""

from __future__ import annotations

import os
import sys
import json
import joblib
import datetime as dt
import numpy as np
import pandas as pd

from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
)

from db import (
    load_labeled_dataset,
    FEATURE_COLS_NUMERIC,
    FEATURE_COLS_BOOLEAN,
    FEATURE_COLS_CATEGORICAL,
)

# ── Config ───────────────────────────────────────────────────────────
BUY_THRESHOLD   = 0.2        # ret_15m_pct > +0.2% → BUY
SELL_THRESHOLD  = -0.2       # ret_15m_pct < -0.2% → SELL
TRAIN_FRACTION  = 0.80
MIN_ROWS        = 500        # don't bother modeling below this
MODEL_DIR       = os.path.join(os.path.dirname(__file__), "model_store")
MODEL_NAME      = "logreg_v1"


def derive_labels(df: pd.DataFrame) -> pd.Series:
    """Three-class label from ret_15m_pct. Lookahead-safe: relies on outcome_metrics."""
    y = np.zeros(len(df), dtype=np.int8)
    r = df["ret_15m_pct"].values
    y[r >  BUY_THRESHOLD]  = 1
    y[r <  SELL_THRESHOLD] = -1
    return pd.Series(y, index=df.index, name="label")


def build_feature_matrix(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """
    Assemble X from numeric + boolean + one-hot-encoded categorical columns.
    Returns (X, feature_names).
    """
    parts = []

    # Numeric columns — leave as-is, scale later.
    num = df[[c for c in FEATURE_COLS_NUMERIC if c in df.columns]].copy()
    parts.append(num)

    # Boolean columns — cast to int (True/False → 1/0, NaN → 0).
    bools = df[[c for c in FEATURE_COLS_BOOLEAN if c in df.columns]].copy()
    for c in bools.columns:
        bools[c] = bools[c].fillna(False).astype(int)
    parts.append(bools)

    # Categorical columns — one-hot. Missing values become their own column
    # implicitly (they're dropped after dummies creation, which is fine).
    cats = df[[c for c in FEATURE_COLS_CATEGORICAL if c in df.columns]].copy()
    # NaN → explicit 'unknown' string so it gets its own dummy
    cats = cats.fillna("unknown").astype(str)
    cat_dummies = pd.get_dummies(cats, prefix=cats.columns, prefix_sep="__", dummy_na=False)
    # Ensure dummies are integers (some pandas versions return bools)
    cat_dummies = cat_dummies.astype(int)
    parts.append(cat_dummies)

    X = pd.concat(parts, axis=1)
    # Final guard: drop any remaining all-NaN columns, replace ±inf with NaN
    X = X.replace([np.inf, -np.inf], np.nan)
    return X, list(X.columns)


def time_based_split(df: pd.DataFrame, train_fraction: float = TRAIN_FRACTION):
    """
    Split strictly by ts. Earliest train_fraction = train, rest = test.
    Assumes df is already sorted by ts ascending (load_labeled_dataset does this).
    """
    n = len(df)
    split_idx = int(n * train_fraction)
    train = df.iloc[:split_idx].copy()
    test  = df.iloc[split_idx:].copy()
    return train, test, split_idx


def print_section(title: str):
    print("\n" + "═" * 72)
    print(f"  {title}")
    print("═" * 72)


def main():
    print_section("STEP 3 · BASELINE LOGISTIC REGRESSION")

    # 1. Load labeled dataset
    df = load_labeled_dataset()
    df = df[df["ret_15m_pct"].notna()].sort_values("ts").reset_index(drop=True)
    n = len(df)
    print(f"Loaded {n:,} labeled rows spanning {df['ts'].min()} → {df['ts'].max()}")
    if n < MIN_ROWS:
        print(f"Need at least {MIN_ROWS} rows before modeling. Keep collecting.")
        return

    # 2. Derive labels (Step 2)
    y = derive_labels(df)
    print(f"Class balance (full set): {y.value_counts().to_dict()}")

    # 3. Build feature matrix
    X, feature_names = build_feature_matrix(df)
    print(f"Feature matrix: {X.shape[0]:,} rows × {X.shape[1]} columns")

    # 4. Time-based split
    train_df, test_df, split_idx = time_based_split(df)
    X_train, y_train = X.iloc[:split_idx], y.iloc[:split_idx]
    X_test,  y_test  = X.iloc[split_idx:], y.iloc[split_idx:]
    print(f"Train:  {len(X_train):,} rows  ({df.iloc[0]['ts']}  →  {df.iloc[split_idx-1]['ts']})")
    print(f"Test:   {len(X_test):,} rows   ({df.iloc[split_idx]['ts']} →  {df.iloc[-1]['ts']})")

    # Class balance separately for train and test — catches regime shift
    print(f"Train class balance: {y_train.value_counts().to_dict()}")
    print(f"Test  class balance: {y_test.value_counts().to_dict()}")

    # 5. Fit impute → scale → logreg
    #    - Median imputation for missing numerics (preserves robustness to outliers)
    #    - StandardScaler zero-means + unit-vars (logreg needs scaled inputs)
    imputer = SimpleImputer(strategy="median")
    X_train_imp = imputer.fit_transform(X_train)
    X_test_imp  = imputer.transform(X_test)

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train_imp)
    X_test_s  = scaler.transform(X_test_imp)

    model = LogisticRegression(
        multi_class="multinomial",
        solver="lbfgs",
        max_iter=500,
        C=1.0,
        class_weight="balanced",   # HOLD dominates; rebalance to not collapse to majority
        random_state=42,
    )
    model.fit(X_train_s, y_train.values)
    print("Model fit OK. Classes:", model.classes_)

    # 6. Evaluate on test set
    print_section("Step 3 · Test-set evaluation")
    y_pred = model.predict(X_test_s)
    y_proba = model.predict_proba(X_test_s)

    acc = accuracy_score(y_test, y_pred)
    print(f"Overall accuracy: {acc:.4f}")
    # Baseline = predict majority class always (HOLD = 0)
    majority = y_test.value_counts().idxmax()
    baseline_acc = (y_test == majority).mean()
    print(f"Majority-class baseline: {baseline_acc:.4f}  (predict {majority} always)")
    lift = acc - baseline_acc
    print(f"Lift vs baseline:   {lift:+.4f}  ({lift*100:+.2f} pp)")

    print("\nPer-class metrics (precision / recall / F1):")
    print(classification_report(
        y_test, y_pred,
        labels=[-1, 0, 1],
        target_names=["SELL(-1)", "HOLD(0)", "BUY(+1)"],
        digits=3,
        zero_division=0,
    ))

    print("Confusion matrix (rows=true, cols=pred; order -1, 0, +1):")
    cm = confusion_matrix(y_test, y_pred, labels=[-1, 0, 1])
    print("            pred -1   pred 0   pred +1")
    row_labels = ["true -1", "true  0", "true +1"]
    for rl, row in zip(row_labels, cm):
        print(f"  {rl}   {row[0]:>8d} {row[1]:>8d} {row[2]:>8d}")

    # Quality at the high-conviction tail (interesting for trading)
    print("\nBUY-signal precision at various probability thresholds:")
    buy_idx = list(model.classes_).index(1)
    buy_probs = y_proba[:, buy_idx]
    for thr in [0.40, 0.50, 0.60, 0.70]:
        pick = buy_probs >= thr
        n_pick = int(pick.sum())
        if n_pick == 0:
            print(f"  p(BUY) >= {thr:.2f}:  no picks above threshold")
            continue
        prec = (y_test.values[pick] == 1).mean()
        coverage = pick.mean() * 100
        print(f"  p(BUY) >= {thr:.2f}:  picks={n_pick:>6d}  coverage={coverage:5.2f}%   precision={prec:.3f}")

    # 7. Persist model + metadata for Step 4 + Step 5
    os.makedirs(MODEL_DIR, exist_ok=True)
    stamp = dt.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    bundle = {
        "model": model,
        "scaler": scaler,
        "imputer": imputer,
        "feature_names": feature_names,
        "split_idx": split_idx,
        "buy_threshold": BUY_THRESHOLD,
        "sell_threshold": SELL_THRESHOLD,
        "train_fraction": TRAIN_FRACTION,
        "trained_at": stamp,
        "n_train": len(X_train),
        "n_test":  len(X_test),
    }
    model_path = os.path.join(MODEL_DIR, f"{MODEL_NAME}.pkl")
    joblib.dump(bundle, model_path)
    print(f"\nSaved model bundle: {model_path}")

    # Save test predictions for Step 5 comparison
    preds_df = test_df[["sym", "ts", "day_trade_score", "ret_15m_pct"]].copy()
    preds_df["y_true"] = y_test.values
    preds_df["y_pred"] = y_pred
    preds_df["p_sell"] = y_proba[:, list(model.classes_).index(-1)]
    preds_df["p_hold"] = y_proba[:, list(model.classes_).index(0)]
    preds_df["p_buy"]  = y_proba[:, list(model.classes_).index(1)]
    preds_path = os.path.join(MODEL_DIR, f"{MODEL_NAME}_test_predictions.csv")
    preds_df.to_csv(preds_path, index=False)
    print(f"Saved test predictions: {preds_path}")

    # Save metrics summary
    summary = {
        "trained_at": stamp,
        "n_train": len(X_train), "n_test": len(X_test),
        "test_accuracy": float(acc),
        "baseline_accuracy": float(baseline_acc),
        "lift_pp": float(lift * 100),
        "classes": [int(c) for c in model.classes_],
        "per_class_f1": {
            str(int(c)): float(f1_score(y_test, y_pred, labels=[c], average="macro", zero_division=0))
            for c in model.classes_
        },
    }
    summary_path = os.path.join(MODEL_DIR, f"{MODEL_NAME}_metrics.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"Saved metrics summary: {summary_path}")


if __name__ == "__main__":
    main()
