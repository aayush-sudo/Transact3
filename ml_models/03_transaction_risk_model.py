#!/usr/bin/env python3
"""
Transact3 - Model 3: Transaction Anomaly & Compliance Risk Scoring Model
========================================================================
Algorithm: IsolationForest (Unsupervised ML) + Regulatory Heuristics Engine
Artifact:  saved_models/risk_model.joblib

Trains across 2 Epochs / Runs on 50,000 multi-attribute transaction behavioral records.
"""

import os
import sys
import time
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, UTC
from sklearn.ensemble import IsolationForest

# Ensure clean UTF-8 printing on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
MODEL_PATH = os.path.join(MODEL_DIR, "risk_model.joblib")

FEATURE_COLUMNS = [
    "amount_log",
    "velocity_count_24h",
    "velocity_amount_log",
    "corridor_risk_score",
    "off_hours_flag",
    "structuring_flag"
]

HIGH_RISK_JURISDICTIONS = {"PRK", "IRN", "SYR", "RUS", "MMR", "CUB", "SDN"}
MEDIUM_RISK_JURISDICTIONS = {"TUR", "UAE", "CYP", "PAN", "VNM", "NGA", "PAK"}

def synthesize_transaction_records(n_samples: int = 50000) -> pd.DataFrame:
    """
    Generates 50,000 realistic cross-border payment behavioral records.
    """
    np.random.seed(42)
    records = []

    for _ in range(n_samples):
        is_anomaly = np.random.choice([0, 1], p=[0.97, 0.03])
        
        if is_anomaly:
            amount = float(np.random.choice([
                np.random.uniform(9400, 9995),   # Structuring near $10k
                np.random.exponential(450000)    # Whale outlier
            ]))
            velocity_count = int(np.random.randint(6, 25))
            velocity_amount = amount * float(np.random.uniform(3, 8))
            corridor_risk = float(np.random.choice([0.45, 0.85, 0.95]))
            off_hours = int(np.random.choice([0, 1], p=[0.25, 0.75]))
        else:
            amount = float(np.exp(np.random.uniform(np.log(100), np.log(75000))))
            velocity_count = int(np.random.poisson(1.2))
            velocity_amount = amount * float(np.random.uniform(1.0, 1.8))
            corridor_risk = float(np.random.choice([0.05, 0.15, 0.25]))
            off_hours = int(np.random.choice([0, 1], p=[0.90, 0.10]))

        structuring = 1 if (9000 <= amount <= 9999) else 0

        records.append({
            "amount": amount,
            "amount_log": np.log1p(amount),
            "velocity_count_24h": velocity_count,
            "velocity_amount_log": np.log1p(velocity_amount),
            "corridor_risk_score": corridor_risk,
            "off_hours_flag": off_hours,
            "structuring_flag": structuring
        })

    return pd.DataFrame(records)

