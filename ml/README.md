# Phase B — ML research

Baseline analysis of the ProTrader feature-snapshot dataset. No deployment,
no XGBoost, no tuning — this pass is strictly about understanding whether
the existing Varsity heuristic can be beaten by a simple, interpretable
model, and if so by how much.

## Constraints

- **Models:** logistic regression only. No tree ensembles in this phase.
- **Splits:** strict time-based. Earliest 80% = train, latest 20% = test.
  No random shuffle anywhere.
- **Labels:** derived from `outcome_metrics.ret_15m_pct`, which the
  outcome engine only fills for snapshots whose 30-minute window is
  fully in the past. Lookahead safety is enforced at the SQL level.
- **Decision rule:** ML is worth promoting to Phase B.2 (XGBoost,
  shadow mode) only if it beats the heuristic by **> +5 bps mean
  forward return at matched coverage**. Below that → collect more data.

## Setup

```bash
cd ml
python -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Put DATABASE_URL in ml/.env (same value as Railway)
echo "DATABASE_URL=postgres://..." > .env
```

## Files

| File | What |
|---|---|
| `db.py` | Postgres loader. `load_labeled_dataset(...)` joins `features_snapshot` to `outcome_metrics` with the lookahead-safe filter. |
| `step1_data_validation.py` | Sanity check: missingness, outliers, return distributions, class balance, heuristic-score correlation with forward return. |
| `step3_baseline_model.py` | Labels (BUY/HOLD/SELL at ±0.2% on ret_15m_pct), feature matrix, time-split, multinomial logistic regression, saves model + test predictions. |
| `step4_feature_importance.py` | Coefficient magnitudes + permutation importance. Produces pruning candidates. |
| `step5_comparison.py` | Heuristic (score ≥ 60) vs ML (p(BUY) sweep) on the same test window. Decision rule at the end. |
| `run_all.py` | Runs Steps 1 → 5 in sequence. |
| `model_store/` | Outputs: `logreg_v1.pkl`, `logreg_v1_test_predictions.csv`, `logreg_v1_metrics.json`, `logreg_v1_feature_rankings.csv`, `logreg_v1_comparison.csv`. Gitignored. |

Step 2 (label definition) is deliberately embedded inside `step3_baseline_model.py`
as the `derive_labels()` function — keeping a whole script for a single
function would be ceremony. The label rule is a one-liner.

## Usage

```bash
# First run end-to-end (after Phase A has accumulated a few hundred rows):
python run_all.py

# Or step by step:
python step1_data_validation.py
python step3_baseline_model.py
python step4_feature_importance.py
python step5_comparison.py
```

## When to proceed to Phase B.2

Only if all three of these hold on the most recent test window:

1. `step1` shows no red flags — no column > 15% missing, all three
   classes ≥ 5% of data, `day_trade_score` has non-zero correlation
   with `ret_15m_pct`.
2. `step3` lifts test accuracy by at least 2 pp over the majority-class
   baseline (i.e., meaningfully better than "always predict HOLD").
3. `step5` shows Δ mean_ret > +5 bps at matched coverage.

If any of these fail, the recommendation is to collect more data (target:
1-2 months of live Phase A logging) and revisit. Do not jump to XGBoost
to try to rescue a weak baseline — the issue is usually data, not model.

## What gets stripped / pruned between phases

`step4` produces `logreg_v1_feature_rankings.csv` with a combined coef +
permutation rank per feature. When Phase B.2 starts, drop the bottom 15
features (those that neither shape the coefficients nor hurt accuracy
when shuffled). Re-fit logistic regression to confirm accuracy doesn't
fall, THEN proceed to XGBoost on the pruned feature set.
