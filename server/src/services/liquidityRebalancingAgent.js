const liquidityManager = require('./liquidityManager');
const graphRouterService = require('./graphRouterService');
const auditEngine = require('./auditEngine');
const RAIL_CONFIG = require('../config/railConfig');

/**
 * LiquidityRebalancingAgent
 * Autonomous Agent 2: Monitors rail liquidity saturation, detects corridor bottlenecks,
 * synthesizes alternative multi-hop conversion paths via Dijkstra's graph optimization,
 * and proposes proactive pool rebalancing strategies.
 */
class LiquidityRebalancingAgent {
  constructor() {
    this.saturationThresholdWarning = 0.60;  // 60% saturation
    this.saturationThresholdCritical = 0.80; // 80% saturation
  }

  /**
   * Assesses liquidity health across all active rails for a given transfer or globally
   */
  async assessRailHealth(amountUSD = 10000) {
    if (!liquidityManager.isInitialized) {
      await liquidityManager.initialize();
    }

    const amt = Math.max(10, Number(amountUSD) || 10000);
    const railSettings = await liquidityManager.getAllRailSettings();

    const analysis = [];
    let bottleneckCount = 0;

    for (const rail of railSettings) {
      const avail = Number(rail.availableLiquidityUSD) || 0;
      const initial = Number(rail.initialLiquidityUSD) || avail || 1000000;
      const saturation = avail > 0 ? parseFloat((amt / avail).toFixed(4)) : 1.0;
      const poolDepletionPct = initial > 0 ? parseFloat((((initial - avail) / initial) * 100).toFixed(2)) : 0;

      let status = 'HEALTHY';
      let recommendation = 'Standard processing approved.';

      const isInstantRail = rail.railId === 'REGIONAL_INSTANT' || rail.railId === 'INSTANT_PAYMENT_LINK';
      const isCardRail = rail.railId === 'CARD_PUSH' || rail.railId === 'CARD_PAYOUT';

      if (!rail.isEnabled) {
        status = 'DISABLED';
        recommendation = 'Rail is offline; reroute all traffic.';
        bottleneckCount += 1;
      } else if (isInstantRail && amt > 1000) {
        status = 'AMOUNT_EXCEEDED';
        recommendation = `Amount $${amt.toLocaleString()} exceeds retail threshold ($1,000 USD) for Regional Instant network.`;
        bottleneckCount += 1;
      } else if (isCardRail && amt > 25000) {
        status = 'AMOUNT_EXCEEDED';
        recommendation = `Amount $${amt.toLocaleString()} exceeds card payout network cap ($25,000 USD).`;
        bottleneckCount += 1;
      } else if (amt > rail.maxAmountUSD) {
        status = 'AMOUNT_EXCEEDED';
        recommendation = `Amount $${amt.toLocaleString()} exceeds rail cap $${rail.maxAmountUSD.toLocaleString()}. Reroute to wholesale rail.`;
        bottleneckCount += 1;
      } else if (saturation >= this.saturationThresholdCritical || avail < amt * 1.2) {
        status = 'CRITICAL_CONGESTION';
        recommendation = `High saturation (${(saturation * 100).toFixed(1)}%). Impending settlement failure; synthetic multi-hop failover advised.`;
        bottleneckCount += 1;
      } else if (saturation >= this.saturationThresholdWarning) {
        status = 'ELEVATED_LOAD';
        recommendation = `Moderate congestion (${(saturation * 100).toFixed(1)}%). Consider rebalancing liquidity buffer.`;
      }

      analysis.push({
        railId: rail.railId,
        name: rail.name,
        availableLiquidityUSD: avail,
        initialLiquidityUSD: initial,
        transferAmountUSD: amt,
        saturationRatio: saturation,
        saturationPct: parseFloat((saturation * 100).toFixed(2)),
        poolDepletionPct,
        status,
        recommendation
      });
    }

    return {
      evaluatedAt: new Date().toISOString(),
      requestedAmountUSD: amt,
      systemStatus: bottleneckCount === 0 ? 'OPTIMAL' : (bottleneckCount >= 2 ? 'SEVERELY_CONGESTED' : 'DEGRADED'),
      bottleneckCount,
      rails: analysis
    };
  }

