# Transact3: Technical Code Explanation & Walkthrough

This document provides a comprehensive technical walkthrough of the **Transact3** codebase, detailing the architecture, design patterns, backend microservices, optimization engines, and frontend React components.

---

## 📁 Repository Structure Overview

```
Transact3/
├── package.json                   # Root workspace scripts & concurrency manager
├── server/                        # Node.js + Express Backend API (Port 5001)
│   ├── package.json               # Backend dependencies (express, mongoose, axios, etc.)
│   ├── .env                       # Environment configuration (PORT, MONGO_URI, API Keys)
│   └── src/
│       ├── index.js               # Express application entry point
│       ├── config/
│       │   ├── db.js              # In-memory / MongoDB database connection setup
│       │   ├── railConfig.js      # Baseline configuration for 6 payment rails
│       │   ├── currencies.js      # Supported currency definitions & base volatilities
│       │   └── corridors.js       # Regional corridor eligibility rules
│       ├── middleware/
│       │   ├── auth.js            # JWT verification & demo Treasury Manager fallback
│       │   ├── rateLimiter.js     # Request rate limiting (120 req/min)
│       │   ├── requestId.js       # Unique request tracking ID generator
│       │   └── errorHandler.js    # Global API error handler
│       ├── models/
│       │   ├── User.js            # User authentication schema
│       │   ├── Portfolio.js       # Multi-currency wallet balance schema
│       │   ├── Transaction.js     # Cross-border transaction schema
│       │   ├── FXQuote.js         # Active FX quote reservation schema
│       │   └── LedgerEntry.js     # Double-entry audit ledger schema
│       ├── rails/                 # 5 Payment Rail Adapters
│       │   ├── railAdapter.js     # Base adapter interface (validate, cost, latency)
│       │   ├── swiftRail.js       # SWIFT Classic Batch adapter
│       │   ├── rtgsRail.js        # RTGS High-Value clearing adapter
│       │   ├── instantRail.js     # Regional Instant Network adapter (FedNow/SEPA/UPI)
│       │   ├── nettingRail.js     # Bilateral Intra-Bank Netting adapter
│       │   └── cardPushRail.js    # Visa Direct / Mastercard Send adapter
│       ├── services/              # Core Business Logic & Optimization Engines
│       │   ├── orchestrationEngine.js  # AI Multi-Rail Pareto Utility Router
│       │   ├── settlementEngine.js     # 11-stage transaction execution pipeline
│       │   ├── currencyService.js      # ExchangeRate-API integration with fallback
│       │   ├── fxTimingEngine.js       # FX trend momentum & timing recommendations
│       │   ├── fxForecastingEngine.js  # 24-hour predictive rate horizon model
│       │   ├── liquidityManager.js     # Dynamic pool utilization & penalty calculator
│       │   └── evaluationEngine.js     # Model performance benchmarking (MAE, RMSE)
│       ├── utils/
│       │   ├── auditLogger.js     # SHA-256 tamper-evident cryptographic hash audit chaining
│       │   └── mathUtils.js       # Precise financial arithmetic and bps calculation
│       ├── controllers/           # API Endpoint Request Handlers
│       │   ├── authController.js
│       │   ├── currencyController.js
│       │   ├── portfolioController.js
│       │   ├── transactionController.js
│       │   └── adminController.js
│       └── routes/                # Express REST API Route Handlers
│           ├── authRoutes.js
│           ├── currencyRoutes.js
│           ├── portfolioRoutes.js
│           ├── transactionRoutes.js
│           └── adminRoutes.js
└── client/                        # React 19 + Vite Frontend App (Port 5173)
    ├── package.json               # Client dependencies (lucide-react, chart.js, axios)
    ├── vite.config.js             # Vite development server config
    └── src/
        ├── App.jsx                # Main dashboard page assembly
        ├── services/api.js        # Axios instance configured for http://localhost:5001/api
        └── components/
            ├── MultiRailRouter.jsx        # Primary AI payment routing interface
            ├── FXQuoteCard.jsx            # Dynamic quote countdown & rate breakdown
            ├── FXTimingBadge.jsx           # Timing advice (EXECUTE NOW vs DEFER)
            ├── RailRanking.jsx            # Ranked comparison cards for 6 rails
            ├── TransactionTimeline.jsx    # 11-stage settlement execution status
            ├── TCAAnalytics.jsx           # Transaction Cost Analysis & AI Savings
            ├── RailStatusViewer.jsx       # Real-time capacity saturation monitor
            ├── FXForecastChart.jsx        # 24-hour predictive rate trend chart
            ├── HistoricalChart.jsx        # Historical exchange rate charting
            └── EvaluationBenchmarking.jsx # Benchmark comparison vs SWIFT
```

