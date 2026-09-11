# Transact3 — AI Multi-Rail Cross-Border Payment Orchestrator

Transact3 is a full-stack simulated cross-border payment orchestration platform designed to eliminate the major inefficiencies in international finance: opaque FX markups, punitive flat correspondent bank fees, slow batch settlements, weekend cutoffs, and rigid single-rail lock-in.

Instead of forcing all payments through a single rail (such as legacy SWIFT), Transact3 functions as an intelligent cross-border meta-router. It dynamically evaluates, ranks, and routes each transfer across **5 distinct settlement rails** using multi-objective optimization (cost, speed, reliability, and liquidity availability), executes real atomic wallet transfers across 9 major currencies, enforces balanced double-entry accounting, and maintains a tamper-evident SHA-256 cryptographic audit chain.

---

## 🏛️ System Architecture

The Transact3 platform is structured into clean, decoupled tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 19 + Vite Frontend                        │
│   (Dashboard, Payment Router, Transaction History, Wallet, Admin UI)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST / JSON (Port 5001)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Node.js / Express Orchestration API                 │
│  - Auth & Recipient Management      - 60-Second Binding Quotes         │
│  - Multi-Currency Wallet Engine     - Atomic Settlement Pipeline       │
│  - Balanced Double-Entry Ledger     - SHA-256 Chained Audit Logger     │
│  - In-Memory / Persistent MongoDB   - Live Dynamic Fallbacks           │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │ REST (Port 8000)               │ Adapter Pattern
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       Python / FastAPI Service       │  │   5 Simulated Payment Rails  │
│  - Multi-Objective Pareto Scoring    │  │  - SWIFT Classic Batch       │
│  - FX Stats: SMA, EMA & Volatility   │  │  - RTGS High-Value           │
│  - Analytical Execution Guidance     │  │  - Regional Instant          │
│  - Transaction Cost Analysis (TCA)   │  │  - Bilateral Netting         │
│  - Extensible ML Prediction Hook     │  │  - Card Push Network         │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

1. **React Frontend (`client/`)**: Modern responsive web application built with Tailwind CSS and Lucide icons. Includes 5 clean sections:
   - **Dashboard**: High-level personal transfer volume, savings vs SWIFT, fees paid, multi-currency balances, and recent payments.
   - **Payment Router**: Payment orchestration console supporting Mode A ("Send Amount") and Mode B ("Recipient Gets"), live recipient picker, 5-rail comparative matrix with eligibility badges and rejection reasons, and manual override capabilities.
   - **Transaction History**: Audit trail with expandable transaction drawer revealing ISO 20022 clearing refs, execution durations, savings vs SWIFT, double-entry ledger entries, and cryptographic hashes.
   - **Wallet (Portfolio)**: 9-currency balance viewer with simulated deposit modal that generates balanced double-entry ledger records.
   - **Admin Portal**: System-wide operations dashboard with rail enable/disable switches, liquidity pool replenishment, system ledger reconciliation, and SHA-256 audit chain verification.
2. **Node.js / Express Backend (`server/`)**: Primary business engine managing authentication, wallet debits/credits, binding quote generation, state machine transitions, ISO 20022 simulation, double-entry ledger records, and MongoDB persistence (with automatic `mongodb-memory-server` fallback for zero-friction local execution).
3. **Python / FastAPI Intelligence Service (`python-service/`)**: Microservice providing analytical calculation for multi-objective route scoring, technical indicators (SMA, EMA, 24h rolling volatility), execution timing classifications (`EXECUTE_NOW`, `NEUTRAL`, `CONSIDER_DEFER`), and TCA metrics. If offline, the Express backend seamlessly falls back to identical native JavaScript math implementations.
4. **Data Persistence (MongoDB)**: Mongoose schemas for `User`, `Transaction`, `LedgerEntry`, `RailSetting`, and `AuditLog`.

---

## 🛣️ The 5 Settlement Rails

Transact3 models the real-world operational and economic characteristics of five settlement networks:

| Rail ID | Rail Name | Settlement Mechanism | Base Fee (USD) | Variable (bps) | Typical Settlement Time | Simulation Duration |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **`REGIONAL_INSTANT`** | Regional Instant Network | Direct domestic instant clearing (FedNow, SEPA Instant, UPI) | **$1.50** | **2 bps** (0.02%) | ~1 second | 1,200 ms |
| **`NETTING_LEDGER`** | Bilateral Intra-Bank Netting | Intra-bank ledger offset between mutual correspondent books | **$0.00** | **0 bps** (0.00%) | Instant | 800 ms |
| **`RTGS_INSTANT`** | RTGS High-Value Clearing | Gross real-time central bank wire settlement (CHIPS, TARGET2) | **$18.00** | **5 bps** (0.05%) | ~15 minutes | 2,500 ms |
| **`CARD_PUSH`** | Card Push Network | Direct debit-to-card rail (Visa Direct, Mastercard Send) | **$3.50** | **15 bps** (0.15%) | ~9 minutes | 1,800 ms |
| **`SWIFT_BATCH`** | SWIFT Classic Batch | Correspondent banking multi-hop serial batch messaging | **$25.00** | **10 bps** (0.10%) | 24 to 48 hours | 4,000 ms |

