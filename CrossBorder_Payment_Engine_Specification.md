# System Architecture & Technical Specification: Multi-Rail Intelligent Cross-Border Payment Framework

**Document Version:** 1.0.0  
**Project Category:** Final Year Engineering Project / Software Systems & Financial Engineering  
**Target Domain:** Fintech, Distributed Systems, RegTech, Web2/Web3 Hybrid Architectures  

---

## Executive Summary

Traditional cross-border payment mechanisms (e.g., SWIFT correspondent banking) suffer from systemic inefficiencies, high foreign exchange (FX) markups (2–5%), multi-day settlement latency, and opaque fee structures. Furthermore, static regulatory compliance mechanisms frequently fail to detect deliberate phonetic variations in sanction evasion while producing high false-positive rates.

This project implements an **Intelligent Multi-Rail Cross-Border Payment & Settlement Engine**. The system combines:
1. **Algorithmic Liquidity & FX Routing:** A dynamic directed graph engine using **Dijkstra’s and Bellman-Ford algorithms** to calculate optimal multi-hop FX settlement paths across fiat clearing rails and liquidity pools.
2. **Fuzzy-Matching RegTech Compliance Microservice:** An automated Anti-Money Laundering (AML) and Sanction Screening engine utilizing **Jaro-Winkler distance**, **Levenshtein edit distance**, and **Soundex phonetic matching** against official US Treasury (OFAC) and UN sanction lists.
3. **Resilient Distributed Ledger & Event-Driven Engine:** An **Event-Sourced SAGA Orchestrator** backed by an append-only double-entry relational database schema (PostgreSQL) guaranteeing ACID compliance and automated saga rollbacks during network timeouts or downstream rail failures.
4. **Standardized ISO 20022 Financial Messaging:** Automated background generation of compliant `pacs.008.001.10` XML payment messages for bank interoperability.

---

## Technical Stack & Infrastructure Topology

| Architectural Layer | Technology Stack | Primary Function & Responsibility |
| :--- | :--- | :--- |
| **Frontend Presentation** | Next.js / React 19, Tailwind CSS, Lucide Icons | Real-time FX quote countdown timers, multi-step execution visualization, interactive graph route viewer, KYC document ingestion. |
| **API Gateway & Auth** | Node.js (Express / Fastify), JWT, Redis / Memory Rate Limiter | Route protection, authentication, request validation, WebSocket event broadcasting. |
| **Core Microservices** | Python 3.11 (FastAPI, NumPy, NetworkX, Levenshtein) | Graph pathfinding, fuzzy AML string matching, ISO 20022 XML generation. |
| **Ledger & Persistence** | PostgreSQL 16 & MongoDB (Strict ACID, Double-Entry Enforced) | Transaction logs, wallet balances, immutable ledger entries, audit trails. |
| **Event Bus & State** | Event-Sourced SAGA Pattern | Microservice orchestration, SAGA state management, compensating rollbacks. |
| **Settlement Rails Sandbox**| 5 Fiat Rails: Regional Instant, Netting Ledger, RTGS, Card Push, SWIFT | Execution of domestic payout and cross-border simulated rails. |

---

## System Architecture Diagram

