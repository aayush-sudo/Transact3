const swiftRail = require('../rails/swiftRail');
const instantRail = require('../rails/instantRail');
const nettingRail = require('../rails/nettingRail');
const cardPushRail = require('../rails/cardPushRail');

const liquidityManager = require('./liquidityManager');
const fxAnalysisEngine = require('./fxAnalysisEngine');
const fastApiClient = require('./fastapiClient');
const { getExchangeRates } = require('./currencyService');
const { isCurrencySupported } = require('../config/currencies');
const { getCorridorConfig } = require('../config/corridors');
const { roundToPrecision, safeAdd, safeDivide, safeMultiply } = require('../utils/mathUtils');

const ALL_RAIL_ADAPTERS = [
  instantRail,
  nettingRail,
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
    const fxRate = fxAnalysis.currentRate;

    // Rates to USD for liquidity & fee normalization
    const usdRatesData = await getExchangeRates('USD');
    const usdRates = usdRatesData.conversion_rates || {};
    const srcVsUSD = usdRates[srcCurr] || 1.0;

    // 3. Calculate Source & Destination amounts based on payment mode
    let sourceAmount = numAmount;
    let destinationAmount = numAmount;

    if (srcCurr === destCurr) {
      sourceAmount = numAmount;
      destinationAmount = numAmount;
    } else if (paymentMode === 'RECIPIENT_GETS') {
      // User specified exact amount recipient must get: calculate required sourceAmount backwards
      destinationAmount = numAmount;
      sourceAmount = roundToPrecision(numAmount / fxRate, 2);
    } else {
      // User specified send amount: calculate destination amount
      sourceAmount = numAmount;
      destinationAmount = roundToPrecision(numAmount * fxRate, 2);
    }

    // Amount in USD for global limits and rail checks
    const sourceAmountUSD = roundToPrecision(sourceAmount / srcVsUSD, 2);
    const spreadBps = corridorConfig.baseSpreadBps || 30;
    const fxCostUSD = roundToPrecision(sourceAmountUSD * (spreadBps / 10000), 2);

    // 4. Evaluate ALL 4 rails without skipping
    const railCandidatesForFastAPI = [];
    const evaluatedRails = [];

    const pref = PREFERENCE_WEIGHTS[priority] ? priority : 'BALANCED';
    const weights = PREFERENCE_WEIGHTS[pref];

    for (const rail of ALL_RAIL_ADAPTERS) {
      const eligibility = await liquidityManager.checkRailEligibility(rail.id, sourceAmountUSD, corridorConfig);
      const feeDetails = rail.getFeeBreakdown(sourceAmountUSD);
      const estLatencyHours = rail.estimateLatency();

      const candidate = {
        id: rail.id,
        name: rail.name,
        description: rail.config.description,
        icon: rail.config.icon,
        base_fee_usd: rail.config.baseFeeUSD,
        variable_fee_bps: rail.config.variableFeeBps,
        est_fee_usd: feeDetails.totalFeeUSD,
        fixed_fee_usd: feeDetails.fixedFeeUSD,
        variable_fee_usd: feeDetails.variableFeeUSD,
        est_latency_hours: estLatencyHours,
        expected_settlement_display: rail.config.expectedSettlementDisplay,
        simulation_duration_ms: rail.config.simulationDurationMs || 1200,
        reliability_score: rail.config.reliabilityScore,
        available_liquidity_usd: eligibility.setting ? eligibility.setting.availableLiquidityUSD : 1000000,
        is_eligible: eligibility.isEligible,
        rejection_reason: eligibility.rejectionReason
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
        simulation_duration_ms: match ? match.simulation_duration_ms : 1200
      };
    });

    const recommended = finalEvaluatedRails.find(r => r.is_eligible) || null;

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
      fxCostUSD,
      spreadBps,
      fxAnalysis,
      priorityProfile: pref,
      recommendedRail: recommended,
      evaluatedRails: finalEvaluatedRails,
      aiSavingsUSD,
      explanation: scoringResult.explanation
    };
  }
}

module.exports = new MultiRailOrchestrationEngine();
