#!/usr/bin/env python3
"""
Transact3 - Model 2: Optimal Payment Rail Recommendation Model
=============================================================
Algorithm: RandomForestClassifier (scikit-learn)
Artifact:  saved_models/rail_model.joblib

Trains across 2 Epochs / Runs on 50,000 multi-attribute cross-border routing scenarios.
"""

import os
import sys
import time
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, UTC
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, log_loss

# Ensure clean UTF-8 printing on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
MODEL_PATH = os.path.join(MODEL_DIR, "rail_model.joblib")

RAIL_CLASSES = [
    "REGIONAL_INSTANT",
    "BILATERAL_NETTING",
    "CARD_PAYOUT",
    "RTGS_SETTLEMENT",
    "SWIFT_CORRESPONDENT"
]

FEATURE_COLUMNS = [
    "amount_log",
    "is_weekend",
    "time_of_day_utc",
    "pref_cheapest",
    "pref_fastest",
    "pref_reliable",
    "is_major_corridor",
    "fx_volatility_pct",
    "liquidity_ratio"
]

def synthesize_routing_dataset(n_samples: int = 50000) -> pd.DataFrame:
    """
    Synthesizes complete global payment routing scenarios across all 5 rail physics.
    """
    np.random.seed(42)
    records = []

    for _ in range(n_samples):
        amount = float(np.exp(np.random.uniform(np.log(20), np.log(1000000))))
        is_weekend = int(np.random.choice([0, 1], p=[0.72, 0.28]))
        time_of_day = int(np.random.randint(0, 24))
        pref = np.random.choice(["CHEAPEST", "FASTEST", "BALANCED", "RELIABLE"], p=[0.35, 0.30, 0.25, 0.10])
        is_major = int(np.random.choice([0, 1], p=[0.20, 0.80]))
        fx_vol = float(np.random.uniform(0.1, 2.0))
        liquidity = float(np.random.uniform(0.3, 1.0))

        if amount >= 150000 and is_major and is_weekend == 0:
            label = "RTGS_SETTLEMENT"
        elif pref == "CHEAPEST" and 5000 <= amount <= 300000 and liquidity > 0.6:
            label = "BILATERAL_NETTING"
        elif pref == "FASTEST" and is_major and amount <= 30000:
            label = "REGIONAL_INSTANT"
        elif is_weekend == 1 and pref == "FASTEST" and amount <= 5000:
            label = "CARD_PAYOUT"
        elif amount <= 15000 and is_major and pref != "RELIABLE":
            label = "REGIONAL_INSTANT"
        elif is_major == 0 or amount > 250000:
            label = "SWIFT_CORRESPONDENT"
        else:
            if pref == "CHEAPEST":
                label = "BILATERAL_NETTING" if amount > 5000 else "REGIONAL_INSTANT"
            else:
                label = "REGIONAL_INSTANT" if amount <= 50000 else "SWIFT_CORRESPONDENT"

        records.append({
            "amount": amount,
            "amount_log": np.log1p(amount),
            "is_weekend": is_weekend,
            "time_of_day_utc": time_of_day,
            "pref_cheapest": 1 if pref == "CHEAPEST" else 0,
            "pref_fastest": 1 if pref == "FASTEST" else 0,
            "pref_reliable": 1 if pref == "RELIABLE" else 0,
            "is_major_corridor": is_major,
            "fx_volatility_pct": fx_vol,
            "liquidity_ratio": liquidity,
            "optimal_rail": label
        })

    return pd.DataFrame(records)

