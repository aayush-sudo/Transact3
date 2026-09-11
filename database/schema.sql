-- ====================================================================
-- Transact3: PostgreSQL 16 Production Ledger & Transaction Schema
-- Strict ACID Compliance, UUID Primary Keys, Double-Entry Enforced
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Core Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legal_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    kyc_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Multi-Currency Wallets Table (One wallet per user per currency)
CREATE TABLE IF NOT EXISTS wallets (
    wallet_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    currency VARCHAR(10) NOT NULL,
    balance NUMERIC(20, 4) NOT NULL DEFAULT 0.0000 CHECK (balance >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_currency UNIQUE (user_id, currency)
);

-- 3. Cross-Border Transactions & SAGA State Tracking
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id VARCHAR(100) UNIQUE NOT NULL,
    sender_wallet_id UUID NOT NULL REFERENCES wallets(wallet_id),
    receiver_wallet_id UUID NOT NULL REFERENCES wallets(wallet_id),
    source_currency VARCHAR(10) NOT NULL,
    target_currency VARCHAR(10) NOT NULL,
    source_amount NUMERIC(20, 4) NOT NULL,
    target_amount NUMERIC(20, 4) NOT NULL,
    applied_fx_rate NUMERIC(14, 6) NOT NULL,
    selected_rail VARCHAR(50) NOT NULL,
    clearing_reference VARCHAR(100),
    saga_status VARCHAR(50) NOT NULL DEFAULT 'INITIATED',
    -- Statuses: INITIATED, AML_CLEARED, FUNDS_LOCKED, EXECUTED_ON_RAIL, SETTLED, FAILED_ROLLBACK
    rollback_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Append-Only Double-Entry Financial Ledger
CREATE TABLE IF NOT EXISTS ledger_entries (
    entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(transaction_id),
    wallet_id UUID NOT NULL REFERENCES wallets(wallet_id),
    entry_type VARCHAR(6) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    amount NUMERIC(20, 4) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. OFAC / UN Sanction Screening Audit Log
CREATE TABLE IF NOT EXISTS compliance_audit_logs (
    screening_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES transactions(transaction_id),
    query_name VARCHAR(255) NOT NULL,
    matched_target VARCHAR(255),
    risk_score NUMERIC(6, 4) NOT NULL,
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('PASS', 'MANUAL_REVIEW', 'REJECT')),
    screened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_saga ON transactions(saga_status);
CREATE INDEX IF NOT EXISTS idx_ledger_tx ON ledger_entries(transaction_id);
