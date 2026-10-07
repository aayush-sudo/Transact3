# Transact3 — Cross-Border Transfer Comparison Platform

Transact3 is a user-focused information and comparison platform for cross-border transfers. It helps people review estimated exchange rates, fees, delivery times, and route trade-offs before choosing an external provider. Transact3 does not process payments, hold funds, or connect to payment networks.

An optional software demo illustrates a simulated transfer lifecycle across three sample routes. Demo balances, quotes, settlement, and transaction history are not real financial services and no real money moves.

---

## 🏛️ System Architecture

The Transact3 platform is structured into clean, decoupled tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 19 + Vite Frontend                        │
│  (Overview, Option Comparison, FX Outlook, Optional Demo, Admin UI)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST / JSON (Port 5001)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  Node.js / Express Information API                    │
│  - Auth & Reference Data             - Comparison Estimates             │
│  - Optional Demo Wallet              - Simulated Settlement Pipeline    │
│  - Demonstration Ledger              - Audit Evidence                   │
│  - Persistent MongoDB                - Sample Route Scoring              │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │ REST (Port 8000)               │ Adapter Pattern
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       Python / FastAPI Service       │  │  3 Simulated Route Adapters │
│  - Multi-Objective Pareto Scoring    │  │  - SWIFT Classic Batch       │
│  - FX Stats: SMA, EMA & Volatility   │  │  - Correspondent Banking     │
│  - Analytical Execution Guidance     │  │  - Instant Payment           │
│  - Transaction Cost Analysis (TCA)   │  │  - Card Payout                │
│  - Deterministic Scoring              │  │                               │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

1. **React Frontend (`client/`)**: Light-themed comparison and guidance experience with an explicitly optional, simulated transfer demo.
2. **Node.js / Express Backend (`server/`)**: Provides comparison and reference data. Separate demo endpoints simulate quotes, wallet changes, settlement, ledger entries, and MongoDB persistence; they do not connect to external payment networks.
3. **Python / FastAPI Intelligence Service (`python-service/`)**: Provides route scoring, FX analysis, TCA metrics, and inference endpoints for the trained FX forecast, payment rail recommendation, and transaction risk models in `ml_models/saved_models/`.
4. **Data Persistence (MongoDB)**: Mongoose schemas for `User`, `Transaction`, `LedgerEntry`, `RailSetting`, and `AuditLog`.

---

## 🛣️ The 3 Simulated Route Adapters

Transact3 models the operational characteristics of three route types. These adapters return simulated results and are not connections to the named payment networks:

| Rail ID | Rail Name | Settlement Mechanism | Base Fee (USD) | Variable (bps) | Typical Settlement Time | Simulation Duration |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **`REGIONAL_INSTANT`** | Regional Instant Network | Direct domestic instant clearing (FedNow, SEPA Instant, UPI) | **$1.50** | **2 bps** (0.02%) | ~1 second | 1,200 ms |
| **`CARD_PUSH`** | Card Push Network | Direct debit-to-card rail (Visa Direct, Mastercard Send) | **$3.50** | **15 bps** (0.15%) | ~9 minutes | 1,800 ms |
| **`SWIFT_BATCH`** | SWIFT Classic Batch | Correspondent banking multi-hop serial batch messaging | **$25.00** | **10 bps** (0.10%) | 24 to 48 hours | 4,000 ms |

### Rail Availability & Constraints
- **Regional Instant**: Maximum transfer limit of $100,000 USD equivalent.
- **Card Push**: Maximum transfer limit of $25,000 USD equivalent.
- **SWIFT**: Universally eligible fallback rail supporting all corridors up to $10,000,000 USD.

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

The FX intelligence service calculates mid-market conversion rates using cached live feeds from `ExchangeRate-API` (with deterministic fallback):

