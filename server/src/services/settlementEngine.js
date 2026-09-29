const swiftRail = require('../rails/swiftRail');
const instantRail = require('../rails/instantRail');
const nettingRail = require('../rails/nettingRail');
const cardPushRail = require('../rails/cardPushRail');

const liquidityManager = require('./liquidityManager');
const ledgerEngine = require('./ledgerEngine');
const auditEngine = require('./auditEngine');
const portfolioController = require('../controllers/portfolioController');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const LedgerEntry = require('../models/LedgerEntry');
const { roundToPrecision } = require('../utils/mathUtils');

const RAIL_MAP = {
  INSTANT_PAYMENT_LINK: instantRail,
  REGIONAL_INSTANT: instantRail,
  BILATERAL_NETTING: nettingRail,
  NETTING_LEDGER: nettingRail,
  CARD_PAYOUT: cardPushRail,
  CARD_PUSH: cardPushRail,
  SWIFT_CORRESPONDENT: swiftRail,
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
    const sourceAmountUSD = Math.max(
      0,
      Number(totalSenderDebitUSD) - Number(railFeeUSD || 0) || Number(sourceAmount)
    );

    const senderUser = await User.findById(senderId);
    if (!senderUser) throw new Error('Settlement sender was not found');
    const senderEmail = senderUser.email;

    let actualRecipientId = recipientId;
    if (!actualRecipientId && receiverEmail) {
      const recipientUser = await User.findOne({ email: receiverEmail.toLowerCase().trim() });
      if (recipientUser) actualRecipientId = recipientUser._id;
    }
    if (!actualRecipientId || !(await User.findById(actualRecipientId))) {
      throw new Error('Settlement recipient was not found');
    }

    const eligibility = await liquidityManager.checkRailEligibility(selectedRail, sourceAmountUSD);
    if (!eligibility.isEligible) {
      await Transaction.findByIdAndUpdate(transactionId, { status: 'FAILED' });
      await auditEngine.logEvent({
        transactionId: String(transactionId),
        actor: String(senderId),
        action: 'SETTLEMENT_REJECTED_INELIGIBLE',
        result: 'FAILURE',
        metadata: { railId: selectedRail, reason: eligibility.rejectionReason }
      });
      throw new Error(`Cannot settle on ${selectedRail}: ${eligibility.rejectionReason}`);
    }

    const railAdapter = RAIL_MAP[selectedRail];
    if (!railAdapter) throw new Error(`Unsupported settlement rail ${selectedRail}`);

    let principalDebited = false;
    let feeDebited = false;
    let liquidityConsumed = false;
    let recipientCredited = false;
    let ledgerAttempted = false;

    try {
      await portfolioController.debitUserWallet(senderId, sourceCurrency, sourceAmount);
      principalDebited = true;
      if (railFeeUSD > 0) {
        await portfolioController.debitUserWallet(senderId, 'USD', railFeeUSD);
        feeDebited = true;
      }

      const railResult = await railAdapter.executePayment({
        _id: transactionId,
        quoteId,
        sender: senderId,
        sourceAmount,
        destinationAmount,
        sourceCurrency,
        destinationCurrency,
        selectedRail
      });

      await liquidityManager.consumeLiquidity(selectedRail, sourceAmountUSD);
      liquidityConsumed = true;
      await portfolioController.creditUserWallet(actualRecipientId, destinationCurrency, destinationAmount);
      recipientCredited = true;

      ledgerAttempted = true;
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

      const updatedTransaction = await Transaction.findByIdAndUpdate(transactionId, {
        status: 'COMPLETED',
        clearingReference: railResult.clearingReference,
        iso20022Message: railResult.iso20022 ? railResult.iso20022.pacs008 : null,
        simulationDurationMs: railResult.simulationDurationMs
      }, { new: true });
      if (!updatedTransaction) throw new Error('Could not persist completed transaction status');

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

      transactionDoc.status = 'COMPLETED';
      transactionDoc.clearingReference = railResult.clearingReference;
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
    } catch (settlementError) {
      const rollbackErrors = [];
      const rollback = async (label, operation) => {
        try {
          await operation();
        } catch (error) {
          rollbackErrors.push(`${label}: ${error.message}`);
        }
      };

      if (ledgerAttempted) {
        await rollback('ledger entries', () => LedgerEntry.deleteMany({ transactionId }));
      }
      if (recipientCredited) {
        await rollback('recipient credit', () => portfolioController.debitUserWallet(actualRecipientId, destinationCurrency, destinationAmount));
      }
      if (feeDebited) {
        await rollback('rail fee', () => portfolioController.creditUserWallet(senderId, 'USD', railFeeUSD));
      }
      if (principalDebited) {
        await rollback('sender principal', () => portfolioController.creditUserWallet(senderId, sourceCurrency, sourceAmount));
      }
      if (liquidityConsumed) {
        await rollback('rail liquidity', () => liquidityManager.restoreLiquidity(selectedRail, sourceAmountUSD));
      }
      await rollback('transaction status', () => Transaction.findByIdAndUpdate(transactionId, { status: 'FAILED' }));
      await rollback('failure audit', () => auditEngine.logEvent({
        transactionId: String(transactionId),
        actor: String(senderId),
        action: 'SETTLEMENT_FAILED_ROLLED_BACK',
        result: 'FAILURE',
        metadata: { error: settlementError.message, rollbackErrors }
      }));

      if (rollbackErrors.length > 0) {
        throw new Error(`Settlement failed: ${settlementError.message}. Rollback issues: ${rollbackErrors.join('; ')}`);
      }
      throw settlementError;
    }
  }
}

module.exports = new SettlementEngine();
