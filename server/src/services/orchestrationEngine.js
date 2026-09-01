const swiftRail = require('../rails/swiftRail');
const rtgsRail = require('../rails/rtgsRail');
const instantRail = require('../rails/instantRail');
const stablecoinRail = require('../rails/stablecoinRail');
const nettingRail = require('../rails/nettingRail');
const cardPushRail = require('../rails/cardPushRail');

const fxRateEngine = require('./fxRateEngine');
const fxTimingEngine = require('./fxTimingEngine');
const liquidityManager = require('./liquidityManager');
const riskEngine = require('./riskEngine');
const currencyEngine = require('./currencyEngine');
const { getCorridorConfig } = require('../config/corridors');

const ALL_RAIL_ADAPTERS = [
  swiftRail,
  rtgsRail,
  instantRail,
  stablecoinRail,
  nettingRail,
  cardPushRail
];

class MultiRailOrchestrationEngine {
  async routePayment(params) {
    const {
      sourceCurrency = 'USD',
      destinationCurrency = 'EUR',
      amount = 10000,
      priority = 'BALANCED',
      isNewBeneficiary = false,
      maxPermittedDelayHours = 24
    } = params;

    // 1. Validate Currencies & Amount
    const valResult = currencyEngine.validateCurrencies(sourceCurrency, destinationCurrency);
    if (!valResult.valid) {
      throw new Error(valResult.message);
    }

    const corridorConfig = valResult.corridorConfig;

    // 2. Compute FX Rate Quote & Spread
    const fxQuote = await fxRateEngine.calculateFXQuoteAsync(sourceCurrency, destinationCurrency, amount);

    // 3. Compute FX Timing Advice
    const fxTiming = await fxTimingEngine.evaluateTiming(sourceCurrency, destinationCurrency, priority, maxPermittedDelayHours);

    // 4. Compute Risk Score
    const sourceAmountUSD = fxQuote.fxCostUSD / ((fxQuote.spreadBps || 35) / 10000);
    const riskResult = riskEngine.calculateRiskScore({
      amountUSD: sourceAmountUSD || amount,
      sourceCurrency,
      destinationCurrency,
      isNewBeneficiary
    });

    // 5. Weights allocation based on Priority Profile
    let wCost = 0.40;
    let wSpeed = 0.40;
    let wReliability = 0.20;

    if (priority === 'COST') {
      wCost = 0.70;
      wSpeed = 0.10;
      wReliability = 0.20;
    } else if (priority === 'SPEED') {
      wCost = 0.10;
      wSpeed = 0.70;
      wReliability = 0.20;
    }

    // 6. Evaluate all 6 Rails
    const evaluatedRails = [];

    for (const rail of ALL_RAIL_ADAPTERS) {
      const validation = rail.validate({ amountUSD: sourceAmountUSD || amount, corridorConfig });
      if (!validation.valid) {
        continue; // Skip ineligible rails for this corridor/amount
      }

      const railFeeUSD = rail.estimateCost(sourceAmountUSD || amount);
      const estLatencyHours = rail.estimateLatency();

      const liquidityInfo = liquidityManager.getRailLiquidity(rail.id);
      const liquidityPenalty = liquidityManager.calculateDynamicPenalty(rail.id, sourceAmountUSD || amount);

      const totalCostUSD = parseFloat((fxQuote.fxCostUSD + railFeeUSD).toFixed(2));

      // Normalization scaling (Cost normalized over $100 baseline, Latency over 48 hours)
      const normCost = totalCostUSD / 100;
      const normSpeed = estLatencyHours / 48;
      const normRisk = riskResult.score / 100;
      const reliabilityBonus = rail.config.reliabilityScore;

      // Utility score (Higher score = Better rail match)
      const utilityScore = (reliabilityBonus * wReliability) - (wCost * normCost + wSpeed * normSpeed + 0.1 * normRisk + liquidityPenalty);

      evaluatedRails.push({
        id: rail.id,
        name: rail.name,
        description: rail.config.description,
        icon: rail.config.icon,
        estFeeUSD: railFeeUSD,
        estLatencyHours,
        totalCostUSD,
        reliabilityScore: rail.config.reliabilityScore,
        liquidityUtilPct: liquidityInfo.utilizationPct,
        liquidityPenalty,
        utilityScore: parseFloat(utilityScore.toFixed(4)),
        status: liquidityInfo.status
      });
    }

    // Sort by Utility Score descending
    evaluatedRails.sort((a, b) => b.utilityScore - a.utilityScore);

    if (evaluatedRails.length === 0) {
      throw new Error('No eligible settlement rails available for this amount and corridor');
    }

    const recommendedRail = evaluatedRails[0];
    const fallbackRails = evaluatedRails.slice(1);

    // AI Savings Calculation vs SWIFT baseline
    const swiftRailResult = evaluatedRails.find(r => r.id === 'SWIFT_BATCH') || evaluatedRails[evaluatedRails.length - 1];
    const aiSavingsUSD = Math.max(0, parseFloat((swiftRailResult.totalCostUSD - recommendedRail.totalCostUSD).toFixed(2)));

    return {
      sourceCurrency: sourceCurrency.toUpperCase(),
      destinationCurrency: destinationCurrency.toUpperCase(),
      sourceAmount: amount,
      destinationAmount: fxQuote.destinationAmount,
      referenceRate: fxQuote.referenceRate,
      quotedRate: fxQuote.quotedRate,
      spreadBps: fxQuote.spreadBps,
      fxCostUSD: fxQuote.fxCostUSD,
      fxTiming,
      riskScore: riskResult.score,
      riskLevel: riskResult.riskLevel,
      requiresManualReview: riskResult.requiresManualReview,
      priorityProfile: priority,
      recommendedRail,
      fallbackRails,
      evaluatedRails,
      aiSavingsUSD,
      explanation: `Selected ${recommendedRail.name} under ${priority} policy: Jointly optimizes total cost ($${recommendedRail.totalCostUSD}), speed (${recommendedRail.estLatencyHours}h), and liquidity capacity.`
    };
  }
}

module.exports = new MultiRailOrchestrationEngine();