def train_risk_model():
    print("=" * 80)
    print(" [MODEL 3] TRANSACTION ANOMALY & COMPLIANCE RISK MODEL")
    print("           TRAINING ACROSS 2 EPOCHS / RUNS (50,000 RECORDS)")
    print("=" * 80)
    total_start = time.time()

    print("\n[1] Generating 50,000 multi-attribute transaction behavioral records...")
    df = synthesize_transaction_records(50000)
    print(f"    -> Prepared {len(df):,} baseline records with {len(FEATURE_COLUMNS)} behavioral features.")

    X = df[FEATURE_COLUMNS].copy()

    # =========================================================================
    # EPOCH 1 / RUN 1
    # =========================================================================
    print("\n" + "-" * 80)
    print(" >>> STARTING TRAINING EPOCH 1 / RUN 1 (75 Trees - Contamination 0.035)")
    print("-" * 80)
    ep1_start = time.time()

    iso_ep1 = IsolationForest(
        n_estimators=75,
        contamination=0.035,
        max_samples="auto",
        warm_start=True,
        random_state=42
    )

    iso_ep1.fit(X)
    ep1_duration = time.time() - ep1_start

    preds_ep1 = iso_ep1.predict(X)
    scores_ep1 = iso_ep1.decision_function(X)
    outliers_ep1 = int(np.sum(preds_ep1 == -1))

    print(f" [EPOCH 1 RESULTS] Completed in {ep1_duration:.2f}s:")
    print(f"   * Estimators Built        : {iso_ep1.n_estimators}")
    print(f"   * Outliers Isolated       : {outliers_ep1:,} ({outliers_ep1/len(X)*100:.2f}%)")
    print(f"   * Mean Anomaly Score      : {np.mean(scores_ep1):.4f}")
    print(f"   * Min / Max Anomaly Bounds: [{np.min(scores_ep1):.4f}, {np.max(scores_ep1):.4f}]")

    # =========================================================================
    # EPOCH 2 / RUN 2
    # =========================================================================
    print("\n" + "-" * 80)
    print(" >>> STARTING TRAINING EPOCH 2 / RUN 2 (150 Trees - Calibrated Contamination 0.030)")
    print("-" * 80)
    ep2_start = time.time()

    iso_ep2 = IsolationForest(
        n_estimators=150,
        contamination=0.030,
        max_samples="auto",
        warm_start=False,
        random_state=42
    )

    iso_ep2.fit(X)
    ep2_duration = time.time() - ep2_start

    preds_ep2 = iso_ep2.predict(X)
    scores_ep2 = iso_ep2.decision_function(X)
    outliers_ep2 = int(np.sum(preds_ep2 == -1))

    print(f" [EPOCH 2 RESULTS] Completed in {ep2_duration:.2f}s:")
    print(f"   * Estimators Built        : {iso_ep2.n_estimators}")
    print(f"   * Outliers Isolated       : {outliers_ep2:,} ({outliers_ep2/len(X)*100:.2f}%)")
    print(f"   * Mean Anomaly Score      : {np.mean(scores_ep2):.4f}")
    print(f"   * Min / Max Anomaly Bounds: [{np.min(scores_ep2):.4f}, {np.max(scores_ep2):.4f}]")

    # Convergence Delta
    print("\n" + "=" * 80)
    print(" [EPOCH CONVERGENCE DELTA ANALYSIS]")
    print("=" * 80)
    print(f"   * Calibrated Outlier Shift: {outliers_ep2 - outliers_ep1:+d} records")
    print(f"   * Anomaly Score Variance  : {np.var(scores_ep2):.6f} (Refined boundary sharpness)")
    print(f"   * Cumulative Isolation Forest Training Time: {ep1_duration + ep2_duration:.2f}s")

    # Save Trained Artifact
    os.makedirs(MODEL_DIR, exist_ok=True)
    metadata = {
        "model_name": "TransactionRiskModel",
        "algorithm": "IsolationForest",
        "epochs": 2,
        "n_estimators": iso_ep2.n_estimators,
        "features": FEATURE_COLUMNS,
        "training_samples": len(X),
        "epoch_1_metrics": {"contamination": 0.035, "outliers_isolated": outliers_ep1},
        "epoch_2_metrics": {"contamination": 0.030, "outliers_isolated": outliers_ep2},
        "final_outliers_count": outliers_ep2,
        "trained_at": datetime.now(UTC).isoformat()
    }

    joblib.dump({"model": iso_ep2, "metadata": metadata}, MODEL_PATH)
    print(f"\n[3] Model successfully saved to: {MODEL_PATH}")
    print(f"    -> End-to-end pipeline finished in {time.time() - total_start:.2f} seconds.")

    # Demonstration Inferences
    print("\n" + "=" * 80)
    print(" [INFERENCE DEMO] Transaction Risk & Compliance Scoring Output")
    print("=" * 80)

    test_cases = [
        {
            "desc": "Standard Low-Risk Business Transfer",
            "amount": 2500.0,
            "dest_country": "DE",
            "velocity": 1,
            "time_utc": 14,
            "sanction_score": 0.0
        },
        {
            "desc": "BSA Structuring Suspicion ($9,850 Transfer)",
            "amount": 9850.0,
            "dest_country": "FR",
            "velocity": 2,
            "time_utc": 11,
            "sanction_score": 0.0
        },
        {
            "desc": "High-Velocity Burst (8 Transfers in 24h) Off-Hours",
            "amount": 18000.0,
            "dest_country": "SG",
            "velocity": 8,
            "time_utc": 3,
            "sanction_score": 0.0
        },
        {
            "desc": "Sanctions Match Alert on Recipient Name",
            "amount": 5000.0,
            "dest_country": "US",
            "velocity": 1,
            "time_utc": 16,
            "sanction_score": 0.88
        }
    ]

    for tc in test_cases:
        res = predict_risk(
            iso_ep2,
            amount_usd=tc["amount"],
            destination_country=tc["dest_country"],
            velocity_24h_count=tc["velocity"],
            time_of_day_utc=tc["time_utc"],
            sanction_match_score=tc["sanction_score"]
        )
        print(f"\n Scenario       : {tc['desc']}")
        print(f" Amount         : ${tc['amount']:,.2f} to {tc['dest_country']} (Velocity: {tc['velocity']})")
        print(f" -> Risk Score  : {res['composite_risk_score']:.3f} | Risk Tier: [{res['risk_tier']}]")
        print(f" -> Anomaly Flag: {'YES' if res['anomaly_detected'] else 'NO'} (Score: {res['anomaly_score']:.3f})")
        print(f" -> Advisory    : {res['advisory_action']}")
        if res["risk_factors"]:
            print(f" -> Triggers    : {[f['factor'] for f in res['risk_factors']]}")

