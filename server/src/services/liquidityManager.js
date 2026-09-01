const SUPPORTED_CURRENCIES = require('../config/currencies');
const RAIL_CONFIG = require('../config/railConfig');

class LiquidityManager {
  constructor() {
    // In-memory liquidity pools & rail utilization states
    this.currencyPools = new Map();
    this.railUtilization = new Map();

    this.initializePools();
  }

  initializePools() {
    Object.keys(SUPPORTED_CURRENCIES).forEach((code) => {
      this.currencyPools.set(code, SUPPORTED_CURRENCIES[code].defaultPool);
    });

    Object.keys(RAIL_CONFIG).forEach((railId) => {
      // Seed default random capacity utilization between 20% and 65%
      const initialUtilization = Math.round(20 + Math.random() * 45);
      this.railUtilization.set(railId, initialUtilization);
    });
  }

  getCurrencyLiquidity(currencyCode) {
    const code = currencyCode.toUpperCase();
    const available = this.currencyPools.get(code) || 1000000;
    const initial = (SUPPORTED_CURRENCIES[code] && SUPPORTED_CURRENCIES[code].defaultPool) || 1000000;
    const utilizationPct = Math.round(((initial - available) / initial) * 100);

    return {
      currency: code,
      available,
      initialPool: initial,
      utilizationPct: Math.max(0, utilizationPct),
      status: available > 50000 ? 'SUFFICIENT' : 'CONSTRAINED'
    };
  }

  getRailLiquidity(railId) {
    const utilizationPct = this.railUtilization.get(railId) || 40;
    const config = RAIL_CONFIG[railId];

    let penalty = 0.0;
    let status = 'OPTIMAL';

    if (utilizationPct >= 95) {
      penalty = 1.00;
      status = 'CRITICAL_CONSTRAINED';
    } else if (utilizationPct >= 90) {
      penalty = 0.40;
      status = 'HIGHLY_UTILIZED';
    } else if (utilizationPct >= 85) {
      penalty = 0.15;
      status = 'CAPACITY_WARNING';
    }

    return {
      railId,
      name: config ? config.name : railId,
      utilizationPct,
      liquidityPenalty: penalty,
      status,
      hourlyCapacityUSD: config ? config.capacityHourlyUSD : 10000000
    };
  }

  calculateDynamicPenalty(railId, amountUSD) {
    const railInfo = this.getRailLiquidity(railId);
    let penalty = railInfo.liquidityPenalty;

    // Additional capacity check for requested transaction amount
    const config = RAIL_CONFIG[railId];
    if (config && amountUSD > config.maxAmountUSD) {
      penalty += 2.0; // Heavy penalty if exceeding rail max amount
    }

    return parseFloat(penalty.toFixed(3));
  }

  reserveLiquidity(currencyCode, amount, railId) {
    const code = currencyCode.toUpperCase();
    const currentPool = this.currencyPools.get(code) || 1000000;

    if (currentPool < amount) {
      return { success: false, reason: `Insufficient liquidity pool for currency ${code}` };
    }

    this.currencyPools.set(code, currentPool - amount);

    // Increment rail utilization slightly
    const currentRailUtil = this.railUtilization.get(railId) || 40;
    this.railUtilization.set(railId, Math.min(99, currentRailUtil + 1));

    return { success: true, reservedAmount: amount, remainingPool: currentPool - amount };
  }

  releaseLiquidity(currencyCode, amount, railId) {
    const code = currencyCode.toUpperCase();
    const currentPool = this.currencyPools.get(code) || 1000000;
    this.currencyPools.set(code, currentPool + amount);

    const currentRailUtil = this.railUtilization.get(railId) || 40;
    this.railUtilization.set(railId, Math.max(10, currentRailUtil - 1));
  }

  getAllStatus() {
    const rails = {};
    Object.keys(RAIL_CONFIG).forEach((id) => {
      rails[id] = this.getRailLiquidity(id);
    });

    const currencies = {};
    Object.keys(SUPPORTED_CURRENCIES).forEach((code) => {
      currencies[code] = this.getCurrencyLiquidity(code);
    });

    return { rails, currencies };
  }
}

module.exports = new LiquidityManager();