```
                               ┌─────────────────────────────────────────┐
                               │     Client Web App (React / Next.js)    │
                               │  - FX Lock Timer & Path Visualizer      │
                               │  - Live Transaction Status Stepper      │
                               └────────────────────┬────────────────────┘
                                                    │ HTTPS / WebSockets
                                                    ▼
                               ┌─────────────────────────────────────────┐
                               │   API Gateway & Rate Limiter (Express)  │
                               │   - JWT Verification & Request Routing  │
                               └────────────────────┬────────────────────┘
                                                    │
         ┌──────────────────────────────────────────┼──────────────────────────────────────────┐
         │                                          │                                          │
         ▼                                          ▼                                          ▼
┌─────────────────────────────────┐ ┌─────────────────────────────────┐ ┌─────────────────────────────────┐
│     AML / RegTech Service       │ │     Smart Routing Engine        │ │    Distributed Ledger Engine    │
│  (Python FastAPI Microservice)  │ │  (Python FastAPI Microservice)  │ │   (Node.js SAGA Orchestrator)   │
├─────────────────────────────────┤ ├─────────────────────────────────┤ ├─────────────────────────────────┤
│ - Jaro-Winkler & Levenshtein    │ │ - Graph Construction (NetworkX) │ │ - Event-Sourced Saga Execution │
│ - Soundex Phonetic Filtering    │ │ - Dijkstra's Multi-Hop Pathing  │ │ - Double-Entry Ledger Writes    │
│ - OFAC SDN Ingestion Engine     │ │ - Real-Time Slippage & Fee Eval │ │ - ISO 20022 pacs.008 XML Gen    │
└────────────────┬────────────────┘ └────────────────┬────────────────┘ └────────────────┬────────────────┘
                 │                                   │                                   │
                 ▼                                   ▼                                   ▼
┌─────────────────────────────────┐ ┌─────────────────────────────────┐ ┌─────────────────────────────────┐
│  OFAC & UN Sanction Database    │ │    FX Market Data & Liquidity   │ │ PostgreSQL DB & Ledger Storage  │
│   (Local Vector / Text Search)  │ │  (Real-Time Multi-Pair Feeds)   │ │  (Append-Only Ledger Storage)   │
└─────────────────────────────────┘ └─────────────────────────────────┘ └─────────────────────────────────┘
```

---

## Key Technical Innovation 1: Smart Multi-Hop FX Routing Engine

### The Problem
Direct conversion between volatile or illiquid currency corridors suffers from severe bank markups (up to 6%) and poor liquidity. Converting through intermediate fiat bridges (`USD`, `EUR`) often yields significantly lower total transaction fees and faster settlement times.

### Algorithmic Solution
The system models currency exchange rates and payment rails as a **Weighted Directed Graph** $G = (V, E)$, where:
* Vertices $V$ represent currencies or tokenized assets (e.g., `USD`, `EUR`, `INR`, `GBP`, `AED`, `SGD`, `AUD`, `CAD`, `JPY`).
* Edges $E$ represent active conversion rails between currencies.
* Edge Weights $W(u, v)$ are defined as the negative logarithm of net conversion efficiency to transform the maximum yield problem into a **Shortest Path Problem**:

$$W(u, v) = -\ln \big((1 - \text{Fee}_{uv}) \times \text{Rate}_{uv}\big)$$

```python
import networkx as nx
import math

class SmartFXRouter:
    def __init__(self):
        self.graph = nx.DiGraph()

    def add_conversion_rail(self, source: str, target: str, rate: float, fee_percentage: float, latency_sec: int):
        effective_yield = (1.0 - fee_percentage) * rate
        # Negative log weight turns multiplication of rates into addition of weights for Dijkstra
        weight = -math.log(effective_yield) if effective_yield > 0 else float('inf')
        
        self.graph.add_edge(source, target, 
                            rate=rate, 
                            fee=fee_percentage, 
                            weight=weight, 
                            latency=latency_sec)

    def find_optimal_route(self, source_curr: str, target_curr: str, max_latency_sec: int = 300):
        try:
            # Dijkstra's algorithm for shortest path in weighted graph
            path = nx.dijkstra_path(self.graph, source_curr, target_curr, weight='weight')
            
            total_fee_factor = 1.0
            effective_rate = 1.0
            total_latency = 0

            for i in range(len(path) - 1):
                u, v = path[i], path[i+1]
                edge = self.graph[u][v]
                effective_rate *= edge['rate']
                total_fee_factor *= (1.0 - edge['fee'])
                total_latency += edge['latency']

            return {
                "path": path,
                "effective_rate": effective_rate,
                "net_fee_percentage": 1.0 - total_fee_factor,
                "estimated_latency_seconds": total_latency
            }
        except nx.NetworkXNoPath:
            return None
```