### Rail Availability & Constraints
- **Regional Instant**: Maximum transfer limit of $100,000 USD equivalent.
- **Card Push**: Maximum transfer limit of $25,000 USD equivalent.
- **Bilateral Netting**: Requires matching balance sheet pairs; available when configured on active corridor.
- **RTGS**: Designed for high-value wholesale transfers; minimum recommendation threshold $10,000 USD.
- **SWIFT**: Universally eligible fallback rail supporting all corridors up to $10,000,000 USD.

---

## 🧮 Multi-Objective Routing Algorithm

When a transfer quote is requested, the system computes an evaluation score for every eligible rail across normalized dimensions:

$$\text{Utility Score} = w_{\text{cost}} \cdot (1 - \text{NormCost}) + w_{\text{speed}} \cdot (1 - \text{NormSpeed}) + w_{\text{rel}} \cdot \text{Reliability} - \text{LiquidityPenalty}$$

### User Optimization Profiles
- **`BALANCED`** (Default): $w_{\text{cost}} = 0.40$, $w_{\text{speed}} = 0.40$, $w_{\text{rel}} = 0.20$
- **`CHEAPEST`**: $w_{\text{cost}} = 0.70$, $w_{\text{speed}} = 0.15$, $w_{\text{rel}} = 0.15$
- **`FASTEST`**: $w_{\text{cost}} = 0.15$, $w_{\text{speed}} = 0.70$, $w_{\text{rel}} = 0.15$

### Dynamic Liquidity Saturation Penalty
As a rail's hourly pool utilization surpasses 80%, an exponential penalty is applied to downrank congested rails before exhaustion:

$$\text{LiquidityPenalty} = \begin{cases} 0 & \text{if } U < 0.80 \\ 0.35 \cdot \left(\frac{U - 0.80}{0.20}\right)^2 & \text{if } U \ge 0.80 \end{cases}$$

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
  3. The router immediately disqualifies Regional Instant, explains the rejection, and dynamically routes to the next best alternative (e.g. `CARD_PUSH` or `RTGS_INSTANT`).

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

# Install python-service dependencies (optional)
cd ../python-service
pip install fastapi uvicorn
```

### 2. Configure Environment Variables

**Backend (`server/.env`)**:
```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/transact3
JWT_SECRET=supersecretjwtkey_transact3_production_grade
FASTAPI_SERVICE_URL=http://localhost:8000
NODE_ENV=development
```
*(Note: If MongoDB is not running locally, the server automatically boots an in-memory MongoDB instance via `mongodb-memory-server` without any configuration).*

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

## 🧪 Comprehensive Automated Testing

Transact3 includes a comprehensive end-to-end integration test suite verifying 23 distinct assertions across all core features:

```bash
cd server
node test-comprehensive.js
```

### Test Coverage Summary:
- ✅ **Authentication**: User registration, login, and JWT issuance.
- ✅ **Recipients**: Active recipient fetching excluding self.
- ✅ **Deposits & Wallets**: Atomic multi-currency balance credit.
- ✅ **Ledger Invariant**: Double-entry balanced verification for deposits ($\Sigma \text{Debits} == \Sigma \text{Credits}$).
- ✅ **FX Intelligence**: Mid-market rates, SMA, EMA, volatility, and timing recommendations.
- ✅ **Mode A & Mode B Quotes**: 60-second binding quotes, forward calculation, and backward exact-receive calculation.
- ✅ **Multi-Objective Routing**: `CHEAPEST` vs `FASTEST` Pareto ranking verification.
- ✅ **Liquidity & Controlled Failure**: Disqualification of rails with depleted liquidity pools with descriptive rejection reason.
- ✅ **Dynamic Re-Routing**: Dynamic promotion of next best rail when primary rail is unavailable.
- ✅ **Atomic Settlement Execution**: Full sender debit (principal + fee), recipient credit (destination amount), rail simulation, and liquidity deduction.
- ✅ **Ledger Balance**: Double-entry balanced verification for payment settlement.
- ✅ **Audit Integrity**: Cryptographic SHA-256 chain continuity verification.

---

## 🔮 Machine Learning Integration Hook

A production-ready ML extension hook is defined in [`python-service/app/services/ml_prediction_interface.py`](python-service/app/services/ml_prediction_interface.py):

```python
class MLRoutingPredictor:
    def predict_optimal_rail(self, features: PaymentRoutingFeatures) -> MLPredictionResult:
        # Accepts normalized feature vectors:
        # [amount_usd, hour_of_week, corridor_volatility, pool_saturation_ratio, user_priority_weight]
        # Ready for drop-in loading of trained XGBoost, LightGBM, or PyTorch models.
        ...
```

The service is pre-architected to hot-swap rule-based heuristic scoring with trained ML model inference without disrupting API schemas or backend routing handlers.

---

## ⚠️ Disclaimer

**Educational and Demonstration Notice**: Transact3 is a simulated payment orchestration engine developed for educational, architectural demonstration, and research purposes. All banking networks (SWIFT, RTGS, FedNow, SEPA, Visa Direct, Mastercard Send) and ledger settlements are simulated via software adapters and do not move real-world sovereign legal tender.
