const BaseRailAdapter = require('./railAdapter');
const RAIL_CONFIG = require('../config/railConfig');

class NettingRail extends BaseRailAdapter {
  constructor() {
    super(RAIL_CONFIG.NETTING_LEDGER);
  }

  isCutOffActive() {
    return { isCutOff: false, extraLatencyHours: 0, latePenaltyUSD: 0 };
  }

  validate(params) {
    const baseValid = super.validate(params);
    if (!baseValid.valid) return baseValid;

    // Netting is optimal for intra-company book transfers
    return { valid: true };
  }

  async execute(transactionData) {
    const res = await super.execute(transactionData);
    res.nettingMethod = 'Bilateral Multilateral Book-Transfer Clearing';
    res.intercompanyBookReference = `BOOK-${Date.now().toString(36).toUpperCase()}`;
    return res;
  }
}

module.exports = new NettingRail();
