const swiftRail = require('../rails/swiftRail');
const rtgsRail = require('../rails/rtgsRail');
const instantRail = require('../rails/instantRail');
const stablecoinRail = require('../rails/stablecoinRail');
const nettingRail = require('../rails/nettingRail');
const cardPushRail = require('../rails/cardPushRail');

const liquidityManager = require('./liquidityManager');
const ledgerEngine = require('./ledgerEngine');
const auditEngine = require('./auditEngine');
const FXExecution = require('../models/FXExecution');
const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');

const RAIL_MAP = {
  SWIFT_BATCH: swiftRail,
  RTGS_INSTANT: rtgsRail,
  REGIONAL_INSTANT: instantRail,
  STABLECOIN_VAULT: stablecoinRail,
  NETTING_LEDGER: nettingRail,
  CARD_PUSH: cardPushRail
};

class SettlementEngine {
  async processSettlement(transactionDoc) {
    const {
      _id: transactionId,
      sender: userId,
      quoteId,
      sourceCurrency,
      destinationCurrency,
      sourceAmount,
      destinationAmount,
      selectedRail,
      referenceFXRate,
      quotedFXRate
    } = transactionDoc;

    // 1. Reserve Liquidity in Destination Currency Pool
    const resResult = liquidityManager.reserveLiquidity(destinationCurrency, destinationAmount, selectedRail);
    if (!resResult.success) {
      await auditEngine.logEvent({
        transactionId: String(transactionId),
        action: 'LIQUIDITY_RESERVATION_FAILED',
        result: 'FAILURE',
        metadata: { reason: resResult.reason }
      });
      return await this.triggerFallback(transactionDoc, resResult.reason);
    }

    // 2. Select Rail Adapter
    const railAdapter = RAIL_MAP[selectedRail] || swiftRail;

    // 3. Execute Rail Settlement
    try {
      const railResult = await railAdapter.execute({
        _id: transactionId,
        quoteId,
        sender: userId,
        sourceAmount,
        destinationAmount,
        sourceCurrency,
        destinationCurrency,
        selectedRail
      });

      // 4. Deduct User Wallet Balance & Portfolio Holding (if DB available)
      try {
        if (userId && User.findById) {
          const user = await User.findById(userId);
          if (user) {
            user.walletBalance = Math.max(0, (user.walletBalance || 50000) - sourceAmount);
            await user.save();
          }
        }

        if (userId && Portfolio.findOne) {
          let portfolio = await Portfolio.findOne({ user: userId });
          if (portfolio) {
            const holdingIndex = portfolio.holdings.findIndex(h => h.currency === sourceCurrency);
            if (holdingIndex > -1) {
              portfolio.holdings[holdingIndex].amount = Math.max(0, portfolio.holdings[holdingIndex].amount - sourceAmount);
              await portfolio.save();
            }
          }
        }
      } catch (userErr) {
        console.warn('[SettlementEngine] Wallet/Portfolio update skipped:', userErr.message);
      }

      // 5. Record FX Execution details (with simulated micro-slippage)
      const executedRate = parseFloat((quotedFXRate * 0.9998).toFixed(6));
      try {
        if (FXExecution.create) {
          await FXExecution.create({
            transactionId,
            quoteId,
            currencyPair: `${sourceCurrency}/${destinationCurrency}`,
            referenceRate: referenceFXRate,
            quotedRate: quotedFXRate,
            executedRate,
            spreadBps: 35,
            slippageBps: 2,
            executionTimestamp: new Date()
          });
        }
      } catch (e) {
        console.warn('[SettlementEngine] FXExecution DB create skipped');
      }

      // 6. Write Double-Entry Clearing Ledger
      const ledgerResult = await ledgerEngine.recordDoubleEntry({
        transactionId,
        quoteId,
        sourceCurrency,
        destinationCurrency,
        sourceAmount,
        destinationAmount,
        selectedRail
      });

      // 7. Write Tamper-Evident Audit Event
      await auditEngine.logEvent({
        transactionId: String(transactionId),
        action: 'SETTLEMENT_COMPLETED',
        result: 'SUCCESS',
        metadata: {
          selectedRail,
          clearingReference: railResult.clearingReference,
          settledAt: railResult.settledAt,
          blockchainReceipt: railResult.blockchainReceipt || null
        }
      });

      // 8. Update Transaction document in DB if it exists
      try {
        if (Transaction.findByIdAndUpdate) {
          await Transaction.findByIdAndUpdate(transactionId, {
            status: 'COMPLETED',
            clearingReference: railResult.clearingReference,
            iso20022Message: railResult.iso20022 ? railResult.iso20022.pacs008 : null,
            blockchainReceipt: railResult.blockchainReceipt || null
          });
        }
      } catch (updateErr) {
        console.warn('[SettlementEngine] Transaction update skipped');
      }

      return {
        success: true,
        settlementStatus: 'COMPLETED',
        clearingReference: railResult.clearingReference,
        settledAt: railResult.settledAt,
        executedRate,
        iso20022: railResult.iso20022,
        blockchainReceipt: railResult.blockchainReceipt,
        clearingScheme: railResult.clearingScheme,
        ledgerEntriesCount: ledgerResult.entriesCount
      };
    } catch (err) {
      // Settlement Failure -> Release Reserved Liquidity & Fallback
      liquidityManager.releaseLiquidity(destinationCurrency, destinationAmount, selectedRail);
      await auditEngine.logEvent({
        transactionId: String(transactionId),
        action: 'SETTLEMENT_FAILED',
        result: 'FAILURE',
        metadata: { error: err.message }
      });

      return await this.triggerFallback(transactionDoc, err.message);
    }
  }

  async triggerFallback(transactionDoc, failureReason) {
    const { _id: transactionId, selectedRail } = transactionDoc;

    const fallbackRailOrder = ['REGIONAL_INSTANT', 'RTGS_INSTANT', 'SWIFT_BATCH'].filter(r => r !== selectedRail);
    const fallbackRail = fallbackRailOrder[0] || 'SWIFT_BATCH';

    await auditEngine.logEvent({
      transactionId: String(transactionId),
      action: 'FALLBACK_TRIGGERED',
      result: 'WARNING',
      metadata: { originalRail: selectedRail, fallbackRail, reason: failureReason }
    });

    const railAdapter = RAIL_MAP[fallbackRail] || swiftRail;
    const railResult = await railAdapter.execute({ ...transactionDoc, selectedRail: fallbackRail });

    try {
      if (Transaction.findByIdAndUpdate) {
        await Transaction.findByIdAndUpdate(transactionId, {
          status: 'COMPLETED_VIA_FALLBACK',
          usedFallbackRail: fallbackRail,
          clearingReference: railResult.clearingReference
        });
      }
    } catch (e) {}

    return {
      success: true,
      settlementStatus: 'COMPLETED_VIA_FALLBACK',
      clearingReference: railResult.clearingReference,
      usedFallbackRail: fallbackRail,
      settledAt: railResult.settledAt,
      iso20022: railResult.iso20022
    };
  }
}

module.exports = new SettlementEngine();