def train_rail_model():
    print("=" * 80)
    print(" [MODEL 2] OPTIMAL PAYMENT RAIL RECOMMENDATION MODEL")
    print("           TRAINING ACROSS 2 EPOCHS / RUNS (50,000 SCENARIOS)")
    print("=" * 80)
    total_start = time.time()

    print("\n[1] Generating 50,000 comprehensive multi-attribute payment routing records...")
    df = synthesize_routing_dataset(50000)
    print(f"    -> Generated: {len(df):,} records across 5 rail classes.")

    # Split 80/20
    X = df[FEATURE_COLUMNS].copy()
    y = df["optimal_rail"].copy()

    split_idx = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    print(f"\n[2] Partitioned Dataset:")
    print(f"    -> Training Partition : {len(X_train):,} scenarios (80.0%)")
    print(f"    -> Validation Test Set: {len(X_test):,} scenarios (20.0%)")

    # =========================================================================
    # EPOCH 1 / RUN 1
    # =========================================================================
    print("\n" + "-" * 80)
    print(" >>> STARTING TRAINING EPOCH 1 / RUN 1 (60 Estimators - Initial Ensemble Fit)")
    print("-" * 80)
    ep1_start = time.time()

    clf = RandomForestClassifier(
        n_estimators=60,
        max_depth=10,
        min_samples_split=8,
        class_weight="balanced",
        warm_start=True,
        random_state=42
    )

    clf.fit(X_train, y_train)
    ep1_duration = time.time() - ep1_start

    preds_ep1 = clf.predict(X_test)
    probs_ep1 = clf.predict_proba(X_test)
    acc_ep1 = accuracy_score(y_test, preds_ep1) * 100.0
    loss_ep1 = log_loss(y_test, probs_ep1)

    print(f" [EPOCH 1 RESULTS] Completed in {ep1_duration:.2f}s:")
    print(f"   * Estimators Built        : {clf.n_estimators}")
    print(f"   * Test Accuracy           : {acc_ep1:.2f}%")
    print(f"   * Log-Loss Cross-Entropy  : {loss_ep1:.4f}")

    # =========================================================================
    # EPOCH 2 / RUN 2
    # =========================================================================
    print("\n" + "-" * 80)
    print(" >>> STARTING TRAINING EPOCH 2 / RUN 2 (120 Estimators - Refinement Expansion)")
    print("-" * 80)
    ep2_start = time.time()

    clf.set_params(n_estimators=120, max_depth=12)
    clf.fit(X_train, y_train)
    ep2_duration = time.time() - ep2_start

    preds_ep2 = clf.predict(X_test)
    probs_ep2 = clf.predict_proba(X_test)
    acc_ep2 = accuracy_score(y_test, preds_ep2) * 100.0
    loss_ep2 = log_loss(y_test, probs_ep2)

    print(f" [EPOCH 2 RESULTS] Completed in {ep2_duration:.2f}s:")
    print(f"   * Estimators Built        : {clf.n_estimators}")
    print(f"   * Test Accuracy           : {acc_ep2:.2f}%")
    print(f"   * Log-Loss Cross-Entropy  : {loss_ep2:.4f}")

    # Convergence Delta
    print("\n" + "=" * 80)
    print(" [EPOCH CONVERGENCE DELTA ANALYSIS]")
    print("=" * 80)
    print(f"   * Accuracy Delta  : {acc_ep2 - acc_ep1:+.2f}%")
    print(f"   * Log-Loss Delta  : {loss_ep2 - loss_ep1:+.4f} ({'Refined' if loss_ep2 <= loss_ep1 else 'Stable'})")
    print(f"   * Total Ensemble Training Time: {ep1_duration + ep2_duration:.2f}s")

    print("\n    -> Final Classification Report:")
    report = classification_report(y_test, preds_ep2)
    for line in report.splitlines():
        print(f"       {line}")

    # Global Feature Importances
    importances = {
        col: round(float(imp), 4)
        for col, imp in sorted(zip(FEATURE_COLUMNS, clf.feature_importances_), key=lambda x: x[1], reverse=True)
    }
    print("\n    -> Top Feature Importances:")
    for col, imp in list(importances.items())[:5]:
        print(f"       * {col:<20}: {imp:.4f}")

    # Save Trained Artifact
    os.makedirs(MODEL_DIR, exist_ok=True)
    metadata = {
        "model_name": "RailRecommendationModel",
        "algorithm": "RandomForestClassifier",
        "epochs": 2,
        "n_estimators": clf.n_estimators,
        "classes": list(clf.classes_),
        "epoch_1_metrics": {"accuracy_pct": acc_ep1, "log_loss": loss_ep1},
        "epoch_2_metrics": {"accuracy_pct": acc_ep2, "log_loss": loss_ep2},
        "final_accuracy_pct": round(acc_ep2, 2),
        "feature_importances": importances,
        "training_samples": len(X_train),
        "trained_at": datetime.now(UTC).isoformat()
    }

    joblib.dump({"model": clf, "metadata": metadata}, MODEL_PATH)
    print(f"\n[3] Model successfully saved to: {MODEL_PATH}")
    print(f"    -> End-to-end pipeline finished in {time.time() - total_start:.2f} seconds.")

    # Demonstration Inferences
    print("\n" + "=" * 80)
    print(" [INFERENCE DEMO] Payment Rail Recommendation Output")
    print("=" * 80)

    test_cases = [
        {"amount": 3500.0, "corridor": "USD/EUR", "pref": "FASTEST", "is_weekend": True},
        {"amount": 45000.0, "corridor": "USD/INR", "pref": "CHEAPEST", "is_weekend": False},
        {"amount": 350000.0, "corridor": "USD/EUR", "pref": "BALANCED", "is_weekend": False},
        {"amount": 12000.0, "corridor": "USD/ZAR", "pref": "RELIABLE", "is_weekend": False}
    ]

    for tc in test_cases:
        res = predict_rail(clf, tc["amount"], tc["corridor"], tc["pref"], tc["is_weekend"])
        print(f"\n Transfer: ${tc['amount']:,.2f} {tc['corridor']} | Priority: {tc['pref']} | Weekend: {tc['is_weekend']}")
        print(f" -> Recommended Rail : [{res['recommended_rail']}] (Confidence: {res['confidence_score']*100:.1f}%)")
        print(f" -> Probabilities    : {res['rail_probabilities']}")
        print(f" -> Advisory Rationale: {res['advisory_rationale']}")

