/**
 * Event-Sourced SAGA Orchestrator for Cross-Border Settlement
 * Enforces atomic state progression:
 * INITIATED -> AML_SCREENING -> FUNDS_LOCKED -> RAIL_DISPATCH -> SETTLED
 * With automated compensating rollbacks upon simulated downstream failure.
 */

const portfolioController = require('../controllers/portfolioController');
const ledgerEngine = require('./ledgerEngine');
const auditEngine = require('./auditEngine');
const amlService = require('./amlService');
const iso20022 = require('../utils/iso20022');
const Transaction = require('../models/Transaction');

class SagaOrchestrator {
  /**
   * Executes the full SAGA lifecycle for a cross-border payment.
   */
  async executeSaga(transaction, railAdapter, options = {}) {
    const { simulateDownstreamFailure = false } = options;
    const txId = transaction._id;
    let fundsLocked = false;
    let debitAmount = transaction.sourceAmount;

    try {
      // Step 1: INITIATED
      await this.transitionState(transaction, 'INITIATED', 'SAGA transaction initiated.');

      // Step 2: AML / Sanction Screening
      await this.transitionState(transaction, 'AML_SCREENING', 'Evaluating fuzzy AML & sanction risk.');
      const receiverTarget = transaction.receiverEmail || 'Recipient';
      const amlResult = await amlService.screenName(receiverTarget);
      
      transaction.riskScore = Math.round((amlResult.risk_score || 0.1) * 100);
      if (amlResult.decision === 'REJECT') {
        await this.transitionState(
          transaction,
          'AML_REJECTED',
          `Payment blocked by AML Sanction Screening: Matched ${amlResult.matched_target} (${Math.round(amlResult.risk_score * 100)}% risk)`
        );
        throw new Error(`AML Compliance Failure: Transaction rejected due to sanctions match against '${amlResult.matched_target}'`);
      }

      // Step 3: FUNDS_LOCKED (Debit sender balance)
      await this.transitionState(transaction, 'FUNDS_LOCKED', 'Locking and debiting sender funds.');
      debitAmount = transaction.sourceCurrency === 'USD'
        ? (transaction.sourceAmount + (transaction.railFeeUSD || 0))
        : transaction.sourceAmount;

      await portfolioController.debitUserWallet(
        transaction.sender,
        transaction.sourceCurrency,
        debitAmount
      );
      fundsLocked = true;

      // Step 4: RAIL_DISPATCH (Simulated Execution on Payment Rail)
      await this.transitionState(transaction, 'RAIL_DISPATCH', `Dispatching to ${transaction.selectedRail} rail adapter.`);
      
      if (simulateDownstreamFailure) {
        throw new Error('Downstream clearing rail timeout / partner gateway rejection (Simulated SAGA Failure)');
      }

      const railExecution = await railAdapter.executePayment(transaction);

      // Step 5: SETTLED (Credit recipient & commit balanced double-entry ledger)
      await portfolioController.creditUserWallet(
        transaction.recipient,
        transaction.destinationCurrency,
        transaction.destinationAmount
      );

      // Record 6-way balanced double-entry ledger entries
      const ledgerResult = await ledgerEngine.recordPaymentSettlement({
        transactionId: transaction._id,
        senderId: transaction.sender,
        recipientId: transaction.recipient,
        sourceCurrency: transaction.sourceCurrency,
        destinationCurrency: transaction.destinationCurrency,
        sourceAmount: transaction.sourceAmount,
        destinationAmount: transaction.destinationAmount,
        railFeeUSD: transaction.railFeeUSD,
        rail: transaction.selectedRail
      });

      // Generate ISO 20022 pacs.008 XML message
      const isoXml = iso20022.generatePacs008Xml(transaction);
      transaction.isoXmlMessage = isoXml;
      transaction.status = 'COMPLETED';
      transaction.sagaStatus = 'SETTLED';
      await transaction.save();

      // Log success in SHA-256 Audit Chain
      await auditEngine.logEvent({
        action: 'SAGA_TRANSACTION_SETTLED',
        eventType: 'SAGA_TRANSACTION_SETTLED',
        transactionId: transaction._id,
        data: {
          rail: transaction.selectedRail,
          clearingReference: transaction.clearingReference,
          sagaStatus: 'SETTLED',
          ledgerBalance: ledgerResult.totalDebits
        }
      });

      return {
        success: true,
        transaction,
        clearingReference: transaction.clearingReference,
        sagaStatus: 'SETTLED',
        isoXml
      };
    } catch (error) {
      console.warn(`[SagaOrchestrator] Error during step execution: ${error.message}`);

      // Automated Compensating Action (Rollback)
      if (fundsLocked) {
        await this.compensateRollback(transaction, debitAmount, error.message);
      } else {
        transaction.status = 'FAILED';
        transaction.sagaStatus = 'FAILED_ABORTED';
        transaction.errorMessage = error.message;
        await transaction.save();
      }

      throw error;
    }
  }

  /**
   * SAGA Compensating Action: Atomically restores sender balance on downstream failure.
   */
  async compensateRollback(transaction, amountToRefund, reason) {
    try {
      console.log(`[SagaOrchestrator] Triggering compensating rollback for Tx ${transaction._id}: Refund ${amountToRefund} ${transaction.sourceCurrency}`);
      
      // 1. Re-credit sender wallet
      await portfolioController.creditUserWallet(
        transaction.sender,
        transaction.sourceCurrency,
        amountToRefund
      );

      // 2. Insert compensating ledger entry
      await ledgerEngine.recordDeposit({
        userId: transaction.sender,
        userEmail: transaction.receiverEmail,
        currency: transaction.sourceCurrency,
        amount: amountToRefund,
        description: `SAGA Compensating Rollback: Refund for failed transaction ${transaction._id}`
      });

      // 3. Update transaction record
      transaction.status = 'FAILED';
      transaction.sagaStatus = 'FAILED_ROLLBACK';
      transaction.errorMessage = reason;
      await transaction.save();

      // 4. Record rollback in SHA-256 audit log
      await auditEngine.logEvent({
        action: 'SAGA_COMPENSATION_ROLLBACK',
        eventType: 'SAGA_COMPENSATION_ROLLBACK',
        transactionId: transaction._id,
        data: {
          refundAmount: amountToRefund,
          refundCurrency: transaction.sourceCurrency,
          reason,
          sagaStatus: 'FAILED_ROLLBACK'
        }
      });

      console.log(`[SagaOrchestrator] Compensating rollback completed cleanly for Tx ${transaction._id}. Zero fund leakage.`);
    } catch (compensateError) {
      console.error(`[SagaOrchestrator] CRITICAL: Compensation failure for Tx ${transaction._id}:`, compensateError);
    }
  }

  async transitionState(transaction, newStatus, logMessage) {
    transaction.sagaStatus = newStatus;
    await transaction.save();
    console.log(`[SAGA State] [${transaction._id}] -> ${newStatus}: ${logMessage}`);
  }
}

module.exports = new SagaOrchestrator();