  /**
   * Generates a synthetic multi-hop graph rerouting plan using Dijkstra's algorithm
   * when direct corridors or rails face congestion.
   */
  async planRerouteOrRebalance({
    sourceCurrency = 'USD',
    destinationCurrency = 'INR',
    amountUSD = 25000,
    congestedRailId = 'REGIONAL_INSTANT'
  }) {
    const src = sourceCurrency.toUpperCase();
    const dst = destinationCurrency.toUpperCase();
    const amt = Number(amountUSD) || 25000;

    const health = await this.assessRailHealth(amt);
    const congestedRail = health.rails.find(r => r.railId === congestedRailId) || health.rails[0];

    // Query Dijkstra Multi-Hop Graph Router for alternative path
    const graphResult = await graphRouterService.findOptimalRoute(src, dst, 300);

    const hasAlternativeMultiHop = Boolean(graphResult && (graphResult.is_multi_hop || (graphResult.path && graphResult.path.length > 2)));

    const recommendation = {
      planId: `REBAL-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      sourceCurrency: src,
      destinationCurrency: dst,
      amountUSD: amt,
      primaryRailId: congestedRailId,
      primaryRailSaturationPct: congestedRail ? congestedRail.saturationPct : 0,
      congestionDetected: congestedRail ? (congestedRail.status === 'CRITICAL_CONGESTION' || congestedRail.status === 'AMOUNT_EXCEEDED') : false,
      graphPath: graphResult ? graphResult.path : [src, dst],
      isSyntheticMultiHop: hasAlternativeMultiHop,
      graphEffectiveRate: graphResult ? (graphResult.effective_rate || graphResult.effectiveRate) : null,
      graphEstimatedFeeBps: graphResult ? (graphResult.net_fee_bps || 15) : 15,
      hops: graphResult ? graphResult.hops : [],
      actionPlan: hasAlternativeMultiHop
        ? `AUTOMATED_GRAPH_DIVERSION: Reroute traffic via synthetic multi-hop ${graphResult.path.join(' -> ')} to bypass congested pool ${congestedRailId}.`
        : `LIQUIDITY_BUFFER_INJECTION: Inject $${(amt * 1.5).toLocaleString()} USD virtual buffer into ${congestedRailId} to alleviate saturation.`,
      status: 'PLAN_READY'
    };

    await auditEngine.logEvent({
      transactionId: recommendation.planId,
      actor: 'LIQUIDITY_REBALANCING_AGENT',
      action: 'LIQUIDITY_REROUTE_PLAN_GENERATED',
      result: 'SUCCESS',
      metadata: {
        congestedRailId,
        saturationPct: congestedRail ? congestedRail.saturationPct : 0,
        graphPath: recommendation.graphPath,
        isSyntheticMultiHop: recommendation.isSyntheticMultiHop
      }
    });

    return recommendation;
  }

  /**
   * Executes a simulated liquidity rebalance / replenishment to restore a congested rail pool
   */
  async executePoolReplenishment(railId, amountUSD = 50000) {
    const rail = await liquidityManager.getRailSetting(railId);
    if (!rail) throw new Error(`Rail ${railId} not found.`);

    const currentAvail = Number(rail.availableLiquidityUSD) || 0;
    const added = Number(amountUSD) || 50000;
    const newAvail = currentAvail + added;

    if (typeof liquidityManager.setRailLiquidity === 'function') {
      await liquidityManager.setRailLiquidity(railId, newAvail);
    } else if (typeof liquidityManager.updateRailSetting === 'function') {
      await liquidityManager.updateRailSetting(railId, { availableLiquidityUSD: newAvail });
    }

    await auditEngine.logEvent({
      transactionId: `INJECT-${railId}-${Date.now().toString(36).toUpperCase()}`,
      actor: 'LIQUIDITY_REBALANCING_AGENT',
      action: 'LIQUIDITY_POOL_REPLENISHED',
      result: 'SUCCESS',
      metadata: {
        railId,
        injectedAmountUSD: added,
        previousAvailableUSD: currentAvail,
        newAvailableUSD: newAvail
      }
    });

    return {
      success: true,
      railId,
      injectedUSD: added,
      newAvailableUSD: newAvail,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new LiquidityRebalancingAgent();
