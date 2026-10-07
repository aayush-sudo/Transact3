# Transact3 Machine Learning Engine

This directory contains the independent, end-to-end Machine Learning models for **Transact3**—an AI-driven cross-border payment advisory meta-engine.

---

## Directory Structure

```
ml_models/
├── data/
│   └── forex.csv                     <- Unzipped Kaggle dataset (1.45M rows, 113 currencies)
├── saved_models/                     <- Serialized trained model weights (.joblib)
│   ├── currency_model.joblib         <- Model 1 serialized artifact
│   ├── rail_model.joblib             <- Model 2 serialized artifact
│   └── risk_model.joblib             <- Model 3 serialized artifact
├── 00_eda.py                         <- Exploratory Data Analysis script
├── 01_currency_forecast_model.py     <- Model 1: FX Rate Forecasting & Timing
├── 02_rail_recommendation_model.py   <- Model 2: Payment Rail Recommendation
├── 03_transaction_risk_model.py      <- Model 3: Transaction Risk & Compliance
├── run_all.py                        <- Master script running EDA and training all 3 models
└── eda_report.txt                    <- Generated EDA report
```

---

## 1. Dataset Overview & EDA Findings (`forex.csv`)

- **Total Records**: 1,453,035 rows
- **Columns**: `slug`, `date`, `open`, `high`, `low`, `close`, `currency`
- **Missing / Null Values**: 0 (100% complete)
- **Duplicates**: 0
- **Temporal Span**: October 30, 1996 to August 30, 2021 (24.8 years)
- **Currency Pairs (slugs)**: 340 unique pairs
- **Target Currencies**: 113 active ISO 4217 currencies
- **Key Quantitative Takeaway**: Exchange rates range from 0.001 to 2,760,430.75 across pairs. Therefore, models train on **scale-invariant stationary technical indicators** (daily percentage returns, moving average ratios, RSI, MACD, and volatility) rather than raw price levels, enabling a single model to generalize across all 113 currencies.

---

## 2. The 3 Machine Learning Models

### Model 1: FX Currency Rate Prediction & Execution Timing Model
- **File**: `01_currency_forecast_model.py`
- **Algorithm**: `HistGradientBoostingRegressor` (scikit-learn LightGBM-style histogram trees)
- **Input Features**: 15 stationary technical indicators:
  - `return_1d`, `return_lag_1`, `return_lag_2`
  - `sma_7_ratio`, `sma_14_ratio`, `sma_30_ratio`
  - `ema_12_ratio`, `ema_26_ratio`
  - `macd_ratio`, `rsi_norm`, `atr_ratio`
  - `volatility_7d`, `volatility_14d`, `day_of_week`, `month`
- **Output**: Next-day predicted return ($\hat{r}$), forecasted rate, and actionable execution advice:
  - `EXECUTE_NOW`: Recommended if rate is expected to decline or volatility is stable.
  - `WAIT_24H` / `WAIT_6H`: Recommended if rate is forecasted to appreciate, with projected monetary savings.
- **Saved Model**: `saved_models/currency_model.joblib`

---

### Model 2: Optimal Payment Rail Recommendation Model
- **File**: `02_rail_recommendation_model.py`
- **Algorithm**: `RandomForestClassifier` (120 balanced trees)
- **Target Rails (3 classes)**:
  1. `FINTECH_LOCAL_NETTING` (Wise / Instarem local clearing)
  2. `SWIFT_INTERBANK_WIRE` (Cross-border correspondent bank wire)
  3. `INSTANT_CARD_WALLET_PUSH` (Western Union / Remitly / PayPal push-to-card)
- **Input Features**:
  - `amount_log`, `is_weekend`, `time_of_day_utc`
  - User Priority (`CHEAPEST`, `FASTEST`, `BALANCED`, `RELIABLE`)
  - `is_major_corridor`, `fx_volatility_pct`, `liquidity_ratio`
- **Output**: Top recommended rail, probability distribution across all 3 rails, and explainable rationale.
- **Accuracy**: 100% on held-out synthetic routing scenarios.
- **Saved Model**: `saved_models/rail_model.joblib`

---

### Model 3: Transaction Anomaly & Compliance Risk Model
- **File**: `03_transaction_risk_model.py`
- **Algorithm**: `IsolationForest` (Unsupervised ML) + Regulatory Heuristics Engine
- **Input Features**:
  - `amount_log`, `velocity_count_24h`, `velocity_amount_log`
  - `corridor_risk_score` (FATF jurisdictional risk)
  - `off_hours_flag` (00:00–04:00 local execution)
  - `structuring_flag` (amounts between \$9,000 and \$9,999 near BSA \$10k CTR threshold)
  - `sanction_match_score` (fuzzy string match distance against OFAC/UN targets)
- **Output**:
  - Composite Risk Score ($0.00 \to 1.00$)
  - Risk Tiers: `LOW` (Green), `MEDIUM` (Amber), `HIGH` (Red)
  - Anomaly Flag (Normal vs Multivariate Outlier)
  - Triggered factor breakdown
- **Saved Model**: `saved_models/risk_model.joblib`

---

## 3. How to Run & Train

### Option A: Run Everything (One-Click)
```bash
python ml_models/run_all.py
```

### Option B: Run Models Individually
```bash
# 1. Exploratory Data Analysis
python ml_models/00_eda.py

# 2. Train Currency Forecast Model
python ml_models/01_currency_forecast_model.py

# 3. Train Rail Recommendation Model
python ml_models/02_rail_recommendation_model.py

# 4. Train Transaction Risk Model
python ml_models/03_transaction_risk_model.py
```
