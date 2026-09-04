const iso20022Engine = require('../utils/iso20022');

/**
 * Enhanced Base Rail Adapter with Dynamic Cut-Offs & ISO 20022 Generation
 */
class BaseRailAdapter {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.config = config;
  }

  /**
   * Check if current time falls into a cut-off window (e.g. Friday 17:00 UTC to Sunday midnight)
   */
  isCutOffActive(now = new Date()) {
    const day = now.getUTCDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
    const hour = now.getUTCHours();

    // Friday after 17:00 UTC or Saturday or Sunday
    if ((day === 5 && hour >= 17) || day === 6 || day === 0) {
      return {
        isCutOff: true,
        reason: 'Weekend Banking Blackout Window (Fedwire/TARGET2/SWIFT Batches Closed)',
        extraLatencyHours: day === 5 ? (72 - (hour - 17)) : day === 6 ? 48 : 24,
        latePenaltyUSD: 25.00
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
    let fee = this.config.baseFeeUSD + (amountUSD * this.config.variableFeePct);
    return parseFloat(fee.toFixed(2));
  }

  estimateLatency(options = {}) {
    return this.config.avgLatencyHours;
  }

  checkLiquidity(amountUSD, railUtilizationPct) {
    if (railUtilizationPct >= 99) {
      return { available: false, capacityPct: railUtilizationPct, reason: 'Rail capacity exhausted (>99%)' };
    }
    return { available: true, capacityPct: railUtilizationPct };
  }

  async authorize(transactionData) {
    return {
      authorized: true,
      authorizationCode: `AUTH-${this.id}-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date()
    };
  }

  async execute(transactionData) {
    const amountUSD = transactionData.sourceAmountUSD || transactionData.sourceAmount || 1000;
    const cost = this.estimateCost(amountUSD);
    const latency = this.estimateLatency();

    const clearingRef = `CLR-${this.id.substring(0, 4)}-${Math.floor(100000 + Math.random() * 900000)}`;
    const enrichedTx = { ...transactionData, clearingReference: clearingRef, selectedRail: this.id };

    const isoMessage = iso20022Engine.generatePacs008(enrichedTx);
    const statusReport = iso20022Engine.generatePacs002(enrichedTx, 'ACSC');

    return {
      success: true,
      railId: this.id,
      railName: this.name,
      clearingReference: clearingRef,
      settledAt: new Date(Date.now() + Math.round(latency * 3600 * 1000)),
      feeUSD: cost,
      latencyHours: latency,
      iso20022: {
        pacs008: isoMessage,
        pacs002: statusReport
      }
    };
  }

  getStatus() {
    return {
      id: this.id,
      name: this.name,
      reliabilityScore: this.config.reliabilityScore,
      maxAmountUSD: this.config.maxAmountUSD
    };
  }

  handleFailure(error) {
    return {
      recovered: false,
      railId: this.id,
      error: error.message || 'Settlement failed on rail'
    };
  }
}

module.exports = BaseRailAdapter;
