const fxRateEngine = require('./fxRateEngine');
const SUPPORTED_CURRENCIES = require('../config/currencies');

class FXForecastingEngine {
  async predictFXMovements(sourceCurrency, destinationCurrency) {
    const src = sourceCurrency.toUpperCase();
    const dst = destinationCurrency.toUpperCase();

    const currentRate = await fxRateEngine.getReferenceRate(src, dst);

    const srcInfo = SUPPORTED_CURRENCIES[src] || { baseVolatility: 0.002 };
    const dstInfo = SUPPORTED_CURRENCIES[dst] || { baseVolatility: 0.002 };
    const combinedVolatility = Math.sqrt(Math.pow(srcInfo.baseVolatility, 2) + Math.pow(dstInfo.baseVolatility, 2));

    // Seed deterministic or time-based micro trend (-0.5% to +0.8%)
    const hourOfDay = new Date().getHours();
    const pseudoRandomTrend = (Math.sin(hourOfDay + src.charCodeAt(0) + dst.charCodeAt(0)) * 0.004) + 0.001;

    // Predictions over horizons
    const horizon6h = parseFloat((currentRate * (1 + pseudoRandomTrend * 0.35)).toFixed(6));
    const horizon12h = parseFloat((currentRate * (1 + pseudoRandomTrend * 0.70)).toFixed(6));
    const horizon24h = parseFloat((currentRate * (1 + pseudoRandomTrend * 0.40)).toFixed(6));
    const horizon48h = parseFloat((currentRate * (1 - pseudoRandomTrend * 0.20)).toFixed(6));

    const volatilityPct = parseFloat((combinedVolatility * 100).toFixed(2));
    const confidencePct = Math.round(75 + (1 - combinedVolatility * 50) * 15);

    // Projected optimal rate & horizon
    const projections = [
      { horizon: '6h', rate: horizon6h },
      { horizon: '12h', rate: horizon12h },
      { horizon: '24h', rate: horizon24h },
      { horizon: '48h', rate: horizon48h }
    ];

    let maxRateObj = projections[0];
    for (const p of projections) {
      if (p.rate > maxRateObj.rate) maxRateObj = p;
    }

    const maxImprovementPct = parseFloat((((maxRateObj.rate - currentRate) / currentRate) * 100).toFixed(3));

    return {
      sourceCurrency: src,
      destinationCurrency: dst,
      currencyPair: `${src}/${dst}`,
      currentRate,
      predictions: {
        h6: horizon6h,
        h12: horizon12h,
        h24: horizon24h,
        h48: horizon48h
      },
      volatilityPct,
      confidencePct,
      trendDirection: pseudoRandomTrend > 0 ? 'BULLISH' : 'BEARISH',
      optimalProjectedRate: maxRateObj.rate,
      optimalHorizon: maxRateObj.horizon,
      maxImprovementPct,
      timestamp: new Date()
    };
  }
}

module.exports = new FXForecastingEngine();
