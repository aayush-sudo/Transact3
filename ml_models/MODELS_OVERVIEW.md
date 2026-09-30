# Transact3 — Machine Learning Models Overview

## Platform Role
Transact3 is an **AI-powered cross-border payment advisory meta-engine** (non-custodial). It does not hold funds; it advises users on **when to convert**, **which real-world API rail to route through**, and **transaction compliance risk**.

---

### Model 1: FX Currency Rate Forecasting & Execution Timing
* **File:** `ml_models/01_currency_forecast_model.py`
* **Artifact:** `ml_models/saved_models/currency_model.joblib`
* **Algorithm:** `HistGradientBoostingRegressor` (Histogram Tree Boosting)
* **Dataset:** 1,453,035 rows across 340 global currency pairs (`forex.csv`)
* **Input Features (15):** 
  * Moving Average Ratios: $SMA_7$, $SMA_{14}$, $SMA_{30}$, $EMA_{12}$, $EMA_{26}$ (normalized to price)
  * Momentum & Range: Normalized MACD, Normalized RSI (0–1), Normalized ATR
  * Volatility & Lags: 7-day & 14-day rolling volatility, 1-day & 2-day lag returns, day of week, month
* **Target:** Next-day percentage return ($\hat{r}$), scale-invariant across all 113 currencies.
* **Output / Advisory:**
  * **Forecast Rate:** $\widehat{Close} = Close \times (1 + \hat{r})$
  * **Timing Advice:** 
    * `EXECUTE_NOW`: Rate expected to drop (hedges slippage) or stable low volatility.
    * `WAIT_6H` / `WAIT_24H`: Rate expected to appreciate, with projected monetary savings.
* **Validation Performance (288,567 unseen test records):**
  * MAE: **0.003901** (~0.39%)
  * RMSE: **0.005178**
  * Directional Accuracy: **51.74%**

---

### Model 2: Optimal Payment Rail Recommendation (3 Real-World API Rails)
* **File:** `ml_models/02_rail_recommendation_model.py`
* **Artifact:** `ml_models/saved_models/rail_model.joblib`
* **Algorithm:** `RandomForestClassifier` (120 balanced trees)
* **Real-World API Rails (3):**
  1. `WISE_LOCAL_NETWORK`
     * **Real API:** Wise Platform REST API (`POST /v3/quotes`)
     * **Mechanism:** Domestic clearing network (SEPA in EU, ACH in US, UPI/IMPS in IN, Faster Payments in UK).
     * **Best For:** Low fees, transfers $\le \$30,000$, `CHEAPEST` / `BALANCED` priority.
  2. `SWIFT_WIRE`
     * **Real API:** Currencycloud / Stripe Wire / SWIFT GPI Wire API (`POST /v1/transfers`)
     * **Mechanism:** Interbank wire connecting 11,000+ banks worldwide via ISO 20022.
     * **Best For:** High-value wholesale transfers ($>\$30,000$), exotic corridors, `RELIABLE` priority.
  3. `CARD_PUSH_PAYOUT`
     * **Real API:** Visa Direct PushFunds API / Stripe Instant Card Payouts (`POST /v1/payouts`)
     * **Mechanism:** Real-time push payment directly to 16-digit debit/credit card or digital wallet.
     * **Best For:** Instant delivery (<30 minutes), transfers on weekends/after-hours, small amounts $\le \$5,000$, `FASTEST` priority.
* **Input Features (9):** Amount ($\log$), Weekend Flag, Time of Day (UTC), Priority (`CHEAPEST`, `FASTEST`, `BALANCED`, `RELIABLE`), Major Corridor Flag, FX Volatility, Corridor Liquidity.
* **Output / Advisory:**
  * Top Recommended Rail (e.g. `WISE_LOCAL_NETWORK`)
  * Target REST API to call (e.g. `Wise Platform REST API`)
  * Probability Distribution across all 3 rails
  * Natural language explanation of why the rail was selected.
* **Validation Performance (10,000 unseen test scenarios):**
  * Out-of-Sample Accuracy: **100.00%**
  * Log-Loss: **0.0168**

---

### Model 3: Transaction Anomaly & Compliance Risk
* **File:** `ml_models/03_transaction_risk_model.py`
* **Artifact:** `ml_models/saved_models/risk_model.joblib`
* **Algorithm:** Hybrid `IsolationForest` (Unsupervised ML) + Regulatory Heuristics Engine
* **Input Features (6):** Amount ($\log$), 24h Velocity Count, 24h Velocity Volume ($\log$), FATF Jurisdictional Risk, Off-Hours Execution (00:00–04:00), Structuring Flag ($9,000–$9,999 near BSA $10k threshold).
* **Output / Advisory:**
  * **Composite Risk Score:** $0.00 \to 1.00$
  * **Risk Tiers:**
    * `LOW` (< 0.35): Automated Straight-Through Processing (STP) approved.
    * `MEDIUM` (0.35 – 0.70): Enhanced Due Diligence (EDD) / Secondary verification recommended.
    * `HIGH` (> 0.70): Mandatory Hold / OFAC & SAR Review required.
  * **Trigger Flags:** Identifies exact factors (e.g. `STRUCTURING_SUSPICION`, `VELOCITY_SPIKE`, `SANCTION_SCREENING_ALERT`).
* **Validation Performance (50,000 test records):**
  * Calibrated Contamination: **3.00%** (1,500 outliers isolated)
  * 100% capture of BSA structuring and high-risk FATF triggers.

---

## Execution Command
```bash
# Run EDA and train all 3 models:
python ml_models/run_all.py
```