def predict_rail(model, amount_usd: float, corridor_slug: str = "USD/EUR", preference: str = "BALANCED", is_weekend: bool = False, time_of_day_utc: int = 14):
    major_corridors = {"USD/EUR", "USD/GBP", "USD/INR", "EUR/GBP", "USD/JPY", "USD/CAD"}
    is_major = 1 if corridor_slug in major_corridors else 0

    feat_vector = pd.DataFrame([{
        "amount_log": float(np.log1p(max(1.0, amount_usd))),
        "is_weekend": 1 if is_weekend else 0,
        "time_of_day_utc": time_of_day_utc,
        "pref_cheapest": 1 if preference.upper() == "CHEAPEST" else 0,
        "pref_fastest": 1 if preference.upper() == "FASTEST" else 0,
        "pref_reliable": 1 if preference.upper() == "RELIABLE" else 0,
        "is_major_corridor": is_major,
        "fx_volatility_pct": 0.5,
        "liquidity_ratio": 0.85
    }])

    probs = model.predict_proba(feat_vector)[0]
    classes = list(model.classes_)
    prob_dict = {cls: round(float(p), 4) for cls, p in zip(classes, probs)}
    best_rail = str(model.predict(feat_vector)[0])
    confidence = float(np.max(probs))

    if best_rail == "REGIONAL_INSTANT":
        rationale = f"Instant domestic clearing network selected. Transfer size (${amount_usd:,.2f}) fits within real-time clearing caps with near-zero latency."
    elif best_rail == "BILATERAL_NETTING":
        rationale = f"Internal multilateral netting selected under {preference} priority to minimize external correspondent banking fees."
    elif best_rail == "RTGS_SETTLEMENT":
        rationale = f"Large institutional gross settlement recommended for immediate central-bank finality on high-value transfer (${amount_usd:,.2f})."
    elif best_rail == "CARD_PAYOUT":
        rationale = f"Real-time push-to-card selected to bypass traditional weekend banking cutoffs."
    else:
        rationale = f"SWIFT GPI cross-border network selected for universal multi-hop reach in this corridor."

    return {
        "recommended_rail": best_rail,
        "confidence_score": round(confidence, 3),
        "rail_probabilities": prob_dict,
        "advisory_rationale": rationale
    }

if __name__ == "__main__":
    train_rail_model()
