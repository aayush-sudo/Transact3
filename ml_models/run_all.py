#!/usr/bin/env python3
"""
Transact3 - Master Pipeline Runner
Runs EDA and trains all 3 machine learning models sequentially, saving all weights.
"""

import sys
import time
import subprocess

# Ensure clean UTF-8 printing on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def run():
    print("=" * 75)
    print(" TRANSACT3 - END-TO-END MACHINE LEARNING PIPELINE")
    print("=" * 75)
    start_total = time.time()

    scripts = [
        ("00_eda.py", "Step 0: Exploratory Data Analysis"),
        ("01_currency_forecast_model.py", "Step 1: FX Currency Rate Prediction & Timing"),
        ("02_rail_recommendation_model.py", "Step 2: Payment Rail Recommendation Model"),
        ("03_transaction_risk_model.py", "Step 3: Transaction Anomaly & Compliance Risk")
    ]

    for script_name, label in scripts:
        print(f"\n>>> Running {label} ({script_name})...")
        t0 = time.time()
        ret = subprocess.run([sys.executable, f"ml_models/{script_name}"])
        if ret.returncode != 0:
            print(f"[ERROR] {script_name} failed with return code {ret.returncode}")
            sys.exit(ret.returncode)
        print(f">>> Finished {label} in {time.time() - t0:.2f}s")

    elapsed = time.time() - start_total
    print("\n" + "=" * 75)
    print(f" [ALL MODELS TRAINED & SAVED SUCCESSFULLY in {elapsed:.2f}s!]")
    print(" Check artifacts in: ml_models/saved_models/")
    print("=" * 75)

if __name__ == "__main__":
    run()
