# Transact3: Cross-Border Transfer Comparison Platform
## Final Year (LY) Project Documentation & Presentation Guide

---

## 📌 Executive Summary

**Transact3** is a light-themed wallet and cross-border transfer planning platform. Users can register, add INR through Razorpay test checkout, compare modeled route options, and schedule an internal settlement lifecycle. Razorpay operates in test mode only, and modeled routes do not connect to external payout networks.

Funds are reserved when a transfer is scheduled and credited to the recipient only when the scheduled worker settles it. Route capacity updates when wallet funds and capacity are reserved. No live payout is made.

---

## 🎯 Problem Statement vs. Transact3 Solution

### The Problem in Legacy Finance:
1. **Single-Silo Monopolies**: Traditional banks route all transfers through SWIFT correspondent networks regardless of transfer urgency or size.
2. **Weekend Blackouts**: Bank clearing systems (Fedwire, TARGET2) shut down on weekends, delaying Friday evening payments by 68+ hours.
3. **Hidden Spread Costs**: FX markups are buried inside "zero fee" marketing claims.

### The Transact3 Platform:
1. **Route Comparison**: Ranks three modeled route options by user-selected preferences.
2. **Wallet Funding**: Credits INR only after Razorpay test payment signature and captured status are verified server-side.
3. **Scheduled Settlement**: Reserves wallet funds and route capacity, then settles at the later of route ETA and FX timing guidance.

---

## 🛣️ Indicative Route Categories

| Route ID | Route Category | Reference Technology | Indicative Delivery Time | Estimated Base Fee | Typical Use |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`SWIFT_BATCH`** | Correspondent transfer | Bank-to-bank network category | 36 Hours | \$25.00 + 10 bps | Large, non-urgent transfers |
| **`REGIONAL_INSTANT`** | Regional instant | Domestic instant network category | 1 Second | \$1.50 + 2 bps | Fast low-to-medium value transfers |
| **`CARD_PUSH`** | Card payout | Debit-to-card network category | 9 Mins | \$3.50 + 15 bps | Account-to-card payouts |

---

## 🧮 Route Ranking Model

The ranking model uses a **Multi-Objective Utility Optimization Model**:

$$\text{Utility Score} = (w_{\text{reliability}} \cdot \text{Reliability}_R) - \Big[w_{\text{cost}} \cdot \text{NormCost}_R + w_{\text{speed}} \cdot \text{NormSpeed}_R + 0.1 \cdot \text{NormRisk}_R + \text{LiquidityPenalty}_R\Big]$$

### Key Dynamic Inputs:
1. **Capacity Adjustment**: Accounts for configured route capacity when ranking available options.
2. **FX Outlook**: Analyzes historical rate trends to provide `EXECUTE_NOW`, `CONSIDER_DEFER`, or `NEUTRAL` guidance.
3. **Risk Indicator**: Model-derived indicator included in the comparison output.

---

## 📈 Real-World Case Studies

### Case 1: Friday Evening Cross-Border Transfer (SWIFT Cut-Off vs Regional Instant)
* **Scenario**: A user needs to transfer **$5,000 USD → EUR** on Friday at 7:30 PM.
* **Legacy SWIFT Route**: Delayed by weekend bank closure until Monday afternoon (**68 hours**, $25.00 base fee + 10 bps).
* **Transact3 Regional Instant Route**: Settles in **1-2 seconds** via Regional Instant Network (SEPA/FedNow) for **$2.50 total**, saving **68 hours** and over **$27.50** in direct fees and latency exposure.

---

## 📊 Datasets & Data Architecture

1. **Real-Time Exchange Rates**: Live REST ingestion via `ExchangeRate-API` across 15 global currency pairs.
2. **Historical Time-Series OHLCV Dataset**: 90-day/365-day price series used for moving averages, volatility indicators, and model accuracy benchmarking (**MAE**, **RMSE**, **MAPE**).
3. **Calibrated Payment Rail Benchmarks**: Industry parameters calibrated from published SWIFT GPI, FedNow, Visa Direct, and Circle USDC vault metrics.

---

## 🎓 Viva & Presentation Q&A Guide

### Q1: "Why not just use a simple HTTP health check instead of an AI routing engine?"
> **Answer**: A health check only answers a binary question: *"Is the server alive?"* It cannot answer *"Is this payment cost-effective?"* or *"Does this pool have enough liquidity?"* Even when SWIFT is 100% healthy (`HTTP 200`), it may still be 50x more expensive and 1,000x slower than a Web3 or Instant rail. Our AI routing engine evaluates dynamic pool capacity, non-linear fees, SLA velocity, and FX volatility to compute the optimal route continuously.

### Q2: "How does FX timing affect a scheduled transfer?"
> **Answer**: The FX outlook may recommend a wait. The platform displays the recommended duration, reserves the user's wallet funds, and schedules the modeled settlement for the later of the selected route estimate or FX delay.

### Q3: "Does the app send funds through a real payout network?"
> **Answer**: No. Wallet funding uses Razorpay test mode; the three payout routes are modeled internally and do not connect to external networks.
