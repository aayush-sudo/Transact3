/**
 * Common Rail Adapter Interface
 */
class BaseRailAdapter {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.config = config;
  }

  validate(params) {
    const { amountUSD, corridorConfig } = params;
    if (amountUSD > this.config.maxAmountUSD) {
      return { valid: false, reason: `Amount $${amountUSD.toLocaleString()} exceeds maximum limit of $${this.config.maxAmountUSD.toLocaleString()} for ${this.name}` };
    }
    if (corridorConfig && corridorConfig.eligibleRails && !corridorConfig.eligibleRails.includes(this.id)) {
      return { valid: false, reason: `${this.name} is not eligible for this currency corridor` };
    }
    return { valid: true };
  }

  estimateCost(amountUSD) {
    const fee = this.config.baseFeeUSD + (amountUSD * this.config.variableFeePct);
    return parseFloat(fee.toFixed(2));
  }

  estimateLatency() {
    return this.config.avgLatencyHours;
  }

  checkLiquidity(amountUSD, railUtilizationPct) {
    if (railUtilizationPct >= 99) {
      return { available: false, capacityPct: railUtilizationPct, reason: 'Rail capacity exhausted (>99%)' };
    }
    return { available: true, capacityPct: railUtilizationPct };
  }

  async authorize(transactionData) {
    return { authorized: true, authorizationCode: `AUTH-${this.id}-${Date.now().toString(36).toUpperCase()}` };
  }

  async execute(transactionData) {
    const cost = this.estimateCost(transactionData.sourceAmountUSD || transactionData.sourceAmount);
    const latency = this.estimateLatency();
    return {
      success: true,
      railId: this.id,
      railName: this.name,
      clearingReference: `CLR-${this.id.substring(0, 4)}-${Math.floor(100000 + Math.random() * 900000)}`,
      settledAt: new Date(Date.now() + Math.round(latency * 3600 * 1000)),
      feeUSD: cost,
      latencyHours: latency
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
