const RailSetting = require('../models/RailSetting');
const RAIL_CONFIG = require('../config/railConfig');
const SUPPORTED_CURRENCIES = require('../config/currencies');

class LiquidityManager {
  constructor() {
    this.currencyPools = new Map();
    this.cachedRailSettings = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // 1. Initialize Currency Pools in memory
      for (const [code, details] of Object.entries(SUPPORTED_CURRENCIES)) {
        if (!this.currencyPools.has(code)) {
          this.currencyPools.set(code, details.defaultPool || 50000000);
        }
      }

      // 2. Remove any obsolete RTGS records from database
      await RailSetting.deleteMany({ railId: { $in: ['RTGS_SETTLEMENT', 'RTGS_INSTANT'] } });
      this.cachedRailSettings.delete('RTGS_SETTLEMENT');
      this.cachedRailSettings.delete('RTGS_INSTANT');

      // 3. Ensure RailSettings exist in MongoDB for the 4 canonical routes
      const railIds = RAIL_CONFIG.CANONICAL_RAIL_IDS || Object.keys(RAIL_CONFIG);
      for (const railId of railIds) {
        const config = RAIL_CONFIG[railId];
        if (!config || typeof config !== 'object') continue;
        let setting = await RailSetting.findOne({ railId });
        if (!setting) {
          setting = await RailSetting.create({
            railId,
            name: config.name,
            description: config.description,
            isEnabled: true,
            baseFeeUSD: config.baseFeeUSD,
            variableFeeBps: config.variableFeeBps,
            avgLatencyHours: config.avgLatencyHours,
            expectedSettlementDisplay: config.expectedSettlementDisplay,
            simulationDurationMs: config.simulationDurationMs || 1200,
            maxAmountUSD: config.maxAmountUSD,
            reliabilityScore: config.reliabilityScore,
            availableLiquidityUSD: config.capacityHourlyUSD * 0.75, // 75% initial available liquidity
            initialLiquidityUSD: config.capacityHourlyUSD
          });
        }
        this.cachedRailSettings.set(railId, setting.toObject());
      }
      this.isInitialized = true;
    } catch (err) {
      console.warn('[LiquidityManager] MongoDB initialization fallback:', err.message);
      // In-memory fallback
      for (const [railId, config] of Object.entries(RAIL_CONFIG)) {
        if (railId.startsWith('RTGS')) continue;
        this.cachedRailSettings.set(railId, {
          railId,
          name: config.name,
          description: config.description,
          isEnabled: true,
          baseFeeUSD: config.baseFeeUSD,
          variableFeeBps: config.variableFeeBps,
          avgLatencyHours: config.avgLatencyHours,
          expectedSettlementDisplay: config.expectedSettlementDisplay,
          simulationDurationMs: config.simulationDurationMs || 1200,
          maxAmountUSD: config.maxAmountUSD,
          reliabilityScore: config.reliabilityScore,
          availableLiquidityUSD: config.capacityHourlyUSD * 0.75,
          initialLiquidityUSD: config.capacityHourlyUSD
        });
      }
    }
  }

  async getRailSetting(railId) {
    if (!this.isInitialized) await this.initialize();
    try {
      const setting = await RailSetting.findOne({ railId });
      if (setting) {
        this.cachedRailSettings.set(railId, setting.toObject());
        return setting.toObject();
      }
    } catch (e) {}
    return this.cachedRailSettings.get(railId) || RAIL_CONFIG[railId];
  }

  async getAllRailSettings() {
    if (!this.isInitialized) await this.initialize();
    try {
      const settings = await RailSetting.find({ railId: { $nin: ['RTGS_SETTLEMENT', 'RTGS_INSTANT'] } }).sort({ baseFeeUSD: 1 });
      if (settings && settings.length > 0) {
        return settings.map(s => s.toObject());
      }
    } catch (e) {}
    return Array.from(this.cachedRailSettings.values()).filter(r => !r.railId?.startsWith('RTGS'));
  }

  async setRailEnabled(railId, isEnabled) {
    if (!this.isInitialized) await this.initialize();
    try {
      const updated = await RailSetting.findOneAndUpdate(
        { railId },
        { isEnabled: Boolean(isEnabled), lastUpdated: new Date() },
        { new: true, upsert: true }
      );
      this.cachedRailSettings.set(railId, updated.toObject());
      return updated.toObject();
    } catch (e) {
      const current = this.cachedRailSettings.get(railId) || {};
      current.isEnabled = Boolean(isEnabled);
      this.cachedRailSettings.set(railId, current);
      return current;
    }
  }

  async setRailLiquidity(railId, availableLiquidityUSD) {
    if (!this.isInitialized) await this.initialize();
    const amount = Math.max(0, Number(availableLiquidityUSD) || 0);
    try {
      const updated = await RailSetting.findOneAndUpdate(
        { railId },
        { availableLiquidityUSD: amount, lastUpdated: new Date() },
        { new: true, upsert: true }
      );
      this.cachedRailSettings.set(railId, updated.toObject());
      return updated.toObject();
    } catch (e) {
      const current = this.cachedRailSettings.get(railId) || {};
      current.availableLiquidityUSD = amount;
      this.cachedRailSettings.set(railId, current);
      return current;
    }
  }

  async resetToDefaults() {
    await RailSetting.deleteMany({ railId: { $in: ['RTGS_SETTLEMENT', 'RTGS_INSTANT'] } });
    this.cachedRailSettings.delete('RTGS_SETTLEMENT');
    this.cachedRailSettings.delete('RTGS_INSTANT');

    for (const [railId, config] of Object.entries(RAIL_CONFIG)) {
      if (railId.startsWith('RTGS') || typeof config !== 'object') continue;
      const defaultAvailable = config.capacityHourlyUSD * 0.75;
      try {
        await RailSetting.findOneAndUpdate(
          { railId },
          {
            isEnabled: true,
            availableLiquidityUSD: defaultAvailable,
            initialLiquidityUSD: config.capacityHourlyUSD,
            lastUpdated: new Date()
          },
          { upsert: true }
        );
      } catch (e) {}
      this.cachedRailSettings.set(railId, {
        railId,
        name: config.name,
        description: config.description,
        isEnabled: true,
        baseFeeUSD: config.baseFeeUSD,
        variableFeeBps: config.variableFeeBps,
        avgLatencyHours: config.avgLatencyHours,
        expectedSettlementDisplay: config.expectedSettlementDisplay,
        simulationDurationMs: config.simulationDurationMs || 1200,
        maxAmountUSD: config.maxAmountUSD,
        reliabilityScore: config.reliabilityScore,
        availableLiquidityUSD: defaultAvailable,
        initialLiquidityUSD: config.capacityHourlyUSD
      });
    }

    for (const [code, details] of Object.entries(SUPPORTED_CURRENCIES)) {
      this.currencyPools.set(code, details.defaultPool || 50000000);
    }
    return this.getAllRailSettings();
  }

  /**
   * Evaluate liquidity eligibility for a rail given payment amount in USD
   */
  async checkRailEligibility(railId, amountUSD, corridorConfig = null) {
    const setting = await this.getRailSetting(railId);
    if (!setting) {
      return { isEligible: false, rejectionReason: `Unknown settlement rail ${railId}` };
    }

    if (!setting.isEnabled) {
      return {
        isEligible: false,
        rejectionReason: `${setting.name} is temporarily disabled by network administrator`,
        setting
      };
    }

    if (amountUSD > setting.maxAmountUSD) {
      return {
        isEligible: false,
        rejectionReason: `Payment amount ($${amountUSD.toLocaleString()}) exceeds maximum limit of $${setting.maxAmountUSD.toLocaleString()}`,
        setting
      };
    }

    if (amountUSD > setting.availableLiquidityUSD) {
      return {
        isEligible: false,
        rejectionReason: `Insufficient liquidity (Required: $${amountUSD.toLocaleString()}, Available: $${Math.round(setting.availableLiquidityUSD).toLocaleString()})`,
        setting
      };
    }

    if (corridorConfig && corridorConfig.eligibleRails && !corridorConfig.eligibleRails.includes(railId)) {
      return {
        isEligible: false,
        rejectionReason: `${setting.name} is not operational for this currency corridor`,
        setting
      };
    }

    return {
      isEligible: true,
      rejectionReason: null,
      setting
    };
  }

  // Deduct liquidity upon settlement
  async consumeLiquidity(railId, amountUSD) {
    const setting = await this.getRailSetting(railId);
    if (setting) {
      const newLiquidity = Math.max(0, setting.availableLiquidityUSD - amountUSD);
      await this.setRailLiquidity(railId, newLiquidity);
    }
  }

  // Release liquidity if failed
  async restoreLiquidity(railId, amountUSD) {
    const setting = await this.getRailSetting(railId);
    if (setting) {
      const newLiquidity = setting.availableLiquidityUSD + amountUSD;
      await this.setRailLiquidity(railId, newLiquidity);
    }
  }
}

const manager = new LiquidityManager();
module.exports = manager;
