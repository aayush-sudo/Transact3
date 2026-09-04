const BaseRailAdapter = require('./railAdapter');
const RAIL_CONFIG = require('../config/railConfig');

const SCHEME_MAP = {
  USD: 'FedNow / RTP (US)',
  EUR: 'SEPA Instant Credit Transfer (EU)',
  GBP: 'Faster Payments Service (UK)',
  INR: 'UPI / IMPS Immediate Payment Service (IN)',
  BRL: 'Pix Instant Payment (BR)',
  SGD: 'PayNow Fast & Secure (SG)',
  MXN: 'SPEI Real-Time Interbank (MX)',
  JPY: 'Zengin Instant System (JP)',
  CAD: 'Interac e-Transfer Real-Time (CA)',
  AUD: 'New Payments Platform NPP (AU)'
};

class InstantRail extends BaseRailAdapter {
  constructor() {
    super(RAIL_CONFIG.REGIONAL_INSTANT);
  }

  isCutOffActive() {
    return { isCutOff: false, extraLatencyHours: 0, latePenaltyUSD: 0 };
  }

  getClearingScheme(currency) {
    return SCHEME_MAP[currency ? currency.toUpperCase() : 'USD'] || 'Regional Real-Time Clearing';
  }

  async execute(transactionData) {
    const res = await super.execute(transactionData);
    const targetCurr = transactionData.destinationCurrency || transactionData.sourceCurrency || 'USD';
    res.clearingScheme = this.getClearingScheme(targetCurr);
    return res;
  }
}

module.exports = new InstantRail();
