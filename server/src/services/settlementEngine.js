const { RAIL_MAP } = require('../rails');
const liquidityManager = require('./liquidityManager');
const ledgerEngine = require('./ledgerEngine');
const auditEngine = require('./auditEngine');
const portfolioController = require('../controllers/portfolioController');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const LedgerEntry = require('../models/LedgerEntry');
const { roundToPrecision } = require('../utils/mathUtils');

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
      railFeeCurrency,
      railFeeAmount,
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
    const feeCurrency = railFeeCurrency || 'USD';
    const feeAmount = Number(railFeeAmount) || Number(railFeeUSD || 0);

    let actualRecipientId = recipientId;
    if (!actualRecipientId && receiverEmail) {
      const recipientUser = await User.findOne({ email: receiverEmail.toLowerCase().trim() });
      if (recipientUser) actualRecipientId = recipientUser._id;
    }
    if (!actualRecipientId || !(await User.findById(actualRecipientId))) {
      throw new Error('Settlement recipient was not found');
    }

    const reservedRail = transactionDoc.liquidityReserved
      ? await liquidityManager.getRailSetting(selectedRail)
      : null;
    const eligibility = transactionDoc.liquidityReserved
      ? {
          isEligible: Boolean(reservedRail?.isEnabled && sourceAmountUSD <= reservedRail.maxAmountUSD),
          rejectionReason: 'The selected route is no longer available'
        }
      : await liquidityManager.checkRailEligibility(selectedRail, sourceAmountUSD);
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

    let principalDebited = Boolean(transactionDoc.fundsReserved);
    let feeDebited = Boolean(transactionDoc.fundsReserved && feeAmount > 0);
    let liquidityConsumed = Boolean(transactionDoc.liquidityReserved);
    let recipientCredited = false;
    let ledgerAttempted = false;

    try {
      if (!transactionDoc.fundsReserved) {
        await portfolioController.debitUserWallet(senderId, sourceCurrency, sourceAmount);
        principalDebited = true;
      }
      if (!transactionDoc.fundsReserved && feeAmount > 0) {
        await portfolioController.debitUserWallet(senderId, feeCurrency, feeAmount);
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

      if (!transactionDoc.liquidityReserved) {
        liquidityConsumed = await liquidityManager.consumeLiquidity(selectedRail, sourceAmountUSD);
        if (!liquidityConsumed) throw new Error(`Insufficient remaining liquidity on ${selectedRail}`);
      }
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
        railFeeCurrency: feeCurrency,
        railFeeAmount: feeAmount,
        selectedRail
      });

      const updatedTransaction = await Transaction.findByIdAndUpdate(transactionId, {
        status: 'COMPLETED',
        settledAt: new Date(),
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
        await rollback('rail fee', () => portfolioController.creditUserWallet(senderId, feeCurrency, feeAmount));
      }
      if (principalDebited) {
        await rollback('sender principal', () => portfolioController.creditUserWallet(senderId, sourceCurrency, sourceAmount));
      }
      if (liquidityConsumed) {
        await rollback('rail liquidity', () => liquidityManager.restoreLiquidity(selectedRail, sourceAmountUSD));
      }
      await rollback('transaction status', () => Transaction.findByIdAndUpdate(transactionId, {
        status: 'FAILED',
        ...(rollbackErrors.length === 0 ? { fundsReserved: false, liquidityReserved: false } : {})
      }));
      if (rollbackErrors.length === 0) {
        transactionDoc.fundsReserved = false;
        transactionDoc.liquidityReserved = false;
      }
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

SettlementEngine.prototype.releaseReservations = async function releaseReservations(transactionId) {
  const transaction = await Transaction.findById(transactionId);
  if (!transaction || (!transaction.fundsReserved && !transaction.liquidityReserved)) return;

  if (transaction.fundsReserved) {
    await portfolioController.creditUserWallet(transaction.sender, transaction.sourceCurrency, transaction.sourceAmount);
    const feeAmount = Number(transaction.railFeeAmount) || Number(transaction.railFeeUSD || 0);
    if (feeAmount > 0) {
      await portfolioController.creditUserWallet(
        transaction.sender,
        transaction.railFeeCurrency || 'USD',
        feeAmount
      );
    }
  }
  if (transaction.liquidityReserved) {
    const sourceAmountUSD = Math.max(
      0,
      Number(transaction.totalSenderDebitUSD) - Number(transaction.railFeeUSD || 0) || Number(transaction.sourceAmount)
    );
    await liquidityManager.restoreLiquidity(transaction.selectedRail, sourceAmountUSD);
  }
  await Transaction.findByIdAndUpdate(transaction._id, {
    status: 'FAILED',
    fundsReserved: false,
    liquidityReserved: false
  });
};

module.exports = new SettlementEngine();
