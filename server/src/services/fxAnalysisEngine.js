const { getExchangeRates, getHistoricalRates } = require('./currencyService');
const { roundToPrecision } = require('../utils/mathUtils');

class FXAnalysisEngine {
  /**
   * Perform statistical analysis on FX pair: Current rate, SMA, EMA, Volatility, Classification
   */
  async analyzePair(baseCurrency, targetCurrency) {
    const base = (baseCurrency || 'USD').toUpperCase();
    const target = (targetCurrency || 'EUR').toUpperCase();

    if (base === target) {
      return {
        baseCurrency: base,
        targetCurrency: target,
        currentRate: 1.0,
        sma24h: 1.0,
        ema24h: 1.0,
        volatility: 0,
        volatilityClassification: 'Low',
        classification: 'EXECUTE_NOW',
        recommendation: 'Same-currency transfer requires no foreign exchange conversion.',
        isSufficientHistory: true,
        source: 'SIMULATED',
        timestamp: new Date()
      };
    }

    // 1. Fetch current exchange rate
    const currentRatesData = await getExchangeRates(base);
    const currentRate = (currentRatesData.conversion_rates && currentRatesData.conversion_rates[target]) || 1.0;
    const source = currentRatesData.source || 'SIMULATED';

    // 2. Fetch historical series (last 14 days)
    const historyData = await getHistoricalRates(base, target, 14);
    const dateKeys = Object.keys(historyData.conversion_rates || {}).sort();

    const rateSeries = [];
    for (const d of dateKeys) {
      const val = historyData.conversion_rates[d];
      if (typeof val === 'number') rateSeries.push(val);
      else if (val && typeof val[target] === 'number') rateSeries.push(val[target]);
    }

    // Ensure the latest observation in series is current rate
    if (rateSeries.length === 0 || rateSeries[rateSeries.length - 1] !== currentRate) {
      rateSeries.push(currentRate);
    }

    const isSufficientHistory = rateSeries.length >= 3;

    // 3. Compute 24h / Short-Term SMA (Simple Moving Average)
    const windowSize = Math.min(rateSeries.length, 5);
    const recentWindow = rateSeries.slice(-windowSize);
    const sma = recentWindow.reduce((acc, r) => acc + r, 0) / recentWindow.length;

    // 4. Compute EMA (Exponential Moving Average) with smoothing alpha = 2 / (N + 1)
    const alpha = 2 / (recentWindow.length + 1);
    let ema = recentWindow[0];
    for (let i = 1; i < recentWindow.length; i++) {
      ema = (recentWindow[i] * alpha) + (ema * (1 - alpha));
    }

    // 5. Compute Volatility (Standard deviation of daily log returns or relative price changes)
    let variance = 0;
    for (const r of recentWindow) {
      variance += Math.pow(r - sma, 2);
    }
    const stdDev = Math.sqrt(variance / recentWindow.length);
    const relativeVolatilityPct = (stdDev / currentRate) * 100;

    let volatilityClassification = 'Low';
    if (relativeVolatilityPct > 1.2) {
      volatilityClassification = 'High';
    } else if (relativeVolatilityPct > 0.4) {
      volatilityClassification = 'Moderate';
    }

    // 6. Classification & Recommendation Guidance
    // If current rate is higher than EMA/SMA for recipient, sender gets better value
    let classification = 'NEUTRAL';
    let recommendation = 'Current FX conditions appear stable and neutral across recent moving averages.';

    if (!isSufficientHistory) {
      classification = 'NEUTRAL';
      recommendation = 'Limited historical observations available. Proceed with standard execution guidance.';
    } else if (currentRate >= ema * 1.002) {
      classification = 'EXECUTE_NOW';
      recommendation = `Current rate (${roundToPrecision(currentRate, 4)}) is favorable relative to the 24h EMA (${roundToPrecision(ema, 4)}). Executing now captures near-peak conversion value.`;
    } else if (currentRate <= ema * 0.995 && volatilityClassification === 'High') {
      classification = 'CONSIDER_DEFER';
      recommendation = `Current rate (${roundToPrecision(currentRate, 4)}) is trading below recent 24h EMA (${roundToPrecision(ema, 4)}) with elevated volatility. You may consider deferring if settlement is not urgent.`;
    } else {
      classification = 'NEUTRAL';
      recommendation = `Current rate is closely tracking the 24h SMA (${roundToPrecision(sma, 4)}) and EMA (${roundToPrecision(ema, 4)}) under ${volatilityClassification.toLowerCase()} volatility.`;
    }

    return {
      baseCurrency: base,
      targetCurrency: target,
      currentRate: roundToPrecision(currentRate, 4),
      sma24h: roundToPrecision(sma, 4),
      ema24h: roundToPrecision(ema, 4),
      volatility: roundToPrecision(relativeVolatilityPct, 3),
      volatilityClassification,
      classification,
      recommendation,
      isSufficientHistory,
      source,
      timestamp: new Date()
    };
  }
}

module.exports = new FXAnalysisEngine();
