const { swiftRail, instantRail, cardPushRail } = require('../rails');

const liquidityManager = require('./liquidityManager');
const fxAnalysisEngine = require('./fxAnalysisEngine');
const fxForecastingEngine = require('./fxForecastingEngine');
const fastApiClient = require('./fastapiClient');
const fxRateEngine = require('./fxRateEngine');
const { getExchangeRates } = require('./currencyService');
const { isCurrencySupported } = require('../config/currencies');
const { getCorridorConfig } = require('../config/corridors');
const { getInstantEligibility, getSettlementPlan } = require('./settlementPolicy');
const { roundToPrecision, safeAdd, safeDivide, safeMultiply } = require('../utils/mathUtils');

const ALL_RAIL_ADAPTERS = [
  instantRail,
  cardPushRail,
  swiftRail
];

const PREFERENCE_WEIGHTS = {
  BALANCED: { cost: 0.35, speed: 0.30, reliability: 0.20, risk: 0.10, liquidity: 0.05 },
  CHEAPEST: { cost: 0.70, speed: 0.10, reliability: 0.15, risk: 0.05, liquidity: 0.00 },
  FASTEST:  { cost: 0.10, speed: 0.70, reliability: 0.15, risk: 0.05, liquidity: 0.00 }
};

class MultiRailOrchestrationEngine {
  async routePayment(params) {
    const {
      sourceCurrency = 'USD',
      destinationCurrency = 'EUR',
      amount = 1000,
      paymentMode = 'SEND_AMOUNT', // 'SEND_AMOUNT' or 'RECIPIENT_GETS'
      priority = 'BALANCED',       // 'BALANCED', 'CHEAPEST', 'FASTEST'
    } = params;

    const srcCurr = (sourceCurrency || 'USD').toUpperCase();
    const destCurr = (destinationCurrency || 'EUR').toUpperCase();
    const numAmount = Math.max(0.01, Number(amount) || 1000);

    // 1. Currency Support Validation
    if (!isCurrencySupported(srcCurr)) {
      throw new Error(`Unsupported source currency: ${srcCurr}`);
    }
    if (!isCurrencySupported(destCurr)) {
      throw new Error(`Unsupported destination currency: ${destCurr}`);
    }

    const corridorConfig = getCorridorConfig(srcCurr, destCurr);

    // 2. FX Analysis & Current Exchange Rate
    const fxAnalysis = await fxAnalysisEngine.analyzePair(srcCurr, destCurr);
    const timingRecommendation = await fxForecastingEngine.evaluateTiming(
      srcCurr,
      destCurr,
      priority === 'FASTEST' ? 'SPEED' : priority,
      24
    );
    const fxRate = fxAnalysis.currentRate;

    // Rates to USD for liquidity & fee normalization
    const usdRatesData = await getExchangeRates('USD');
    const usdRates = usdRatesData.conversion_rates || {};
    const srcVsUSD = usdRates[srcCurr] || 1.0;

    // 3. Establish amount and instant-rail feasibility before scoring routes.
    let sourceAmount = numAmount;
    let destinationAmount = numAmount;

    if (srcCurr === destCurr) {
      sourceAmount = numAmount;
      destinationAmount = numAmount;
    } else if (paymentMode === 'RECIPIENT_GETS') {
      destinationAmount = numAmount;
      sourceAmount = roundToPrecision(numAmount / fxRate, 2);
    }

    let sourceAmountUSD = roundToPrecision(sourceAmount / srcVsUSD, 2);

    // 4. Evaluate all supported rails without skipping
    const railCandidatesForFastAPI = [];
    const evaluatedRails = [];

    const pref = PREFERENCE_WEIGHTS[priority] ? priority : 'BALANCED';
    const weights = PREFERENCE_WEIGHTS[pref];

    for (const rail of ALL_RAIL_ADAPTERS) {
      let routeSourceAmount = sourceAmount;
      let routeSourceAmountUSD = sourceAmountUSD;
      let routePricing = await fxRateEngine.calculateFXQuoteAsync(srcCurr, destCurr, routeSourceAmount, {
        referenceRate: fxRate,
        sourceAmountUSD: routeSourceAmountUSD,
        settlementRail: rail.id
      });
      if (paymentMode === 'RECIPIENT_GETS' && srcCurr !== destCurr) {
        routeSourceAmount = roundToPrecision(numAmount / routePricing.quotedRate, 2);
        routeSourceAmountUSD = roundToPrecision(routeSourceAmount / srcVsUSD, 2);
        routePricing = await fxRateEngine.calculateFXQuoteAsync(srcCurr, destCurr, routeSourceAmount, {
          referenceRate: fxRate,
          sourceAmountUSD: routeSourceAmountUSD,
          settlementRail: rail.id
        });
      }
      const routeDestinationAmount = paymentMode === 'RECIPIENT_GETS'
        ? numAmount
        : routePricing.destinationAmount;
      const railInstantEligibility = getInstantEligibility(srcCurr, destCurr, routeSourceAmountUSD);
      const standardBankingRequired = !railInstantEligibility.eligible;
      const eligibility = await liquidityManager.checkRailEligibility(rail.id, routeSourceAmountUSD, corridorConfig);
      const feeDetails = rail.getFeeBreakdown(routeSourceAmountUSD);
      const settlementPlan = getSettlementPlan(srcCurr, destCurr, routeSourceAmountUSD, rail.id);
      const forcedStandardRejection = standardBankingRequired && rail.id !== 'SWIFT_CORRESPONDENT'
        ? railInstantEligibility.reason || 'Standard banking settlement is required for this corridor and amount.'
        : null;
      const localClearingUnavailable = rail.id === 'INSTANT_PAYMENT_LINK' && !railInstantEligibility.eligible
        ? railInstantEligibility.reason
        : null;
      const rejectionReason = forcedStandardRejection || localClearingUnavailable || eligibility.rejectionReason;
      const isEligible = eligibility.isEligible && !rejectionReason;
      const estLatencyHours = settlementPlan.maximumSettlementHours || rail.estimateLatency();

      const candidate = {
        id: rail.id,
        name: rail.name,
        description: rail.config.description,
        icon: rail.config.icon,
        base_fee_usd: rail.config.baseFeeUSD,
        variable_fee_bps: rail.config.variableFeeBps,
        est_fee_usd: feeDetails.totalFeeUSD,
        pricing_source: feeDetails.pricingSource,
        fixed_fee_usd: feeDetails.fixedFeeUSD,
        variable_fee_usd: feeDetails.variableFeeUSD,
        est_latency_hours: estLatencyHours,
        expected_settlement_display: settlementPlan.settlementWindow || rail.config.expectedSettlementDisplay,
        minimum_settlement_hours: settlementPlan.minimumSettlementHours,
        maximum_settlement_hours: settlementPlan.maximumSettlementHours,
        applied_clearing_rail: settlementPlan.appliedClearingRail,
        is_instant: settlementPlan.is_instant,
        instant_feasibility: settlementPlan.instantFeasibility,
        instant_ineligibility_reason: settlementPlan.instantIneligibilityReason,
        earliest_settlement_at: settlementPlan.earliestSettlementAt,
        latest_settlement_at: settlementPlan.latestSettlementAt,
        simulation_duration_ms: rail.config.simulationDurationMs || 1200,
        reliability_score: rail.config.reliabilityScore,
        available_liquidity_usd: eligibility.setting ? eligibility.setting.availableLiquidityUSD : 1000000,
        is_eligible: isEligible,
        rejection_reason: isEligible ? null : rejectionReason,
        source_amount: routeSourceAmount,
        source_amount_usd: routeSourceAmountUSD,
        destination_amount: routeDestinationAmount,
        quoted_rate: routePricing.quotedRate,
        spread_bps: routePricing.spreadBps,
        fx_cost_usd: routePricing.fxCostUSD,
        final_net_payout: routeDestinationAmount
      };

      railCandidatesForFastAPI.push(candidate);
    }

    // 5. Try calling FastAPI for advanced quantitative intelligence
    let scoringResult = null;
    try {
      const fastApiRes = await fastApiClient.analyzeRoute({
        source_currency: srcCurr,
        destination_currency: destCurr,
        amount: sourceAmountUSD,
        preference: pref,
        rails: railCandidatesForFastAPI
      });

      if (fastApiRes.success && fastApiRes.data && fastApiRes.data.evaluated_rails) {
        scoringResult = fastApiRes.data;
      }
    } catch (e) {
      // Fallback
    }

    // 6. Deterministic Fallback Scoring in Express if FastAPI is offline
    if (!scoringResult) {
      const maxFee = Math.max(...railCandidatesForFastAPI.map(c => c.est_fee_usd), 30.0);
      const maxLatency = Math.max(...railCandidatesForFastAPI.map(c => c.est_latency_hours), 36.0);

      const scored = railCandidatesForFastAPI.map(c => {
        if (!c.is_eligible) {
          return {
            id: c.id,
            name: c.name,
            description: c.description,
            icon: c.icon,
            is_eligible: false,
            rejection_reason: c.rejection_reason || 'Operational limit or corridor restriction',
            est_fee_usd: c.est_fee_usd,
            fixed_fee_usd: c.fixed_fee_usd,
            variable_fee_usd: c.variable_fee_usd,
            est_latency_hours: c.est_latency_hours,
            expected_settlement_display: c.expected_settlement_display,
            simulation_duration_ms: c.simulation_duration_ms,
            reliability_score: c.reliability_score,
            norm_cost: 0.0,
            norm_speed: 0.0,
            norm_reliability: c.reliability_score,
            liquidity_penalty: 10.0,
            deterministic_score: -1.0,
            ml_adjustment: 0.0,
            final_score: -1.0
          };
        }

        const normCost = Math.max(0.0, Math.min(1.0, 1.0 - (c.est_fee_usd / maxFee)));
        const normSpeed = Math.max(0.0, Math.min(1.0, 1.0 - (c.est_latency_hours / maxLatency)));
        const normReliability = Math.max(0.0, Math.min(1.0, c.reliability_score));
        const normRisk = normReliability;
        const reqLiq = Math.max(1.0, sourceAmountUSD * 2.0);
        const normLiquidity = Math.max(0.0, Math.min(1.0, c.available_liquidity_usd / reqLiq));
        const penalty = c.available_liquidity_usd < sourceAmountUSD * 1.5 ? 0.15 : 0.0;

        const score = (weights.cost * normCost) + 
                      (weights.speed * normSpeed) + 
                      (weights.reliability * normReliability) +
                      ((weights.risk || 0.0) * normRisk) +
                      ((weights.liquidity || 0.0) * normLiquidity) - 
                      penalty;
        const finalScore = roundToPrecision(Math.max(0.0, Math.min(1.0, score)), 4);

        return {
          id: c.id,
          name: c.name,
          description: c.description,
          icon: c.icon,
          is_eligible: true,
          rejection_reason: null,
          est_fee_usd: c.est_fee_usd,
          fixed_fee_usd: c.fixed_fee_usd,
          variable_fee_usd: c.variable_fee_usd,
          est_latency_hours: c.est_latency_hours,
          expected_settlement_display: c.expected_settlement_display,
          simulation_duration_ms: c.simulation_duration_ms,
          reliability_score: c.reliability_score,
          norm_cost: roundToPrecision(normCost, 4),
          norm_speed: roundToPrecision(normSpeed, 4),
          norm_reliability: roundToPrecision(normReliability, 4),
          liquidity_penalty: penalty,
          deterministic_score: finalScore,
          ml_adjustment: 0.0,
          final_score: finalScore
        };
      });

      const eligible = scored.filter(r => r.is_eligible).sort((a, b) => b.final_score - a.final_score);
      const ineligible = scored.filter(r => !r.is_eligible);
      const combined = [...eligible, ...ineligible];

      const recommended = eligible[0] || null;
      let explanation = "";
      if (recommended) {
        explanation = `Selected ${recommended.name} under '${pref}' routing policy (Final Utility Score: ${recommended.final_score.toFixed(2)}) • Cost: $${recommended.est_fee_usd.toFixed(2)} (Weight: ${Math.round(weights.cost * 100)}%) • Speed: ${recommended.expected_settlement_display} (Weight: ${Math.round(weights.speed * 100)}%) • SLA Reliability: ${Math.round(recommended.reliability_score * 100)}%.`;
      } else {
        explanation = "No payment rail met operational and liquidity constraints.";
      }

      scoringResult = {
        preference: pref,
        evaluated_rails: combined,
        recommended_rail: recommended,
        explanation
      };
    }

    // Merge candidates descriptions and icons if from FastAPI
    const finalEvaluatedRails = scoringResult.evaluated_rails.map(rail => {
      const match = railCandidatesForFastAPI.find(c => c.id === rail.id);
      return {
        ...rail,
        description: match ? match.description : '',
        icon: match ? match.icon : 'Zap',
        fixed_fee_usd: match ? match.fixed_fee_usd : 0,
        variable_fee_usd: match ? match.variable_fee_usd : 0,
        expected_settlement_display: match ? match.expected_settlement_display : rail.expected_settlement_display,
        minimum_settlement_hours: match ? match.minimum_settlement_hours : rail.est_latency_hours,
        maximum_settlement_hours: match ? match.maximum_settlement_hours : rail.est_latency_hours,
        applied_clearing_rail: match ? match.applied_clearing_rail : rail.name,
        is_instant: match ? match.is_instant : false,
        instant_feasibility: match ? match.instant_feasibility : 'Ineligible',
        instant_ineligibility_reason: match ? match.instant_ineligibility_reason : null,
        earliest_settlement_at: match ? match.earliest_settlement_at : null,
        latest_settlement_at: match ? match.latest_settlement_at : null,
        source_amount: match ? match.source_amount : sourceAmount,
        source_amount_usd: match ? match.source_amount_usd : sourceAmountUSD,
        destination_amount: match ? match.destination_amount : destinationAmount,
        quoted_rate: match ? match.quoted_rate : fxRate,
        spread_bps: match ? match.spread_bps : spreadBps,
        fx_cost_usd: match ? match.fx_cost_usd : fxCostUSD,
        final_net_payout: match ? match.final_net_payout : destinationAmount,
        is_eligible: Boolean(match && match.is_eligible && rail.is_eligible),
        rejection_reason: match && !match.is_eligible ? match.rejection_reason : rail.rejection_reason,
        simulation_duration_ms: match ? match.simulation_duration_ms : 1200,
        pricing_source: match ? match.pricing_source : 'CALIBRATED_INSTITUTIONAL'
      };
    });

    const recommended = finalEvaluatedRails.find(r => r.is_eligible) || null;
    if (!recommended) {
      throw new Error('No payment rail met operational and liquidity constraints.');
    }

    sourceAmount = recommended.source_amount;
    sourceAmountUSD = recommended.source_amount_usd;
    destinationAmount = recommended.destination_amount;
    const settlementPlan = getSettlementPlan(srcCurr, destCurr, sourceAmountUSD, recommended.id);
    const spreadBps = recommended.spread_bps;
    const fxCostUSD = recommended.fx_cost_usd;

    // SWIFT baseline comparison for TCA
    const swiftCandidate = finalEvaluatedRails.find(r => r.id === 'SWIFT_CORRESPONDENT' || r.id === 'SWIFT_BATCH') || { est_fee_usd: 25.0 + (sourceAmountUSD * 0.0010) };
    const recommendedFee = recommended ? recommended.est_fee_usd : 0;
    const aiSavingsUSD = Math.max(0, roundToPrecision(swiftCandidate.est_fee_usd - recommendedFee, 2));

    return {
      sourceCurrency: srcCurr,
      destinationCurrency: destCurr,
      paymentMode,
      sourceAmount,
      destinationAmount,
      sourceAmountUSD,
      fxRate,
      quotedRate: recommended.quoted_rate,
      fxCostUSD,
      spreadBps,
      finalNetPayout: destinationAmount,
      appliedClearingRail: settlementPlan.appliedClearingRail,
      is_instant: settlementPlan.is_instant,
      instantFeasibility: settlementPlan.instantFeasibility,
      instantIneligibilityReason: settlementPlan.instantIneligibilityReason,
      instantThresholdUSD: settlementPlan.instantThresholdUSD,
      minimumSettlementHours: settlementPlan.minimumSettlementHours,
      maximumSettlementHours: settlementPlan.maximumSettlementHours,
      settlementWindow: settlementPlan.settlementWindow,
      earliestSettlementAt: settlementPlan.earliestSettlementAt,
      latestSettlementAt: settlementPlan.latestSettlementAt,
      fxAnalysis,
      timingRecommendation,
      priorityProfile: pref,
      recommendedRail: recommended,
      evaluatedRails: finalEvaluatedRails,
      aiSavingsUSD,
      explanation: scoringResult.explanation
    };
  }
}

module.exports = new MultiRailOrchestrationEngine();
