const BaseRailAdapter = require('./railAdapter');
const RAIL_CONFIG = require('../config/railConfig');

class CardPushRail extends BaseRailAdapter {
  constructor() {
    super(RAIL_CONFIG.CARD_PUSH);
  }

  isCutOffActive() {
    return { isCutOff: false, extraLatencyHours: 0, latePenaltyUSD: 0 };
  }

  async execute(transactionData) {
    const res = await super.execute(transactionData);
    res.network = Math.random() > 0.5 ? 'Visa Direct (FastFunds OCT)' : 'Mastercard Send (Payment Transfer)';
    res.stan = Math.floor(100000 + Math.random() * 900000); // System Trace Audit Number
    return res;
  }
}

module.exports = new CardPushRail();
