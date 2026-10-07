#!/usr/bin/env python3
"""
Transact3 ML Training Pipeline
==============================
Trains and serializes all 3 core Machine Learning models:
1. Currency Rate Prediction & Execution Timing (HistGradientBoostingRegressor)
2. Optimal Payment Rail Recommendation (RandomForestClassifier)
3. Transaction Anomaly & Compliance Risk Scoring (IsolationForest + Regulatory Heuristics)

Usage:
    python train_models.py
"""

import os
import sys
import time

# Ensure python-service root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.ml.dataset_loader import load_or_create_ohlc_dataset, prepare_multi_slug_dataset
from app.ml.currency_model import currency_forecaster
from app.ml.rail_model import rail_recommender
from app.ml.risk_model import transaction_risk_model

def run_training_pipeline():
    print("=" * 70)
    print(" Transact3 Quantitative ML Training Engine")
    print("=" * 70)
    start_total = time.time()

    # ---------------------------------------------------------
    # 1. Model 1: Currency Rate Prediction & Execution Timing
    # ---------------------------------------------------------
    print("\n[Step 1/3] Training Currency Rate Prediction & Timing Model...")
    t0 = time.time()
    raw_ohlc = load_or_create_ohlc_dataset()
    print(f" -> Raw OHLC records: {len(raw_ohlc):,} across {raw_ohlc['slug'].nunique()} pairs")
    
    print(" -> Extracting technical indicators (MACD, RSI, SMA, Volatility, Lags)...")
    featured_df = prepare_multi_slug_dataset(raw_ohlc, max_rows_per_slug=2000)
    print(f" -> Feature matrix prepared: {featured_df.shape[0]:,} samples x {featured_df.shape[1]} columns")
    
    currency_meta = currency_forecaster.train(featured_df)
    t1 = time.time()
    print(f" -> Currency Model trained in {t1 - t0:.2f}s:")
    print(f"    - Algorithm: {currency_meta['model_type']}")
    print(f"    - Directional Accuracy: {currency_meta['directional_accuracy_pct']}%")
    print(f"    - MAE: {currency_meta['mae_return']} | RMSE: {currency_meta['rmse_return']} | R2: {currency_meta['r2_score']}")

    # ---------------------------------------------------------
    # 2. Model 2: Optimal Rail Recommendation Model
    # ---------------------------------------------------------
    print("\n[Step 2/3] Training Optimal Payment Rail Recommendation Model...")
    t0 = time.time()
    rail_meta = rail_recommender.train()
    t1 = time.time()
    print(f" -> Rail Model trained in {t1 - t0:.2f}s:")
    print(f"    - Algorithm: {rail_meta['model_type']}")
    print(f"    - Test Accuracy: {rail_meta['accuracy_pct']}%")
    print(f"    - Supported Rails: {rail_meta['classes']}")
    print(f"    - Top Features: {list(rail_meta['feature_importances'].keys())[:4]}")

    # ---------------------------------------------------------
    # 3. Model 3: Transaction Anomaly & Risk Scoring Model
    # ---------------------------------------------------------
    print("\n[Step 3/3] Training Transaction Anomaly & Compliance Risk Model...")
    t0 = time.time()
    risk_meta = transaction_risk_model.train()
    t1 = time.time()
    print(f" -> Risk Model trained in {t1 - t0:.2f}s:")
    print(f"    - Algorithm: {risk_meta['model_type']}")
    print(f"    - Training Samples: {risk_meta['training_samples']:,}")
    print(f"    - Contamination Rate: {risk_meta['contamination_rate']}")

    # ---------------------------------------------------------
    # 4. End-to-End Validation / Verification
    # ---------------------------------------------------------
    print("\n" + "=" * 70)
    print(" Running End-to-End Sample Advisory Inferences")
    print("=" * 70)

    # Test Currency Model
    sample_fx = currency_forecaster.predict_timing_advice("USD/EUR", current_rate=0.92, amount=25000.0)
    print(f" [Currency Advisory] USD/EUR Rate: {sample_fx['current_rate']} -> Forecast 24h: {sample_fx['forecasted_rate_24h']} "
          f"({sample_fx['forecasted_return_pct']:+.2f}%) | Action: {sample_fx['timing_advisory']['recommendation']}")

    # Test Rail Model
    sample_rail = rail_recommender.predict_rail(amount_usd=5000.0, corridor_slug="USD/EUR", preference="FASTEST")
    print(f" [Rail Advisory] $5,000 FASTEST -> Recommended: {sample_rail['recommended_rail']} "
          f"(Confidence: {sample_rail['confidence_score']*100:.1f}%)")

    # Test Risk Model
    sample_risk = transaction_risk_model.predict_risk(amount_usd=9850.0, destination_country="DE", velocity_24h_count=1)
    print(f" [Risk Advisory] $9,850 Transfer -> Risk Tier: {sample_risk['risk_tier']} "
          f"(Score: {sample_risk['composite_risk_score']:.3f}) | Action: {sample_risk['advisory_action'][:40]}...")

    elapsed = time.time() - start_total
    print("\n" + "=" * 70)
    print(f" [SUCCESS] All 3 Machine Learning Models trained and ready in {elapsed:.2f} seconds!")
    print(" Artifacts serialized to: ml_models/saved_models/")
    print("=" * 70)

if __name__ == "__main__":
    run_training_pipeline()
