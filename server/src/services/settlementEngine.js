const swiftRail = require('../rails/swiftRail');
const rtgsRail = require('../rails/rtgsRail');
const instantRail = require('../rails/instantRail');
const nettingRail = require('../rails/nettingRail');
const cardPushRail = require('../rails/cardPushRail');

const liquidityManager = require('./liquidityManager');
const ledgerEngine = require('./ledgerEngine');
const auditEngine = require('./auditEngine');
const portfolioController = require('../controllers/portfolioController');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { roundToPrecision } = require('../utils/mathUtils');

const RAIL_MAP = {
  REGIONAL_INSTANT: instantRail,
  NETTING_LEDGER: nettingRail,
  RTGS_INSTANT: rtgsRail,
  CARD_PUSH: cardPushRail,
  SWIFT_BATCH: swiftRail
};

class SettlementEngine {
  async processSettlement(transactionDoc) {
    const {
      _id: transactionId,
      quoteId,
      sender: senderId,
      recipient: recipientId,
      receiverEmail,
      sourceCurrency,
      destinationCurrency,
      sourceAmount,
      destinationAmount,
      selectedRail,
      railFeeUSD,
      totalSenderDebitUSD,
      executedFXRate
    } = transactionDoc;

    const senderUser = await User.findById(senderId);
    const senderEmail = senderUser ? senderUser.email : 'sender@transact3.io';

    // 1. Check rail eligibility and liquidity
    const eligibility = await liquidityManager.checkRailEligibility(selectedRail, sourceAmount);
    if (!eligibility.isEligible) {
      await auditEngine.logEvent({
        transactionId: String(transactionId),
        actor: String(senderId),
        action: 'SETTLEMENT_REJECTED_INELIGIBLE',
        result: 'FAILURE',
        metadata: { railId: selectedRail, reason: eligibility.rejectionReason }
      });
      throw new Error(`Cannot settle on ${selectedRail}: ${eligibility.rejectionReason}`);
    }

    // 2. Select Rail Adapter
    const railAdapter = RAIL_MAP[selectedRail] || instantRail;

    // 3. Debit Sender Wallet (Amount + Fee)
    try {
      await portfolioController.debitUserWallet(senderId, sourceCurrency, sourceAmount);
      // If fee is charged in USD and source is not USD, or charged separately
      if (sourceCurrency === 'USD') {
        await portfolioController.debitUserWallet(senderId, 'USD', railFeeUSD);
      }
    } catch (balanceErr) {
      await auditEngine.logEvent({
        transactionId: String(transactionId),
        actor: String(senderId),
        action: 'SETTLEMENT_FAILED_INSUFFICIENT_BALANCE',
        result: 'FAILURE',
        metadata: { error: balanceErr.message }
      });
      throw balanceErr;
    }

    // 4. Execute Simulated Rail Payment
    let railResult;
    try {
      railResult = await railAdapter.executePayment({
        _id: transactionId,
        quoteId,
        sender: senderId,
        sourceAmount,
        destinationAmount,
        sourceCurrency,
        destinationCurrency,
        selectedRail
      });

      // Deduct consumed liquidity
      await liquidityManager.consumeLiquidity(selectedRail, sourceAmount);
    } catch (railErr) {
      // Refund sender if rail execution fails
      try {
        await portfolioController.creditUserWallet(senderId, sourceCurrency, sourceAmount);
        if (sourceCurrency === 'USD') {
          await portfolioController.creditUserWallet(senderId, 'USD', railFeeUSD);
        }
      } catch (refundErr) {}

      await auditEngine.logEvent({
        transactionId: String(transactionId),
        actor: String(senderId),
        action: 'SETTLEMENT_RAIL_EXECUTION_FAILED',
        result: 'FAILURE',
        metadata: { error: railErr.message }
      });
      throw new Error(`Rail execution failed on ${selectedRail}: ${railErr.message}`);
    }

    // 5. Credit Recipient Wallet
    let actualRecipientId = recipientId;
    if (!actualRecipientId && receiverEmail) {
      const recipientUser = await User.findOne({ email: receiverEmail.toLowerCase().trim() });
      if (recipientUser) actualRecipientId = recipientUser._id;
    }

    if (actualRecipientId) {
      try {
        await portfolioController.creditUserWallet(actualRecipientId, destinationCurrency, destinationAmount);
      } catch (creditErr) {
        console.warn('[SettlementEngine] Recipient credit error:', creditErr.message);
      }
    }

    // 6. Record Double-Entry Financial Ledger
    const ledgerResult = await ledgerEngine.recordPaymentSettlement({
      transactionId,
      quoteId,
      senderId,
      recipientId: actualRecipientId,
      senderEmail,
      recipientEmail: receiverEmail,
      sourceCurrency,
      destinationCurrency,
      sourceAmount,
      destinationAmount,
      railFeeUSD,
      selectedRail
    });

    // 7. Record Cryptographic Tamper-Evident Audit Event
    await auditEngine.logEvent({
      transactionId: String(transactionId),
      actor: String(senderId),
      action: 'SETTLEMENT_COMPLETED',
      result: 'SUCCESS',
      metadata: {
        selectedRail,
        clearingReference: railResult.clearingReference,
        expectedSettlementDuration: railResult.expectedSettlementDisplay,
        simulationDurationMs: railResult.simulationDurationMs,
        railFeeUSD,
        totalSenderDebitUSD,
        destinationAmount,
        recipientEmail: receiverEmail
      }
    });

    // 8. Update Transaction state in MongoDB
    try {
      if (Transaction.findByIdAndUpdate) {
        await Transaction.findByIdAndUpdate(transactionId, {
          status: 'COMPLETED',
          clearingReference: railResult.clearingReference,
          iso20022Message: railResult.iso20022 ? railResult.iso20022.pacs008 : null,
          simulationDurationMs: railResult.simulationDurationMs
        });
      }
    } catch (updateErr) {
      console.warn('[SettlementEngine] Transaction status update error:', updateErr.message);
    }

    return {
      success: true,
      settlementStatus: 'COMPLETED',
      clearingReference: railResult.clearingReference,
      railReference: railResult.railReference,
      expectedSettlementDisplay: railResult.expectedSettlementDisplay,
      simulationDurationMs: railResult.simulationDurationMs,
      settledAt: railResult.settledAt,
      iso20022: railResult.iso20022,
      ledgerEntriesCount: ledgerResult.entriesCount
    };
  }
}

module.exports = new SettlementEngine();