---

## Key Technical Innovation 2: RegTech Fuzzy Matching AML & Sanction Engine

### The Problem
Traditional exact string matching (`sender_name == sanction_name`) is easily bypassed by bad actors using minor spelling changes, phonetic variations, or word transposition (e.g., *"Vladimir Petrov"* vs. *"Wladimir Petrow"* vs. *"V. Petrov"*).

### Algorithmic Solution
The RegTech engine evaluates identity risk using a **Hybrid Multi-Metric Scoring Model**:
1. **Levenshtein Edit Distance:** Measures character-level insertions, deletions, and substitutions.
2. **Jaro-Winkler Similarity:** Weights matches at the beginning of string prefixes heavily.
3. **Soundex Algorithm:** Encodes names into phonetic representations to catch sound-alike variations.

$$\text{Composite Risk Score} = w_1 \cdot \text{JaroWinkler}(S_1, S_2) + w_2 \cdot (1 - \frac{\text{Levenshtein}(S_1, S_2)}{\max(|S_1|, |S_2|)}) + w_3 \cdot \mathbb{I}(\text{Soundex}(S_1) == \text{Soundex}(S_2))$$

```python
import jellyfish
from dataclasses import dataclass

@dataclass
class AMLCheckResult:
    query_name: str
    matched_target: str
    risk_score: float
    decision: str  # 'PASS', 'MANUAL_REVIEW', 'REJECT'

class AMLSanctionEngine:
    def __init__(self, sanctioned_entities_list: list[str]):
        self.sanctioned_list = sanctioned_entities_list

    def screen_name(self, input_name: str, threshold_reject: float = 0.85, threshold_review: float = 0.65) -> AMLCheckResult:
        normalized_input = input_name.strip().upper()
        max_score = 0.0
        best_match = ""

        for entity in self.sanctioned_list:
            normalized_entity = entity.strip().upper()
            
            # Metric 1: Jaro-Winkler
            jw_score = jellyfish.jaro_winkler_similarity(normalized_input, normalized_entity)
            
            # Metric 2: Normalized Levenshtein
            lev_dist = jellyfish.levenshtein_distance(normalized_input, normalized_entity)
            max_len = max(len(normalized_input), len(normalized_entity))
            lev_score = 1.0 - (lev_dist / max_len) if max_len > 0 else 1.0
            
            # Metric 3: Soundex Phonetic Match
            soundex_match = 1.0 if jellyfish.soundex(normalized_input) == jellyfish.soundex(normalized_entity) else 0.0

            # Composite Weighted Risk Calculation
            composite_score = (0.50 * jw_score) + (0.35 * lev_score) + (0.15 * soundex_match)

            if composite_score > max_score:
                max_score = composite_score
                best_match = entity

        if max_score >= threshold_reject:
            decision = "REJECT"
        elif max_score >= threshold_review:
            decision = "MANUAL_REVIEW"
        else:
            decision = "PASS"

        return AMLCheckResult(
            query_name=input_name,
            matched_target=best_match,
            risk_score=round(max_score, 4),
            decision=decision
        )
```

---

## Key Technical Innovation 3: Resilient Distributed Ledger & SAGA Orchestration

To avoid financial inconsistencies during system failure, state progression uses a **SAGA Orchestration Pattern**. If an intermediate API execution fails (e.g., target payout rail times out), the SAGA engine automatically executes compensating actions (reversing debits and returning funds to origin balance).

### PostgreSQL Strict Double-Entry Database Schema

