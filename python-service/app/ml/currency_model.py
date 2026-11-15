import os
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score

from app.ml.dataset_loader import FEATURE_COLUMNS, extract_technical_features
from app.ml.model_paths import MODEL_DIR

MODEL_PATH = MODEL_DIR / "currency_model.joblib"

class CurrencyForecaster:
    """
    Model 1: FX Exchange Rate Prediction & Execution Timing Model
    Uses HistGradientBoostingRegressor trained on multi-pair OHLC historical data
    to forecast exchange rate trajectory and optimize execution timing.
    """
    def __init__(self):
        self.model: Optional[HistGradientBoostingRegressor] = None
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
                print(f"[CurrencyModel] Failed to load cached model: {e}")

    def train(self, df_featured: pd.DataFrame) -> Dict[str, Any]:
        """
        Trains HistGradientBoostingRegressor on technical features.
        """
        if df_featured.empty:
            raise ValueError("Training dataset is empty.")

        X = df_featured[FEATURE_COLUMNS].copy()
        y = df_featured["target_return_next"].copy()

        # Clean inf and NaN
        X = X.replace([np.inf, -np.inf], np.nan).fillna(0.0)
        y = y.replace([np.inf, -np.inf], np.nan).fillna(0.0)

        # Train / Test Split (Time-aware chronological split)
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
        y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

        regressor = HistGradientBoostingRegressor(
            max_iter=150,
            learning_rate=0.04,
            max_depth=6,
            min_samples_leaf=20,
            l2_regularization=0.1,
            random_state=42
        )

        regressor.fit(X_train, y_train)

        # Evaluate
        preds_train = regressor.predict(X_train)
        preds_test = regressor.predict(X_test)

        mae_test = float(mean_absolute_error(y_test, preds_test))
        rmse_test = float(root_mean_squared_error(y_test, preds_test))
        r2 = float(r2_score(y_test, preds_test))

        # Directional Accuracy (sign of actual vs sign of prediction)
        directional_correct = np.sum(np.sign(preds_test) == np.sign(y_test))
        directional_accuracy = float(directional_correct / len(y_test)) if len(y_test) > 0 else 0.5

        self.metadata = {
            "model_type": "HistGradientBoostingRegressor",
            "features": FEATURE_COLUMNS,
            "data_from": df_featured["date"].min().date().isoformat(),
            "data_through": df_featured["date"].max().date().isoformat(),
            "training_samples": len(X_train),
            "test_samples": len(X_test),
            "mae_return": round(mae_test, 6),
            "rmse_return": round(rmse_test, 6),
            "r2_score": round(r2, 4),
            "directional_accuracy_pct": round(directional_accuracy * 100, 2),
            "trained_at": datetime.utcnow().isoformat()
        }

        self.model = regressor
        self.is_loaded = True

        os.makedirs(MODEL_DIR, exist_ok=True)
        joblib.dump({"model": self.model, "metadata": self.metadata}, MODEL_PATH)
        print(f"[CurrencyModel] Model saved to {MODEL_PATH}")
        print(f"[CurrencyModel] Test Metrics -> MAE: {mae_test:.6f}, RMSE: {rmse_test:.6f}, Directional Accuracy: {self.metadata['directional_accuracy_pct']}%")

        return self.metadata

    def predict_timing_advice(
        self,
        slug: str,
        current_rate: float,
        recent_observations: Optional[List[Dict[str, Any]]] = None,
        amount: float = 10000.0
    ) -> Dict[str, Any]:
        """
        Forecasts the next daily observation using actual dated reference rates.
        """
        if not self.is_loaded or self.model is None:
            raise RuntimeError("The trained FX model is not loaded.")
        if not recent_observations or len(recent_observations) < 35:
            raise ValueError("At least 35 actual dated FX observations are required.")

        slug = str(slug).upper()
        currency = slug.split("/")[-1]
        observations = pd.DataFrame(recent_observations)
        if not {"date", "rate"}.issubset(observations.columns):
            raise ValueError("FX observations must include date and rate.")
        observations["date"] = pd.to_datetime(observations["date"], errors="coerce")
        observations["close"] = pd.to_numeric(observations["rate"], errors="coerce")
        observations = observations.dropna(subset=["date", "close"])
        observations = observations[observations["close"] > 0]
        observations = observations.sort_values("date").drop_duplicates("date").reset_index(drop=True)
        if len(observations) < 35:
            raise ValueError("At least 35 valid dated FX observations are required.")

        df_rates = self._build_close_only_ohlc(observations, slug, currency)
        current_observation_rate = float(df_rates.iloc[-1]["close"])
        if abs(current_observation_rate - float(current_rate)) / current_observation_rate > 1e-6:
            raise ValueError("The supplied current rate does not match the latest historical observation.")

        backtest = self._walk_forward_validation(df_rates)
        future_row = df_rates.iloc[-1].copy()
        future_row["date"] = future_row["date"] + timedelta(days=1)
        future_row["open"] = current_observation_rate
        future_row["high"] = current_observation_rate
        future_row["low"] = current_observation_rate
        future_row["close"] = current_observation_rate
        with_next_placeholder = pd.concat([df_rates, future_row.to_frame().T], ignore_index=True)
        with_next_placeholder["date"] = pd.to_datetime(with_next_placeholder["date"])
        feature_rows = extract_technical_features(with_next_placeholder)
        latest_date = df_rates.iloc[-1]["date"]
        current_features = feature_rows[feature_rows["date"] == latest_date]
        if current_features.empty:
            raise RuntimeError("Could not construct model features from the supplied FX observations.")

        latest_features = current_features.iloc[-1:][FEATURE_COLUMNS].replace(
            [np.inf, -np.inf], np.nan
        ).fillna(0.0)
        predicted_return = float(self.model.predict(latest_features)[0])
        predicted_rate = current_observation_rate * (1.0 + predicted_return)
        interval = backtest.get("absolute_error_quantile_90")
        lower_bound = upper_bound = None
        if interval is not None:
            lower_bound = round(current_observation_rate * (1.0 + predicted_return - interval), 5)
            upper_bound = round(current_observation_rate * (1.0 + predicted_return + interval), 5)

        latest_features_row = current_features.iloc[-1]
        volatility = float(latest_features_row["volatility_14d"])
        rsi = float(latest_features_row["rsi_14"])
        macd = float(latest_features_row["macd"])
        return_pct = predicted_return * 100.0
        delta_amount_target = round(amount * current_rate * predicted_return, 2)

        reliable = bool(backtest.get("reliability_gate_passed"))
        recommendation = "MODEL_SIGNAL_ONLY" if reliable else "INSUFFICIENT_EVIDENCE"
        rationale = (
            "Historical out-of-sample results passed the configured reliability gate; this remains an uncertain model signal."
            if reliable else
            "Historical out-of-sample results do not support using this model to time a transfer. Do not treat this projection as a recommendation."
        )

        return {
            "slug": slug,
            "current_rate": current_rate,
            "forecast_horizon": "next daily reference-rate observation",
            "forecasted_rate_next_observation": round(predicted_rate, 5),
            "forecasted_rate_24h": round(predicted_rate, 5),
            "forecasted_return_pct": round(return_pct, 3),
            "confidence_score": backtest.get("directional_accuracy_pct"),
            "confidence_type": "historical_directional_accuracy_not_calibrated_probability",
            "prediction_interval": {
                "lower_bound": lower_bound,
                "upper_bound": upper_bound,
                "confidence_level": "90% empirical absolute-error interval" if interval is not None else None
            },
            "technical_indicators": {
                "rsi_14": round(rsi, 2),
                "macd": round(macd, 5),
                "volatility_14d_pct": round(volatility * 100, 3)
            },
            "historical_validation": backtest,
            "timing_advisory": {
                "recommendation": recommendation,
                "action_window_hours": 0,
                "rationale": rationale,
                "projected_benefit_target_currency": round(delta_amount_target, 2) if reliable else None
            },
            "model_metadata": {
                "algorithm": self.metadata.get("algorithm", self.metadata.get("model_type", "HistGradientBoostingRegressor")),
                "trained_at": self.metadata.get("trained_at"),
                "training_data_through": self.metadata.get("data_through") or (
                    "2021-08-30" if self.metadata.get("total_dataset_rows") == 1453035 else None
                )
            }
        }

    @staticmethod
    def _build_close_only_ohlc(observations: pd.DataFrame, slug: str, currency: str) -> pd.DataFrame:
        close = observations["close"].astype(float)
        previous_close = close.shift(1).fillna(close)
        return pd.DataFrame({
            "date": observations["date"],
            "slug": slug,
            "currency": currency,
            "open": previous_close,
            "high": np.maximum(previous_close, close),
            "low": np.minimum(previous_close, close),
            "close": close
        }).reset_index(drop=True)

    def _walk_forward_validation(self, rates: pd.DataFrame) -> Dict[str, Any]:
        featured = extract_technical_features(rates)
        if len(featured) < 60:
            return {
                "status": "INSUFFICIENT_HISTORY",
                "observations": len(featured),
                "directional_accuracy_pct": None,
                "directional_accuracy_interval_95_pct": None,
                "mae_pct": None,
                "baseline_mae_pct": None,
                "rmse_pct": None,
                "r2": None,
                "absolute_error_quantile_90": None,
                "reliability_gate_passed": False
            }

        X = featured[FEATURE_COLUMNS].replace([np.inf, -np.inf], np.nan).fillna(0.0)
        actual = featured["target_return_next"].to_numpy(dtype=float)
        predicted = self.model.predict(X)
        valid = np.isfinite(actual) & np.isfinite(predicted)
        actual = actual[valid]
        predicted = predicted[valid]
        errors = predicted - actual
        count = len(actual)
        correct = int(np.sum(np.sign(predicted) == np.sign(actual)))
        accuracy = correct / count
        z = 1.96
        denominator = 1 + z * z / count
        center = (accuracy + z * z / (2 * count)) / denominator
        half_width = z * np.sqrt(accuracy * (1 - accuracy) / count + z * z / (4 * count * count)) / denominator
        mae = float(np.mean(np.abs(errors)))
        baseline_mae = float(np.mean(np.abs(actual)))
        rmse = float(np.sqrt(np.mean(np.square(errors))))
        actual_variance = float(np.sum(np.square(actual - np.mean(actual))))
        r2 = 1 - float(np.sum(np.square(errors))) / actual_variance if actual_variance else 0.0
        lower_accuracy = max(0.0, center - half_width)
        upper_accuracy = min(1.0, center + half_width)
        reliability_gate_passed = bool(count >= 100 and lower_accuracy > 0.5 and mae < baseline_mae)

        return {
            "status": "VALIDATED",
            "source": "Frankfurter dated daily reference rates",
            "evaluation_start": featured.iloc[0]["date"].date().isoformat(),
            "evaluation_end": featured.iloc[-1]["date"].date().isoformat(),
            "observations": count,
            "directional_accuracy_pct": round(accuracy * 100, 2),
            "directional_accuracy_interval_95_pct": [
                round(float(lower_accuracy * 100), 2),
                round(float(upper_accuracy * 100), 2)
            ],
            "mae_pct": round(mae * 100, 5),
            "baseline_mae_pct": round(baseline_mae * 100, 5),
            "rmse_pct": round(rmse * 100, 5),
            "r2": round(r2, 5),
            "absolute_error_quantile_90": float(np.quantile(np.abs(errors), 0.9)),
            "reliability_gate_passed": reliability_gate_passed
        }

currency_forecaster = CurrencyForecaster()
