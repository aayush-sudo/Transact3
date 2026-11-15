# Transact3 — Cross-Border Transfer Comparison Platform

Transact3 is a light-themed wallet and cross-border transfer planning platform. Users can create accounts, fund an INR wallet through Razorpay test checkout, compare three routes, and schedule an internal modeled settlement. Razorpay test mode does not move live funds, and payout routes are not connected to external banks or payment networks.

---

## 🏛️ System Architecture

The Transact3 platform is structured into clean, decoupled tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 19 + Vite Frontend                        │
│  (Overview, Wallet, Route Comparison, FX Outlook, Model Insights)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST / JSON (Port 5001)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Node.js / Express API                               │
│  - Auth & Wallet                    - Razorpay Test Funding               │
│  - Route Comparisons                - Scheduled Modeled Settlement        │
│  - Persistent MongoDB               - Ledger & Audit Evidence             │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │ REST (Port 8000)               │ Adapter Pattern
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       Python / FastAPI Service       │  │   3 Modeled Route Options    │
│  - Multi-Objective Pareto Scoring    │  │  - SWIFT Classic Batch       │
│  - FX Stats: SMA, EMA & Volatility   │  │  - Correspondent Banking     │
│  - Analytical Execution Guidance     │  │  - Instant Payment           │
│  - Transaction Cost Analysis (TCA)   │  │  - Card Payout                │
│  - Deterministic Scoring              │  │                               │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

1. **React Frontend (`client/`)**: Light-themed account, wallet, route comparison, payment scheduling, and activity pages.
2. **Node.js / Express Backend (`server/`)**: Verifies captured Razorpay test payments before wallet credit, reserves funds and modeled route capacity, and settles due transfers asynchronously.
3. **Python / FastAPI Intelligence Service (`python-service/`)**: Provides route scoring, FX analysis, TCA metrics, and payment rail and transaction-risk inference.
4. **Data Persistence (MongoDB)**: Mongoose schemas for `User`, `Transaction`, `LedgerEntry`, `RailSetting`, and `AuditLog`.

> **Important:** Razorpay funding is test-mode only. Cross-border route execution remains an internal model and does not send funds through payout networks. Do not use this application for live payments.

---

## 🛣️ Three Modeled Route Options

Transact3 presents estimated characteristics for three route types. The named payment networks are examples of route categories and are not connected to Transact3:

The fees in this table are calibrated model inputs, **not live tariffs fetched from the named networks**. Route comparison can also display separate provider-reported snapshots from a public comparison feed when available. Each provider's quote collection time is shown because quote ages vary; snapshots are indicative and must be confirmed with the provider before payment.

| Rail ID | Route Category | Typical Use | Estimated Base Fee (USD) | Variable (bps) | Indicative Delivery Time |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **`REGIONAL_INSTANT`** | Destination-local instant payment (small amounts) | Configured local clearing route for eligible retail amounts | **$1.50** | **2 bps** (0.02%) | Under 60 seconds when eligible |
| **`CARD_PUSH`** | Card payout | Debit-to-card payout categories | **$3.50** | **15 bps** (0.15%) | Corridor- and notional-specific estimate |
| **`SWIFT_BATCH`** | Correspondent transfer | Multi-hop bank transfer categories | **$25.00** | **10 bps** (0.10%) | Corridor-specific business hours with cutoffs/weekends |

### Rail Availability & Constraints
- **Regional Instant**: Retail threshold of $1,000 USD equivalent; only configured destination-local routes are eligible. Larger transfers require standard banking settlement and include an explicit rejection reason.
- **Card Push**: Maximum transfer limit of $25,000 USD equivalent.
- **SWIFT**: Universally eligible fallback rail supporting all corridors up to $10,000,000 USD.

Each conversion quote includes the mid-market reference rate, amount-tiered corridor spread, quoted rate, estimated rail fee, net payout after the FX spread, instant eligibility, modeled clearing rail, and a settlement window calculated for the source/destination banking windows and current notional. Network names, fees, and times are estimates only; the app is not connected to payout networks.

---

## 🧮 Multi-Objective Routing Algorithm

When a transfer quote is requested, the system computes an evaluation score for every eligible rail across normalized dimensions:

$$\text{Score} = w_c N_c + w_s N_s + w_r N_r + w_q N_q + w_l N_l - P_l$$

The normalized terms represent cost, speed, reliability, risk (currently derived from reliability), and liquidity adequacy. A liquidity penalty applies when available pool liquidity is below 1.5 times the payment amount.

### User Optimization Profiles
- **`BALANCED`** (Default): cost 0.35, speed 0.30, reliability 0.20, risk 0.10, liquidity 0.05
- **`CHEAPEST`**: cost 0.70, speed 0.10, reliability 0.15, risk 0.05, liquidity 0.00
- **`FASTEST`**: cost 0.10, speed 0.70, reliability 0.15, risk 0.05, liquidity 0.00

### Dynamic Liquidity Saturation Penalty
The current scorer uses a fixed adequacy penalty rather than an exponential saturation curve:

$$P_l = \begin{cases} 0.15 & \text{if available liquidity} < 1.5 \times \text{payment amount} \\ 0 & \text{otherwise} \end{cases}$$