```sql
-- Enforce UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core Users Table
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legal_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    kyc_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Currency Wallets Table
CREATE TABLE wallets (
    wallet_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    currency VARCHAR(10) NOT NULL,
    balance NUMERIC(20, 4) NOT NULL DEFAULT 0.0000 CHECK (balance >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_currency UNIQUE (user_id, currency)
);

-- Cross-Border Transfer State Tracking Table
CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_wallet_id UUID NOT NULL REFERENCES wallets(wallet_id),
    receiver_wallet_id UUID NOT NULL REFERENCES wallets(wallet_id),
    source_currency VARCHAR(10) NOT NULL,
    target_currency VARCHAR(10) NOT NULL,
    source_amount NUMERIC(20, 4) NOT NULL,
    target_amount NUMERIC(20, 4) NOT NULL,
    applied_fx_rate NUMERIC(14, 6) NOT NULL,
    saga_status VARCHAR(50) NOT NULL DEFAULT 'INITIATED', 
    -- Statuses: INITIATED, AML_CLEARED, FUNDS_LOCKED, EXECUTED_ON_RAIL, SETTLED, FAILED_ROLLBACK
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Append-Only Double-Entry Financial Ledger Table
CREATE TABLE ledger_entries (
    entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(transaction_id),
    wallet_id UUID NOT NULL REFERENCES wallets(wallet_id),
    entry_type VARCHAR(6) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    amount NUMERIC(20, 4) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Atomic Double-Entry Ledger Posting Function
CREATE OR REPLACE FUNCTION process_ledger_posting(
    p_transaction_id UUID,
    p_sender_wallet UUID,
    p_receiver_wallet UUID,
    p_source_amount NUMERIC,
    p_target_amount NUMERIC,
    p_source_currency VARCHAR,
    p_target_currency VARCHAR
) RETURNS VOID AS $$
BEGIN
    -- 1. Debit Sender Wallet
    UPDATE wallets 
    SET balance = balance - p_source_amount 
    WHERE wallet_id = p_sender_wallet AND balance >= p_source_amount;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient funds or sender wallet locked.';
    END IF;

    -- 2. Credit Receiver Wallet
    UPDATE wallets 
    SET balance = balance + p_target_amount 
    WHERE wallet_id = p_receiver_wallet;

    -- 3. Insert Immutable Debit Entry
    INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount, currency)
    VALUES (p_transaction_id, p_sender_wallet, 'DEBIT', p_source_amount, p_source_currency);

    -- 4. Insert Immutable Credit Entry
    INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount, currency)
    VALUES (p_transaction_id, p_receiver_wallet, 'CREDIT', p_target_amount, p_target_currency);
END;
$$ LANGUAGE plpgsql;
```

---

## International Financial Messaging: ISO 20022 `pacs.008` Generator

To ensure full compliance with financial industry messaging standards, the backend outputs structured XML documents for financial institution reporting:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>MSG20260912-89472190</MsgId>
      <CreDtTm>2026-09-12T01:52:47Z</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>CLRG</SttlmMtd>
      </SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <EndToEndId>E2E-TX-99482-2026</EndToEndId>
        <UETR>c9b1f48e-7e3d-4a12-8e2b-1a9284f28491</UETR>
      </PmtId>
      <IntrBkSttlmAmt Ccy="USD">1500.00</IntrBkSttlmAmt>
      <Dbtr>
        <Nm>Rahul Sharma</Nm>
      </Dbtr>
      <Cdtr>
        <Nm>John Doe Corp</Nm>
      </Cdtr>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>
```

---

## Evaluation Criteria & Experimental Results Setup

| Metric | Target Performance Baseline | Experimental Testing Strategy |
| :--- | :--- | :--- |
| **AML Screening Latency** | $< 15 \text{ ms}$ per screening | Execute 10,000 requests against a database of 50,000 OFAC sanctioned entities. |
| **Pathfinding Engine Latency** | $< 5 \text{ ms}$ per route query | Evaluate Dijkstra search across a dense 100-node multi-currency liquidity graph. |
| **Fuzzy Matching Precision** | $> 94\%$ True Positive Rate | Test against a benchmark dataset of intentional typos and phonetic permutations. |
| **SAGA Rollback Consistency** | $100\%$ Zero Fund Leakage | Inject artificial downstream failure at step 4 (Payout Rail API failure) during 500 parallel transactions. |
