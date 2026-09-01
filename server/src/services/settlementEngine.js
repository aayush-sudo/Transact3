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
      quoteId,
      sourceCurrency,
      destinationCurrency,
      sourceAmount,
      destinationAmount,
      selectedRail,
      referenceFXRate,
      quotedFXRate
    } = transactionDoc;

    // 1. Reserve Liquidity
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
        transactionId,
        sourceAmount,
        destinationAmount,
        sourceCurrency,
        destinationCurrency
      });

      // 4. Record FX Execution details (with 2 bps simulated micro-slippage)
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

      // 5. Write Double-Entry Clearing Ledger
      await ledgerEngine.recordDoubleEntry({
        transactionId,
        quoteId,
        sourceCurrency,
        destinationCurrency,
        sourceAmount,
        destinationAmount,
        selectedRail
      });

      // 6. Write Tamper-Evident Audit Event
      await auditEngine.logEvent({
        transactionId: String(transactionId),
        action: 'SETTLEMENT_COMPLETED',
        result: 'SUCCESS',
        metadata: {
          selectedRail,
          clearingReference: railResult.clearingReference,
          settledAt: railResult.settledAt
        }
      });

      return {
        success: true,
        settlementStatus: 'COMPLETED',
        clearingReference: railResult.clearingReference,
        settledAt: railResult.settledAt,
        executedRate
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

    // Fallback ranking: Pick next best available rail
    const fallbackRailOrder = ['REGIONAL_INSTANT', 'RTGS_INSTANT', 'SWIFT_BATCH'].filter(r => r !== selectedRail);
    const fallbackRail = fallbackRailOrder[0] || 'SWIFT_BATCH';

    await auditEngine.logEvent({
      transactionId: String(transactionId),
      action: 'FALLBACK_TRIGGERED',
      result: 'WARNING',
      metadata: { originalRail: selectedRail, fallbackRail, reason: failureReason }
    });

    const railAdapter = RAIL_MAP[fallbackRail];
    const railResult = await railAdapter.execute(transactionDoc);

    return {
      success: true,
      settlementStatus: 'COMPLETED_VIA_FALLBACK',
      clearingReference: railResult.clearingReference,
      usedFallbackRail: fallbackRail,
      settledAt: railResult.settledAt
    };
  }
}

module.exports = new SettlementEngine();