If a rail's pool is fully depleted or toggled off by an administrator, its eligibility is revoked (`isEligible: false`) with an explicit rejection reason (e.g., *"Rail disabled by administrator"* or *"Transfer exceeds available liquidity ($250.00 left)"*), prompting the routing engine to dynamically elevate the next best eligible rail.

---

## 📈 FX Analysis Engine

The FX outlook uses dated daily reference rates from [Frankfurter](https://frankfurter.dev/) for the same pair selected in the converter. It sends those observations to the saved `HistGradientBoostingRegressor` in the Python ML service and plots the model's next-daily-observation estimate. These daily reference rates are not live executable quotes; Google may show a different, more frequently updated indicative rate.

The displayed “confidence” is the model's **historical directional hit rate** over a rolling holdout, not a calibrated probability that the next prediction will be correct. The UI also reports a Wilson interval for that hit rate and model MAE against a no-change baseline. The model's prediction interval uses empirical absolute errors from that holdout. Forecasts are experimental, and transfers are never delayed or executed based on them.

**Current reliability check (USD/INR, Frankfurter observations from 2025-11-15 through 2026-11-15):** the model scored 36.31% directional accuracy over 336 next-observation tests (95% Wilson interval 31.35–41.58%). Its return MAE was 0.13429%, worse than the 0.12506% no-change baseline, and its out-of-sample R² was -0.07881. This is not reliable predictive performance. The loaded artifact's training data ends on 2021-08-30, so retraining on recent, verified market data and repeating a strictly chronological holdout evaluation is necessary before relying on its signals.

---

## 💧 Liquidity Management & Controlled Failure Testing

Transact3 includes a modeled liquidity pool system tracked in MongoDB via the `RailSetting` model:
- Each rail has a configured total capacity and current available balance in USD.
- When an atomic payment settles, the rail's available liquidity is decremented by the principal USD amount.
- **Admin Controls**: Administrators can toggle rails on/off or replenish liquidity via the Admin Portal (`/admin`).
- **Capacity Constraints**:
  1. An administrator can adjust configured route availability in the Admin Portal.
  2. The comparison excludes a route when its configured capacity is insufficient.
  3. The results explain the exclusion and rank the remaining available options.

The current system does not connect to a payment provider for real transfer execution. It therefore does not recommend intermediate-currency hops: reference FX data cannot confirm route availability, per-leg fees, or settlement. A real direct-versus-hop comparison requires executable quotes for each route from an integrated provider.

---

## 💼 Multi-Currency Wallet & Double-Entry Ledger

Transact3 supports 9 fixed global fiat currencies:
`USD`, `EUR`, `GBP`, `INR`, `AED`, `SGD`, `AUD`, `CAD`, `JPY`.

### Double-Entry Accounting Principles
Every financial movement creates atomic, balanced entries in the `LedgerEntry` collection satisfying the fundamental invariant:

$$\sum \text{Debits} \equiv \sum \text{Credits}$$

1. **Deposit ($1,000 USD)**:
   - Debit: `USER_WALLET` (+$1,000 USD)
   - Credit: `SYSTEM_RESERVE` (+$1,000 USD)
2. **Cross-Border Payment ($500 USD → EUR with $1.60 Fee via Regional Instant)**:
   - Sender Principal Debit: `USER_WALLET` (-$500.00 USD)
   - Settlement Pool Offset: `SETTLEMENT_POOL` (+$500.00 USD)
   - Sender Fee Debit: `USER_WALLET` (-$1.60 USD)
   - Treasury Fee Revenue Credit: `TREASURY_FEE_REVENUE` (+$1.60 USD)
   - Settlement Pool Outflow: `SETTLEMENT_POOL` (-€460.00 EUR)
   - Recipient Wallet Credit: `RECIPIENT_WALLET` (+€460.00 EUR)

Users can audit their individual ledger entries directly in the Transaction Details drawer, and administrators can trigger a system-wide reconciliation check via `GET /api/admin/reconcile`.

---

## 🛡️ TCA & Tamper-Evident SHA-256 Audit Chain

### Transaction Cost Analysis (TCA)
For every executed transaction, Transact3 calculates the direct cost and latency savings achieved compared to the legacy SWIFT Classic Batch benchmark:

$$\text{Savings USD} = \text{Fee}_{\text{SWIFT}} - \text{Fee}_{\text{Selected Rail}}$$
$$\text{Latency Saved} = \text{Duration}_{\text{SWIFT}} - \text{Duration}_{\text{Selected Rail}}$$

### Cryptographic Audit Chain
Every significant lifecycle event (`TRANSACTION_SETTLED`, `DEPOSIT_COMPLETED`, `RAIL_TOGGLED`, `LIQUIDITY_ADJUSTED`) is appended to a cryptographically linked SHA-256 audit log:

$$\text{Hash}_n = \text{SHA-256}(\text{Sequence}_n + \text{Timestamp}_n + \text{Event}_n + \text{TxID}_n + \text{DataJSON}_n + \text{Hash}_{n-1})$$

The Admin Portal provides a **Verify Integrity** tool that iterates across all entries from sequence #1 to latest, confirming zero tampering or breakage in hash continuity.

---

## 🚀 How to Run Locally

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Python**: v3.10 or higher (optional for FastAPI analytics service)

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/aayush-sudo/Transact3.git
cd Transact3

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install

# Create an isolated Python environment and install service dependencies
cd ../python-service
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

### 2. Configure Environment Variables

**Backend (`server/.env`)**:
```env
PORT=5001
MONGO_URI=mongodb://127.0.0.1:27017/transact3
JWT_SECRET=
FASTAPI_URL=http://127.0.0.1:8000
NODE_ENV=development
```
Generate a unique JWT secret with `openssl rand -hex 32` and put its output in `JWT_SECRET` before starting the API.
Start the persistent MongoDB service from the repository root before starting the API:

```bash
docker compose up -d mongo
```

Copy `server/.env.example` to `server/.env` and set private values for `JWT_SECRET`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET` using Razorpay test credentials. New accounts receive ₹10,000 in clearly recorded platform test funds in their INR wallet. Existing accounts are not recreated by the bootstrap process; users can also register in the app.

**Frontend (`client/.env`)**:
```env
VITE_API_URL=http://localhost:5001/api
```

### 3. Start Services

**Terminal 1 — Start the application services**:
```bash
npm run dev
# Starts the Express API, React client, and Python FastAPI service
```

The Python service is required for hourly FX forecasts. Install `python-service/requirements.txt` before starting the application. To start only that service separately:
```bash
npm run python-service
# API docs available at http://localhost:8000/docs
```

The start script automatically uses `python-service/.venv` when present. If you use another Python environment, set `PYTHON` to its interpreter path before starting the services. Python auto-reload watches only `python-service/`, so frontend or Node changes do not interrupt forecast requests.

To run the Node API and React client separately, use:
```bash
npm run server
npm run client
```

---

## 🧪 Automated Verification

Run the API-level proof of concept from the repository root:

```bash
npm test
```

This starts Express against an isolated temporary MongoDB and exercises authentication, quote ownership, scheduled settlement, fee checks, idempotent replay/conflict, and balance persistence after an API restart.

The additional service regression suite covers routing preferences, liquidity rerouting, wallet settlement, ledger reconciliation, and audit tamper detection:

```bash
cd server
node test-comprehensive.js
```

---

## Routing Intelligence Status

The three saved models are loaded by the FastAPI service at startup and are available through `POST /ml/predict-currency`, `POST /ml/predict-rail`, `POST /ml/predict-risk`, and the combined `POST /ml/advisory` endpoint. For example, after starting the Python service:

```bash
curl -X POST http://localhost:8000/ml/advisory \
  -H 'Content-Type: application/json' \
  -d '{"source_currency":"USD","destination_currency":"EUR","amount":10000,"preference":"BALANCED","recipient_country":"DE","current_rate":0.92}'
```

The FX Outlook tab and conversational FX forecast use the hourly forecaster in [`python-service/app/ml/fx_forecaster.py`](python-service/app/ml/fx_forecaster.py), exposed internally through `POST /fx/hourly-forecast` on the Python service. The forecast selector includes the 152 currencies in the Twelve Data forex catalog snapshot; its target choices are limited to pairs listed by Twelve Data or derivable from both currencies' USD crosses. These forecast-only currencies do not enable money transfers. Chat exchange-rate answers and the FX Outlook hourly panel use the same hourly current rate and source. The quick calculator remains an explicitly labeled daily Frankfurter reference-rate estimate and is available only for payment-supported currencies. Set `TWELVEDATA_API_KEY` in the server environment (or `server/.env`) to use Twelve Data hourly closes. If no key is configured, the forecaster returns synthetic demo rates and labels their source as `mock`; these are not live market rates. It returns estimates for `+6h`, `+12h`, `+24h`, and `+48h`. From the Python service root, the utility can also be called directly:

```python
from app.ml.fx_forecaster import predict_rates

forecast = predict_rates("USD", "INR")
print(forecast["predicted_rates"]["+24h"]["rate"])
```

The approximate forecast bands are not calibrated confidence intervals and must not be used as payment quotes or timing advice.
If Twelve Data does not list a direct currency pair, the hourly forecaster can derive it from aligned USD/base and USD/target hourly observations. Transient provider 5xx/network errors are retried once, and unsupported direct/inverse symbols fall back to USD crosses. Provider quotas, outages, account-plan restrictions, and pairs without direct or USD-cross observations can still make a forecast unavailable; the service does not substitute invented live rates.

The separate `MLPredictionLayer` in [`python-service/app/services/ml_prediction_interface.py`](python-service/app/services/ml_prediction_interface.py) remains a pass-through hook for deterministic rail scoring; the standalone model inference endpoints do not replace that scoring path.

---

## ⚠️ Disclaimer

**Product Notice**: Razorpay is configured for test-mode wallet funding only. Transfer routes and payout execution are modeled internally; the app does not connect to payout networks or deliver funds to external recipients. Route prices, FX rates, capacities, and delivery times are indicative, may differ from provider offers, and are not guarantees. Do not use for live payments.
