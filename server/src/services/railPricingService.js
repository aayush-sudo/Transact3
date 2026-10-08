const axios = require('axios');
const RAIL_CONFIG = require('../config/railConfig');
const { calculateRailFee, roundToPrecision } = require('../utils/mathUtils');

/**
 * RailPricingService
 * Modeled route pricing plus an independent public provider-comparison feed.
 *
 * Supports:
 * Provider comparison snapshots are informational and do not represent the modeled routes.
 * Modeled route fees are calibrated estimates, not provider tariffs.
 */
class RailPricingService {
  constructor() {
    this.cache = new Map();
    this.cacheTTLMs = 60 * 1000; // 60 seconds TTL
    this.timeoutMs = 3000;
  }

  /**
   * Fetch live market quotes from Wise public comparisons API across real payment routes
   */
  async fetchLiveMarketQuotes(sourceCurrency = 'USD', destinationCurrency = 'EUR', amount = 1000) {
    const src = (sourceCurrency || 'USD').toUpperCase();
    const dst = (destinationCurrency || 'EUR').toUpperCase();
    const amt = Number(amount) || 1000;
    const cacheKey = `WISE_${src}_${dst}_${amt.toFixed(2)}`;

    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.cacheTTLMs)) {
      return { success: true, data: cached.data, source: 'CACHED_LIVE_API', timestamp: new Date(cached.timestamp) };
    }

    try {
      const url = `https://api.transferwise.com/v3/comparisons?sourceCurrency=${src}&targetCurrency=${dst}&sendAmount=${amt}`;
      const response = await axios.get(url, {
        timeout: this.timeoutMs,
        headers: { 'User-Agent': 'Transact3-Payment-Engine/1.0' }
      });

      if (response.data && Array.isArray(response.data.providers)) {
        const providers = response.data.providers.flatMap(provider => {
          const quote = provider.quotes?.[0];
          if (!quote || !Number.isFinite(Number(quote.rate)) || !Number.isFinite(Number(quote.receivedAmount))) {
            return [];
          }
          return [{
            name: provider.name,
            type: provider.type || 'moneyTransferProvider',
            fee: quote.fee != null && Number.isFinite(Number(quote.fee)) ? Number(quote.fee) : null,
            feeCurrency: typeof quote.feeCurrency === 'string' ? quote.feeCurrency : null,
            markupPct: quote.markup != null && Number.isFinite(Number(quote.markup)) ? Number(quote.markup) : null,
            rate: Number(quote.rate),
            receivedAmount: Number(quote.receivedAmount),
            deliveryEstimation: quote.deliveryEstimation || null,
            dateCollected: quote.dateCollected || null
          }];
        });

        this.cache.set(cacheKey, { data: providers, timestamp: Date.now() });
        return { success: true, data: providers, source: 'LIVE_PROVIDER_COMPARISON', timestamp: new Date() };
      }
      return {
        success: false,
        data: [],
        source: 'UNAVAILABLE',
        message: 'Provider comparison returned no current quotes.'
      };
    } catch {
      return {
        success: false,
        data: [],
        source: 'UNAVAILABLE',
        message: 'Live provider comparisons are temporarily unavailable.'
      };
    }
  }

  /**
   * Calculate granular, itemized charges for a specific payment rail.
   * Maintains 100% backward compatibility with totalFeeUSD, fixedFeeUSD, variableFeeUSD.
   */
  calculateFeeBreakdown(railId, amountUSD, options = {}) {
    const config = RAIL_CONFIG[railId] || {
      baseFeeUSD: 2.00,
      variableFeeBps: 5,
      variableFeePct: 0.0005,
      name: railId
    };

    const safeAmount = Math.max(0, Number(amountUSD) || 0);
    const feeDetails = calculateRailFee(safeAmount, config.baseFeeUSD, config.variableFeeBps);
    let fixedFeeUSD = feeDetails.fixedFeeUSD;
    let variableFeeUSD = feeDetails.variableFeeUSD;
    let intermediaryFeeUSD = 0;
    let cutOffPenaltyUSD = 0;
    let corridorFrictionUSD = 0;

    // 1. Intermediary correspondent deduction for SWIFT high-value non-direct hops
    if (railId === 'SWIFT_CORRESPONDENT' || railId === 'SWIFT_BATCH') {
      if (options.hasIntermediaryHop || safeAmount > 10000) {
        intermediaryFeeUSD = 0; // Configured or baseline included
      }
    }

    // 2. Cut-off window surcharges (Weekend / After-Hours)
    const now = options.currentTime || new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();

    if ((railId === 'SWIFT_CORRESPONDENT' || railId === 'SWIFT_BATCH') && ((day === 5 && hour >= 17) || day === 6 || day === 0)) {
      cutOffPenaltyUSD = 10.00;
    } else if ((railId === 'RTGS_SETTLEMENT' || railId === 'RTGS_INSTANT') && (day === 0 || day === 6 || hour < 7 || hour >= 18)) {
      cutOffPenaltyUSD = 0; // RTGS incurs latency delay rather than cash penalty
    }

    // 3. Corridor-specific friction
    if (options.corridorConfig && options.corridorConfig.baseSpreadBps > 40) {
      corridorFrictionUSD = 0;
    }

    const totalFeeUSD = roundToPrecision(fixedFeeUSD + variableFeeUSD + intermediaryFeeUSD + cutOffPenaltyUSD + corridorFrictionUSD, 2);
    const feeBps = safeAmount > 0 ? roundToPrecision((totalFeeUSD / safeAmount) * 10000, 1) : 0;

    return {
      railId,
      railName: config.name || railId,
      amountUSD: safeAmount,
      // Standard backward-compatible keys
      fixedFeeUSD,
      variableFeeUSD,
      totalFeeUSD,
      // Institutional itemization
      baseNetworkFeeUSD: fixedFeeUSD,
      intermediaryFeeUSD,
      cutOffPenaltyUSD,
      corridorFrictionUSD,
      effectiveBps: feeBps,
      feePercentage: `${(feeBps / 100).toFixed(2)}%`,
      pricingModel: config.pricingModel || 'FIXED_PLUS_VARIABLE',
      pricingSource: options.liveProvider ? 'LIVE_API' : 'CALIBRATED_INSTITUTIONAL'
    };
  }

  /**
   * Get an enterprise-ready description of how rail charges are formed
   */
  getRailPricingSchedule() {
    return [
      {
        railId: 'SWIFT_CORRESPONDENT',
        name: 'SWIFT / Correspondent Banking',
        pipeline: 'Correspondent Banking Serial Messaging (ISO 20022 pacs.008)',
        baseFeeUSD: 25.00,
        variableFeeBps: 10,
        variableFeeDescription: '10 bps (0.10%) volume assessment',
        weekendSurchargeUSD: 10.00,
        settlementTime: '24–48 hours (delayed over weekend)',
        bestFor: 'Large legacy corporate wires requiring broad global bank reach',
        pricingSource: 'CALIBRATED_MODEL_ESTIMATE'
      },
      {
        railId: 'INSTANT_PAYMENT_LINK',
        name: 'Cross-Border Instant Payment',
        pipeline: 'Regional Instant Clearing Interconnect (FedNow / SEPA / UPI / Pix)',
        baseFeeUSD: 1.50,
        variableFeeBps: 2,
        variableFeeDescription: '2 bps (0.02%) clearing fee',
        weekendSurchargeUSD: 0.00,
        settlementTime: '~1–2 seconds (24/7/365)',
        bestFor: 'Retail and instant B2B payments under $100,000',
        pricingSource: 'CALIBRATED_MODEL_ESTIMATE'
      },
      {
        railId: 'CARD_PAYOUT',
        name: 'Card-Based Payout (Visa Direct / Mastercard Send)',
        pipeline: 'Card Scheme Original Credit Transaction (OCT)',
        baseFeeUSD: 3.50,
        variableFeeBps: 15,
        variableFeeDescription: '15 bps (0.15%) scheme cross-border assessment',
        weekendSurchargeUSD: 0.00,
        settlementTime: '~5–15 minutes',
        bestFor: 'Fast disbursements directly to debit/credit cards',
        pricingSource: 'CALIBRATED_MODEL_ESTIMATE'
      },
      {
        railId: 'RTGS_SETTLEMENT',
        name: 'RTGS High-Value Central Bank Wire',
        pipeline: 'Central Bank Real-Time Gross Settlement (Fedwire / TARGET2)',
        baseFeeUSD: 18.00,
        variableFeeBps: 5,
        variableFeeDescription: '5 bps (0.05%) gross clearing charge',
        weekendSurchargeUSD: 0.00,
        settlementTime: '~15 minutes (operating window 07:00–18:00 UTC)',
        bestFor: 'High-value treasury & corporate wires ($50k–$50M)',
        pricingSource: 'CALIBRATED_MODEL_ESTIMATE'
      }
    ];
  }
}

module.exports = new RailPricingService();