def predict_risk(
    model,
    amount_usd: float,
    source_country: str = "US",
    destination_country: str = "DE",
    velocity_24h_count: int = 1,
    time_of_day_utc: int = 14,
    sanction_match_score: float = 0.0
):
    off_hours = 1 if (0 <= time_of_day_utc <= 4) else 0
    structuring = 1 if (9000 <= amount_usd <= 9999) else 0

    corridor_risk = 0.10
    if destination_country in HIGH_RISK_JURISDICTIONS or source_country in HIGH_RISK_JURISDICTIONS:
        corridor_risk = 0.90
    elif destination_country in MEDIUM_RISK_JURISDICTIONS or source_country in MEDIUM_RISK_JURISDICTIONS:
        corridor_risk = 0.40

    velocity_amount = amount_usd * max(1.0, float(velocity_24h_count))

    feat_vector = pd.DataFrame([{
        "amount_log": float(np.log1p(amount_usd)),
        "velocity_count_24h": velocity_24h_count,
        "velocity_amount_log": float(np.log1p(velocity_amount)),
        "corridor_risk_score": corridor_risk,
        "off_hours_flag": off_hours,
        "structuring_flag": structuring
    }])

    raw_score = float(model.decision_function(feat_vector)[0])
    anomaly_score = float(np.clip(0.5 - raw_score * 2.0, 0.0, 1.0))
    is_anomaly = bool(model.predict(feat_vector)[0] == -1)

    risk_factors = []
    score_additions = 0.0

    if sanction_match_score > 0.65:
        score_additions += sanction_match_score * 0.70
        risk_factors.append({
            "factor": "SANCTION_SCREENING_ALERT",
            "severity": "CRITICAL",
            "detail": f"Matched sanction database with confidence {sanction_match_score*100:.1f}%"
        })
    elif sanction_match_score > 0.40:
        score_additions += 0.20
        risk_factors.append({
            "factor": "PEP_OR_SANCTION_PROXIMITY",
            "severity": "MEDIUM",
            "detail": "Fuzzy name match requires secondary verification"
        })

    if structuring:
        score_additions += 0.35
        risk_factors.append({
            "factor": "STRUCTURING_SUSPICION",
            "severity": "HIGH",
            "detail": f"Transfer amount ${amount_usd:,.2f} is just below BSA $10,000 mandatory reporting threshold"
        })

    if velocity_24h_count >= 5:
        score_additions += 0.25
        risk_factors.append({
            "factor": "VELOCITY_SPIKE",
            "severity": "HIGH",
            "detail": f"{velocity_24h_count} transactions initiated in the past 24 hours"
        })

    if corridor_risk >= 0.80:
        score_additions += 0.40
        risk_factors.append({
            "factor": "HIGH_RISK_JURISDICTION",
            "severity": "CRITICAL",
            "detail": f"Destination country '{destination_country}' is subject to FATF monitoring"
        })

    if is_anomaly:
        risk_factors.append({
            "factor": "MULTIVARIATE_ANOMALY_DETECTED",
            "severity": "MEDIUM",
            "detail": "Isolation Forest flagged statistical divergence from corridor profile"
        })

    composite_score = float(np.clip(
        0.4 * anomaly_score + 0.6 * score_additions + 0.1 * corridor_risk,
        0.0,
        1.0
    ))

    if composite_score > 0.70 or sanction_match_score >= 0.80:
        risk_tier = "HIGH"
        advisory_action = "MANDATORY_REVIEW: Transfer exceeds institutional risk appetite. Manual AML clearance required."
    elif composite_score >= 0.35:
        risk_tier = "MEDIUM"
        advisory_action = "ENHANCED_DUE_DILIGENCE: Secondary verification recommended before settlement."
    else:
        risk_tier = "LOW"
        advisory_action = "PASSED: Compliant with regulatory baselines. Standard routing approved."

    return {
        "composite_risk_score": round(composite_score, 3),
        "risk_tier": risk_tier,
        "anomaly_detected": is_anomaly,
        "anomaly_score": round(anomaly_score, 3),
        "advisory_action": advisory_action,
        "risk_factors": risk_factors
    }

if __name__ == "__main__":
    train_risk_model()