---

## ⚙️ Backend Core Microservices & Logic Breakdown

### 1. Application Entry & Database Connection
* **[server/src/index.js](file:///c:/Users/nanir/Desktop/college/project/LY%20project/Transact3/server/src/index.js)**: Configures Express app on Port 5001, mounts middleware stack (`requestId`, `rateLimiter`, `cors`, `express.json()`), and attaches route handlers.
* **[server/src/config/db.js](file:///c:/Users/nanir/Desktop/college/project/LY%20project/Transact3/server/src/config/db.js)**: Checks `process.env.MONGO_URI`. If unconfigured, it dynamically creates a `MongoMemoryServer` instance for zero-setup in-memory database execution.

---

### 2. Multi-Rail Routing Engine ([server/src/services/orchestrationEngine.js](file:///c:/Users/nanir/Desktop/college/project/LY%20project/Transact3/server/src/services/orchestrationEngine.js))
The `MultiRailOrchestrationEngine` calculates the optimal settlement pipeline by evaluating all 6 rail adapters through a multi-objective utility scoring function:

$$\text{Utility Score} = (w_{\text{reliability}} \cdot \text{Reliability}_R) - \Big[w_{\text{cost}} \cdot \text{NormCost}_R + w_{\text{speed}} \cdot \text{NormSpeed}_R + 0.1 \cdot \text{NormRisk}_R + \text{LiquidityPenalty}_R\Big]$$

#### Profile Weights Allocation:
* **BALANCED**: $w_{\text{cost}} = 0.40, w_{\text{speed}} = 0.40, w_{\text{reliability}} = 0.20$
* **COST**: $w_{\text{cost}} = 0.70, w_{\text{speed}} = 0.10, w_{\text{reliability}} = 0.20$
* **SPEED**: $w_{\text{cost}} = 0.10, w_{\text{speed}} = 0.70, w_{\text{reliability}} = 0.20$

---

### 3. Payment Rail Adapters ([server/src/rails/](file:///c:/Users/nanir/Desktop/college/project/LY%20project/Transact3/server/src/rails/))
All 5 payment rail adapters inherit from `BaseRailAdapter` ([railAdapter.js](file:///c:/Users/nanir/Desktop/college/project/LY%20project/Transact3/server/src/rails/railAdapter.js)):
1. **`swiftRail.js`**: Baseline correspondent banking (36-hr avg latency, \$25 base fee + 10 bps).
2. **`rtgsRail.js`**: Real-Time Gross Settlement (0.25-hr latency, \$18 base fee + 5 bps).
3. **`instantRail.js`**: Domestic instant clearings (1-sec latency, \$1.50 base fee + 2 bps).
4. **`nettingRail.js`**: Book transfer netting (Instant latency, \$0.00 base fee).
5. **`cardPushRail.js`**: Account-to-card push payments (9-min latency, \$3.50 base fee + 15 bps).

---

### 4. 11-Stage Settlement Execution Pipeline ([server/src/services/settlementEngine.js](file:///c:/Users/nanir/Desktop/college/project/LY%20project/Transact3/server/src/services/settlementEngine.js))
When a payment is authorized, it progresses through 11 discrete stages:
1. `INITIATED` → Request received.
2. `VALIDATED` → Currency pair & eligibility checked.
3. `QUOTED` → Active FX rate quote locked.
4. `AUTHORIZED` → Sender balance verified.
5. `FX_PENDING` → Rate lock initiated.
6. `FX_EXECUTED` → Conversion completed.
7. `RAIL_SELECTED` → Preferred rail assigned.
8. `LIQUIDITY_RESERVED` → Rail capacity subtracted.
9. `SETTLEMENT_PENDING` → Pipeline dispatch via rail adapter.
10. `SETTLED` → Clearing reference issued & recipient wallet credited.
11. `COMPLETED` → Double-entry balanced ledger entry & SHA-256 audit chained.

---

### 5. SHA-256 Tamper-Evident Audit Log ([server/src/utils/auditLogger.js](file:///c:/Users/nanir/Desktop/college/project/LY%20project/Transact3/server/src/utils/auditLogger.js))
Implements a cryptographically chained SHA-256 audit log:
* Each audit entry contains `sequence`, `timestamp`, `eventType`, `transactionId`, `data`, `previousHash`, and `hash`.
* `verifyAuditChain()` dynamically validates hash linkage and payload integrity from sequence #1 to latest.

---

## 🖥️ Frontend React Architecture Breakdown

### 1. Main Dashboard ([client/src/pages/Dashboard.jsx](file:///c:/Users/nanir/Desktop/college/project/LY%20project/Transact3/client/src/pages/Dashboard.jsx))
Presents core user metrics: Total Balance ($ USD), Completed Payments, Total Rail Fees Paid, Historical Savings vs SWIFT, Multi-Currency Holdings breakdown, and Recent Activity feed.

### 2. Payment Router UI ([client/src/pages/PaymentRouter.jsx](file:///c:/Users/nanir/Desktop/college/project/LY%20project/Transact3/client/src/pages/PaymentRouter.jsx))
* Handles user inputs (Amount, Source Currency, Destination Currency, Recipient Selector, Payment Mode A vs B).
* Priority profile selector buttons (`BALANCED`, `CHEAPEST`, `FASTEST`).
* Fetches live binding quotes from `POST /api/transaction/quote`.
* Displays real-time comparative matrix across all 5 settlement rails with eligibility badges, fees, times, and clear rejection reasons.
* Supports Manual Override with clear tracking and prompt execution via `POST /api/transaction/confirm`.

---

## 🔌 API Route Reference

| HTTP Method | Route Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | API health check status |
| `POST` | `/api/user/register` | Create user account |
| `POST` | `/api/user/login` | Authenticate user & receive JWT |
| `GET` | `/api/user/recipients` | List registered recipients for transfers |
| `GET` | `/api/currency/rates/:pair` | Get current spot exchange rate |
| `GET` | `/api/portfolio` | Get user multi-currency wallet holdings & history |
| `POST` | `/api/portfolio/deposit` | Simulate deposit into wallet with ledger recording |
| `POST` | `/api/transaction/quote` | Generate 60s binding quote & evaluate 5 rails |
| `POST` | `/api/transaction/confirm` | Atomic settlement execution, wallet update & ledger |
| `GET` | `/api/transaction/history` | User transaction history with TCA savings |
| `GET` | `/api/transaction/:id` | Full transaction details with ledger & audit records |
| `GET` | `/api/admin/metrics` | System-wide payment volume, savings & fees |
| `GET` | `/api/admin/rails` | Rail statuses, liquidity capacities, and pool toggles |
| `POST` | `/api/admin/rails/:railId/toggle` | Enable / disable payment rail |
| `POST` | `/api/admin/rails/:railId/liquidity` | Adjust available liquidity pool capacity |
| `GET` | `/api/admin/audit-chain` | Complete SHA-256 audit log with cryptographic validation |
| `GET` | `/api/admin/reconcile` | System-wide double-entry ledger balance verification |
