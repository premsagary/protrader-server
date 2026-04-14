"""
run_all.py — convenience orchestrator: runs Steps 1 → 5 in sequence.
Fails fast if any step raises. Useful for nightly re-evals.
"""

from __future__ import annotations

import importlib
import sys


STEPS = [
    ("step1_data_validation",  "Step 1: data validation"),
    ("step3_baseline_model",   "Step 3: baseline logistic regression"),
    ("step4_feature_importance", "Step 4: feature importance"),
    ("step5_comparison",       "Step 5: heuristic vs ML comparison"),
]


def main():
    for mod_name, title in STEPS:
        print(f"\n{'▓' * 72}")
        print(f"▓  {title}")
        print(f"{'▓' * 72}")
        mod = importlib.import_module(mod_name)
        try:
            mod.main()
        except Exception as e:
            print(f"\n✖  {title} FAILED: {e}")
            sys.exit(1)


if __name__ == "__main__":
    main()