1. **Spot Rate**: Clean mid-market exchange rate between any of the 9 supported currencies.
2. **Simple Moving Average (SMA-20)**: Rolling trend indicator derived from recent 24-hour rate distributions.
3. **Exponential Moving Average (EMA-12)**: Weighted trend indicator sensitive to recent price movements.
4. **24-Hour Rolling Volatility ($\sigma_{24h}$)**: Percentage standard deviation indicating rate dispersion.
5. **Analytical Execution Guidance**:
   - **`EXECUTE_NOW`**: Current rate is favorably higher than the EMA by $> 0.15\%$ with low/moderate volatility.
   - **`CONSIDER_DEFER`**: Current rate is depressed below the EMA by $> 0.20\%$ with an upward-trending trajectory.
   - **`NEUTRAL`**: Current rate is within normal boundary bands.

---

## 💧 Liquidity Management & Controlled Failure Testing

Transact3 includes a persistent liquidity pool system tracked in MongoDB via the `RailSetting` model:
- Each rail has a configured total capacity and current available balance in USD.
- When an atomic payment settles, the rail's available liquidity is decremented by the principal USD amount.
- **Admin Controls**: Administrators can toggle rails on/off or replenish liquidity via the Admin Portal (`/admin`).
- **Controlled Failure Demonstration**:
  1. Open the Admin Portal and disable `REGIONAL_INSTANT` or drain its liquidity to $10.
  2. Request a quote for a $1,000 USD transfer.
   3. The router immediately disqualifies Regional Instant, explains the rejection, and dynamically routes to the next eligible simulated alternative (e.g. `CARD_PUSH` or `SWIFT_BATCH`).

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

# Install python-service dependencies, including ML inference (optional)
cd ../python-service
pip install -r requirements.txt
```

### 2. Configure Environment Variables

**Backend (`server/.env`)**:
```env
PORT=5001
MONGO_URI=mongodb://127.0.0.1:27017/transact3
JWT_SECRET=replace_with_a_local_secret
FASTAPI_URL=http://127.0.0.1:8000
NODE_ENV=development
```
Start the persistent MongoDB service from the repository root before starting the API:

```bash
docker compose up -d mongo
```

`server/.env.example` contains these local defaults. Copy its values into `server/.env` and use a private `JWT_SECRET`. The memory database is reserved for automated tests and disposable local runs.

**Frontend (`client/.env`)**:
```env
VITE_API_URL=http://localhost:5001/api
```

### 3. Start Services

**Terminal 1 — Node.js Express Server**:
```bash
cd server
npm run dev
# Server listens at http://localhost:5001
# Automatically seeds demo users: Alice (alice@transact3.com) and Bob (bob@transact3.com)
```

Demo logins: Alice (`alice@transact3.com`), Bob (`bob@transact3.com`), and Treasury Admin (`treasury@transact3.io`) all use `Password123!`. These seeded credentials are for local demonstration only.

**Terminal 2 — Python FastAPI Intelligence Service** *(Optional — Express will use native JS fallback if skipped)*:
```bash
cd python-service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# API docs available at http://localhost:8000/docs
```

**Terminal 3 — React Client**:
```bash
cd client
npm run dev
# Client runs at http://localhost:5173
```

---

## 🧪 Automated Verification

Run the API-level proof of concept from the repository root:

```bash
npm test
```

This starts the real Express server against an isolated temporary MongoDB and exercises authenticated login, quote ownership, Alice-to-Bob settlement, fee checks, idempotent replay/conflict, and balance persistence after an API restart. It moves no real funds.

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

The separate `MLPredictionLayer` in [`python-service/app/services/ml_prediction_interface.py`](python-service/app/services/ml_prediction_interface.py) remains a pass-through hook for deterministic rail scoring; the standalone model inference endpoints do not replace that scoring path.

---

## ⚠️ Disclaimer

**Information and Demonstration Notice**: Transact3 provides estimates and educational guidance, not financial services or payment processing. Route prices, rates, availability, delivery times, and model outputs may be simulated or illustrative and are not provider offers. The optional demo uses sample account data; no real funds are held or transferred and no external provider is contacted.
