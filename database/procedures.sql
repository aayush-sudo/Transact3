-- ====================================================================
-- Transact3: Atomic Stored Procedures & SAGA Compensating Routines
-- ====================================================================

-- 1. Atomic Double-Entry Ledger Posting Function
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
    -- Step 1: Debit Sender Wallet with Strict Balance Verification
    UPDATE wallets 
    SET balance = balance - p_source_amount 
    WHERE wallet_id = p_sender_wallet AND balance >= p_source_amount;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient funds or sender wallet locked. Aborting transaction %.', p_transaction_id;
    END IF;

    -- Step 2: Credit Receiver Wallet
    UPDATE wallets 
    SET balance = balance + p_target_amount 
    WHERE wallet_id = p_receiver_wallet;

    -- Step 3: Insert Immutable Debit Entry
    INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount, currency, description)
    VALUES (p_transaction_id, p_sender_wallet, 'DEBIT', p_source_amount, p_source_currency, 'Cross-Border Transfer Outflow');

    -- Step 4: Insert Immutable Credit Entry
    INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount, currency, description)
    VALUES (p_transaction_id, p_receiver_wallet, 'CREDIT', p_target_amount, p_target_currency, 'Cross-Border Settlement Credit');

    -- Step 5: Transition Transaction to SETTLED
    UPDATE transactions
    SET saga_status = 'SETTLED'
    WHERE transaction_id = p_transaction_id;
END;
$$ LANGUAGE plpgsql;


-- 2. SAGA Compensating Action: Atomic Rollback on Failure
CREATE OR REPLACE FUNCTION execute_saga_rollback(
    p_transaction_id UUID,
    p_sender_wallet UUID,
    p_source_amount NUMERIC,
    p_source_currency VARCHAR,
    p_failure_reason TEXT
) RETURNS VOID AS $$
BEGIN
    -- Step 1: Re-credit Sender Wallet (Compensate locked funds)
    UPDATE wallets
    SET balance = balance + p_source_amount
    WHERE wallet_id = p_sender_wallet;

    -- Step 2: Record Compensating Ledger Reversal
    INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount, currency, description)
    VALUES (p_transaction_id, p_sender_wallet, 'CREDIT', p_source_amount, p_source_currency, 'SAGA Compensation: Fund Reversal');

    -- Step 3: Record Failed State
    UPDATE transactions
    SET saga_status = 'FAILED_ROLLBACK',
        rollback_reason = p_failure_reason
    WHERE transaction_id = p_transaction_id;
END;
$$ LANGUAGE plpgsql;
