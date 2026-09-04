const BaseRailAdapter = require('./railAdapter');
const RAIL_CONFIG = require('../config/railConfig');

class SwiftRail extends BaseRailAdapter {
  constructor() {
    super(RAIL_CONFIG.SWIFT_BATCH);
  }

  estimateLatency(options = {}) {
    const cutOff = this.isCutOffActive(options.currentTime || new Date());
    if (cutOff.isCutOff) {
      return parseFloat((this.config.avgLatencyHours + cutOff.extraLatencyHours).toFixed(1));
    }
    return this.config.avgLatencyHours;
  }

  estimateCost(amountUSD, options = {}) {
    let fee = this.config.baseFeeUSD + (amountUSD * this.config.variableFeePct);
    const cutOff = this.isCutOffActive(options.currentTime || new Date());
    if (cutOff.isCutOff) {
      // Add weekend cut-off delayed clearing surcharge
      fee += cutOff.latePenaltyUSD;
    }
    return parseFloat(fee.toFixed(2));
  }

  async execute(transactionData) {
    const res = await super.execute(transactionData);
    const cutOff = this.isCutOffActive();
    if (cutOff.isCutOff) {
      res.cutOffWarning = cutOff.reason;
      res.extraDelayedHours = cutOff.extraLatencyHours;
    }
    return res;
  }
}

module.exports = new SwiftRail();
