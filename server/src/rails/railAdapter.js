const iso20022Engine = require('../utils/iso20022');
const { calculateRailFee } = require('../utils/mathUtils');

/**
 * Base Rail Adapter for Simulated Payment Rails
 * Consistent interface with simulated settlement and ISO 20022 generation
 */
class BaseRailAdapter {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.config = config;
  }

  isCutOffActive(now = new Date()) {
    const day = now.getUTCDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
    const hour = now.getUTCHours();

    // Weekend Banking Blackout Window for legacy/batch clearing (SWIFT)
    if ((this.id === 'SWIFT_CORRESPONDENT' || this.id === 'SWIFT_BATCH') && ((day === 5 && hour >= 17) || day === 6 || day === 0)) {
      return {
        isCutOff: true,
        reason: 'Weekend Correspondent Banking Blackout Window (SWIFT Batches Closed)',
        extraLatencyHours: day === 5 ? (72 - (hour - 17)) : day === 6 ? 48 : 24,
        latePenaltyUSD: 10.00
      };
    }

    return { isCutOff: false, extraLatencyHours: 0, latePenaltyUSD: 0 };
  }

  validate(params) {
    const { amountUSD, corridorConfig } = params;
    if (amountUSD > this.config.maxAmountUSD) {
      return {
        valid: false,
        reason: `Amount $${amountUSD.toLocaleString()} exceeds maximum limit of $${this.config.maxAmountUSD.toLocaleString()} for ${this.name}`
      };
    }
    if (corridorConfig && corridorConfig.eligibleRails && !corridorConfig.eligibleRails.includes(this.id)) {
      return { valid: false, reason: `${this.name} is not eligible for this currency corridor` };
    }
    return { valid: true };
  }

  estimateCost(amountUSD, options = {}) {
    const feeDetails = calculateRailFee(amountUSD, this.config.baseFeeUSD, this.config.variableFeeBps);
    let total = feeDetails.totalFeeUSD;
    const cutOff = this.isCutOffActive(options.currentTime || new Date());
    if (cutOff.isCutOff) {
      total += cutOff.latePenaltyUSD;
    }
    return parseFloat(total.toFixed(2));
  }

  getFeeBreakdown(amountUSD, options = {}) {
    const feeDetails = calculateRailFee(amountUSD, this.config.baseFeeUSD, this.config.variableFeeBps);
    let total = feeDetails.totalFeeUSD;
    const cutOff = this.isCutOffActive(options.currentTime || new Date());
    if (cutOff.isCutOff) {
      total += cutOff.latePenaltyUSD;
    }
    return {
      fixedFeeUSD: feeDetails.fixedFeeUSD,
      variableFeeUSD: feeDetails.variableFeeUSD,
      totalFeeUSD: parseFloat(total.toFixed(2))
    };
  }

  estimateLatency(options = {}) {
    const cutOff = this.isCutOffActive(options.currentTime || new Date());
    if (cutOff.isCutOff) {
      return parseFloat((this.config.avgLatencyHours + cutOff.extraLatencyHours).toFixed(1));
    }
    return this.config.avgLatencyHours;
  }

  async executePayment(payment) {
    const amountUSD = payment.sourceAmountUSD || payment.sourceAmount || 1000;
    const feeObj = this.estimateCost(amountUSD);
    const latencyHours = this.estimateLatency();
    const cutOff = this.isCutOffActive();

    const clearingRef = `CLR-${this.id.substring(0, 4)}-${Math.floor(100000 + Math.random() * 900000)}`;
    const enrichedTx = { ...payment, clearingReference: clearingRef, selectedRail: this.id };

    const isoMessage = iso20022Engine.generatePacs008(enrichedTx);
    const statusReport = iso20022Engine.generatePacs002(enrichedTx, 'ACSC');

    return {
      success: true,
      executionStatus: 'SETTLED',
      railId: this.id,
      railName: this.name,
      clearingReference: clearingRef,
      railReference: clearingRef,
      expectedSettlementDisplay: this.config.expectedSettlementDisplay,
      expectedSettlementDuration: this.config.expectedSettlementDisplay,
      simulationDurationMs: this.config.simulationDurationMs || 1200,
      settledAt: new Date(Date.now() + Math.round(latencyHours * 3600 * 1000)),
      feeUSD: feeObj.totalFeeUSD,
      fixedFeeUSD: feeObj.fixedFeeUSD,
      variableFeeUSD: feeObj.variableFeeUSD,
      latencyHours,
      processingMetadata: {
        networkType: 'Simulated Clearing Network',
        railId: this.id,
        cutOffWarning: cutOff.isCutOff ? cutOff.reason : null,
        simulatedDelayMs: this.config.simulationDurationMs
      },
      iso20022: {
        pacs008: isoMessage,
        pacs002: statusReport
      }
    };
  }

  // Backwards-compatible alias
  async execute(payment) {
    return this.executePayment(payment);
  }
}

module.exports = BaseRailAdapter;
