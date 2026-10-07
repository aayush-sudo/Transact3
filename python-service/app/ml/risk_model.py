import os
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, Any, Optional, List
from sklearn.ensemble import IsolationForest
from app.ml.model_paths import MODEL_DIR

MODEL_PATH = MODEL_DIR / "risk_model.joblib"

RISK_FEATURE_COLUMNS = [
    "amount_log",
    "velocity_count_24h",
    "velocity_amount_log",
    "corridor_risk_score",
    "off_hours_flag",
    "structuring_flag"
]

HIGH_RISK_JURISDICTIONS = {"PRK", "IRN", "SYR", "RUS", "MMR", "CUB", "SDN"}
MEDIUM_RISK_JURISDICTIONS = {"TUR", "UAE", "CYP", "PAN", "VNM", "NGA", "PAK"}

class TransactionRiskModel:
    """
    Model 3: Transaction Risk & Compliance Scoring Model
    Hybrid Machine Learning Architecture:
    - Isolation Forest for multidimensional transactional anomaly detection
    - Calibrated BSA/AML regulatory heuristic engine for structuring, velocity, and sanction screening.
    """
    def __init__(self):
        self.model: Optional[IsolationForest] = None
        self.metadata: Dict[str, Any] = {}
        self.is_loaded: bool = False
        self._load_if_exists()

    def _load_if_exists(self):
        if os.path.exists(MODEL_PATH):
            try:
                bundle = joblib.load(MODEL_PATH)
                self.model = bundle["model"]
                self.metadata = bundle.get("metadata", {})
                self.is_loaded = True
            except Exception as e:
                print(f"[RiskModel] Failed to load cached model: {e}")

    @staticmethod
    def generate_synthetic_transactions(n_samples: int = 15000) -> pd.DataFrame:
        """
        Generates baseline transactional behavior with a 3% deliberate anomaly injection rate.
        """
        np.random.seed(42)
        records = []

        for _ in range(n_samples):
            # Normal distribution: typical business cross-border payments
            is_anomaly = np.random.choice([0, 1], p=[0.97, 0.03])
            
            if is_anomaly:
                amount = float(np.random.choice([
                    np.random.uniform(9500, 9990), # Structuring near BSA $10k
                    np.random.exponential(500000)   # Whale outlier
                ]))
                velocity_count = int(np.random.randint(6, 25))
                velocity_amount = amount * float(np.random.uniform(3, 10))
                corridor_risk = float(np.random.choice([0.45, 0.85, 0.95]))
                off_hours = int(np.random.choice([0, 1], p=[0.2, 0.8]))
            else:
                amount = float(np.exp(np.random.uniform(np.log(100), np.log(80000))))
                velocity_count = int(np.random.poisson(1.2))
                velocity_amount = amount * float(np.random.uniform(1.0, 2.0))
                corridor_risk = float(np.random.choice([0.05, 0.15, 0.25]))
                off_hours = int(np.random.choice([0, 1], p=[0.92, 0.08]))

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

    def train(self, df_transactions: Optional[pd.DataFrame] = None) -> Dict[str, Any]:
        """
        Trains Isolation Forest anomaly detector.
        """
        if df_transactions is None or df_transactions.empty:
            df_transactions = self.generate_synthetic_transactions(20000)

        X = df_transactions[RISK_FEATURE_COLUMNS].copy()

        iso_forest = IsolationForest(
            n_estimators=150,
            contamination=0.03,
            max_samples="auto",
            random_state=42
        )

        iso_forest.fit(X)

        self.metadata = {
            "model_type": "IsolationForest",
            "features": RISK_FEATURE_COLUMNS,
            "training_samples": len(X),
            "contamination_rate": 0.03,
            "trained_at": datetime.utcnow().isoformat()
        }

        self.model = iso_forest
        self.is_loaded = True

        os.makedirs(MODEL_DIR, exist_ok=True)
        joblib.dump({"model": self.model, "metadata": self.metadata}, MODEL_PATH)
        print(f"[RiskModel] Model saved to {MODEL_PATH}")
        print(f"[RiskModel] Trained on {len(X)} transaction records.")

        return self.metadata

    def predict_risk(
        self,
        amount_usd: float,
        recipient_name: str = "",
        source_country: str = "US",
        destination_country: str = "EU",
        velocity_24h_count: int = 1,
        time_of_day_utc: Optional[int] = None,
        sanction_match_score: float = 0.0
    ) -> Dict[str, Any]:
        """
        Calculates composite compliance risk score (0.0 to 1.0) and anomaly assessment.
        """
        now = datetime.utcnow()
        if time_of_day_utc is None:
            time_of_day_utc = now.hour

        off_hours = 1 if (0 <= time_of_day_utc <= 4) else 0
        structuring = 1 if (9000 <= amount_usd <= 9999) else 0

        # Assess corridor risk
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

        anomaly_score = 0.0
        is_anomaly = False

        if self.is_loaded and self.model is not None:
            try:
                # decision_function yields negative for anomalies, positive for inliers
                raw_score = float(self.model.decision_function(feat_vector)[0])
                # Map decision function roughly to [0, 1] anomaly likelihood
                anomaly_score = float(np.clip(0.5 - raw_score * 2.0, 0.0, 1.0))
                is_anomaly = bool(self.model.predict(feat_vector)[0] == -1)
            except Exception as e:
                print(f"[RiskModel] Inference warning: {e}")
                anomaly_score = 0.15
        else:
            anomaly_score = 0.10

        # Assemble regulatory risk factors
        risk_factors = []
        score_additions = 0.0

        if sanction_match_score > 0.65:
            score_additions += sanction_match_score * 0.70
            risk_factors.append({
                "factor": "SANCTION_SCREENING_ALERT",
                "severity": "CRITICAL",
                "detail": f"Recipient matched sanction database with confidence {sanction_match_score*100:.1f}%"
            })
        elif sanction_match_score > 0.40:
            score_additions += 0.20
            risk_factors.append({
                "factor": "POTENTIAL_PEP_OR_SANCTION_PROXIMITY",
                "severity": "MEDIUM",
                "detail": "Fuzzy name match requires secondary verification"
            })

        if structuring:
            score_additions += 0.35
            risk_factors.append({
                "factor": "STRUCTURING_SUSPICION",
                "severity": "HIGH",
                "detail": f"Transfer amount ${amount_usd:,.2f} is just below BSA $10,000 mandatory CTR filing threshold"
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
                "detail": f"Destination '{destination_country}' is subject to heightened FATF monitoring or sanctions"
            })

        if is_anomaly:
            risk_factors.append({
                "factor": "MULTIVARIATE_ANOMALY_DETECTED",
                "severity": "MEDIUM",
                "detail": "Isolation Forest flagged statistical divergence from corridor profile"
            })

        # Calculate final composite risk score (0.00 to 1.00)
        composite_score = float(np.clip(
            0.4 * anomaly_score + 0.6 * score_additions + 0.1 * corridor_risk,
            0.0,
            1.0
        ))

        # Classify Risk Tier
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
            "sanction_match_score": round(sanction_match_score, 3),
            "advisory_action": advisory_action,
            "risk_factors": risk_factors,
            "model_metadata": {
                "algorithm": self.metadata.get(
                    "model_type",
                    self.metadata.get("algorithm", "IsolationForest")
                ),
                "trained_samples": self.metadata.get("training_samples", 20000)
            }
        }

transaction_risk_model = TransactionRiskModel()
