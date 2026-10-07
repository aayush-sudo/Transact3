const iso20022Engine = require('../utils/iso20022');
const { calculateRailFee } = require('../utils/mathUtils');
const RAIL_CONFIG = require('../config/railConfig');
const railPricingService = require('../services/railPricingService');

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
    const breakdown = this.getFeeBreakdown(amountUSD, options);
    return breakdown.totalFeeUSD;
  }

  getFeeBreakdown(amountUSD, options = {}) {
    return railPricingService.calculateFeeBreakdown(this.id, amountUSD, {
      ...options,
      currentTime: options.currentTime || new Date()
    });
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

  async execute(payment) {
    return this.executePayment(payment);
  }
}

// ====================================================================
// Concrete Rail Implementations
// ====================================================================

class SwiftRail extends BaseRailAdapter {
  constructor() {
    super(RAIL_CONFIG.SWIFT_CORRESPONDENT || RAIL_CONFIG.SWIFT_BATCH);
  }

  estimateLatency(options = {}) {
    const cutOff = this.isCutOffActive(options.currentTime || new Date());
    if (cutOff.isCutOff) {
      return parseFloat((this.config.avgLatencyHours + cutOff.extraLatencyHours).toFixed(1));
    }
    return this.config.avgLatencyHours;
  }


  async executePayment(transactionData) {
    const res = await super.executePayment(transactionData);
    const cutOff = this.isCutOffActive();
    if (cutOff.isCutOff) {
      res.cutOffWarning = cutOff.reason;
      res.extraDelayedHours = cutOff.extraLatencyHours;
    }
    return res;
  }
}

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
    super(RAIL_CONFIG.INSTANT_PAYMENT_LINK || RAIL_CONFIG.REGIONAL_INSTANT);
  }

  isCutOffActive() {
    return { isCutOff: false, extraLatencyHours: 0, latePenaltyUSD: 0 };
  }

  getClearingScheme(currency) {
    return SCHEME_MAP[currency ? currency.toUpperCase() : 'USD'] || 'Regional Real-Time Clearing';
  }

  async executePayment(transactionData) {
    const res = await super.executePayment(transactionData);
    const targetCurr = transactionData.destinationCurrency || transactionData.sourceCurrency || 'USD';
    res.clearingScheme = this.getClearingScheme(targetCurr);
    return res;
  }
}

class CardPushRail extends BaseRailAdapter {
  constructor() {
    super(RAIL_CONFIG.CARD_PAYOUT || RAIL_CONFIG.CARD_PUSH);
  }

  isCutOffActive() {
    return { isCutOff: false, extraLatencyHours: 0, latePenaltyUSD: 0 };
  }

  async executePayment(transactionData) {
    const res = await super.executePayment(transactionData);
    res.network = Math.random() > 0.5 ? 'Visa Direct (FastFunds OCT)' : 'Mastercard Send (Payment Transfer)';
    res.stan = Math.floor(100000 + Math.random() * 900000);
    return res;
  }
}

class RtgsRail extends BaseRailAdapter {
  constructor() {
    super(RAIL_CONFIG.RTGS_SETTLEMENT || RAIL_CONFIG.RTGS_INSTANT || {
      id: 'RTGS_SETTLEMENT',
      name: 'RTGS Central Bank Wire',
      description: 'Real-Time Gross Settlement high-value wire clearing network.',
      baseFeeUSD: 18.00,
      variableFeeBps: 5,
      variableFeePct: 0.0005,
      expectedSettlementDisplay: 'Approximately 15 minutes',
      avgLatencyHours: 0.25,
      simulationDurationMs: 1500,
      maxAmountUSD: 50000000,
      reliabilityScore: 0.999
    });
  }

  isRtgsWindowOpen(now = new Date()) {
    const day = now.getUTCDay();
    const hour = now.getUTCHours();

    if (day === 0 || day === 6) {
      const hoursUntilMonday = day === 6 ? (48 - hour + 8) : (24 - hour + 8);
      return { isOpen: false, reason: 'RTGS Central Bank Wire Closed (Weekend)', delayHours: hoursUntilMonday };
    }

    if (hour < 7 || hour >= 18) {
      const hoursUntilOpen = hour >= 18 ? (24 - hour + 7) : (7 - hour);
      return { isOpen: false, reason: 'RTGS Central Bank Wire Closed (After-Hours)', delayHours: hoursUntilOpen };
    }

    return { isOpen: true, delayHours: 0 };
  }

  estimateLatency(options = {}) {
    const window = this.isRtgsWindowOpen(options.currentTime || new Date());
    if (!window.isOpen) {
      return parseFloat((this.config.avgLatencyHours + window.delayHours).toFixed(2));
    }
    return this.config.avgLatencyHours;
  }
}

// Singletons
const swiftRail = new SwiftRail();
const instantRail = new InstantRail();
const cardPushRail = new CardPushRail();
const rtgsRail = new RtgsRail();

const RAIL_MAP = {
  INSTANT_PAYMENT_LINK: instantRail,
  REGIONAL_INSTANT: instantRail,
  CARD_PAYOUT: cardPushRail,
  CARD_PUSH: cardPushRail,
  SWIFT_CORRESPONDENT: swiftRail,
  SWIFT_BATCH: swiftRail,
  RTGS_SETTLEMENT: rtgsRail,
  RTGS_INSTANT: rtgsRail
};

module.exports = {
  BaseRailAdapter,
  SwiftRail,
  InstantRail,
  CardPushRail,
  RtgsRail,
  swiftRail,
  instantRail,
  cardPushRail,
  rtgsRail,
  RAIL_MAP
};
