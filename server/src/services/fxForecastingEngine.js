const fxRateEngine = require('./fxRateEngine');
const SUPPORTED_CURRENCIES = require('../config/currencies');
const fxCronService = require('./fxCronService');

class FXForecastingEngine {
  async predictFXMovements(sourceCurrency, destinationCurrency) {
    const src = sourceCurrency.toUpperCase();
    const dst = destinationCurrency.toUpperCase();

    const currentRate = await fxRateEngine.getReferenceRate(src, dst);

    const srcInfo = SUPPORTED_CURRENCIES[src] || { baseVolatility: 0.002 };
    const dstInfo = SUPPORTED_CURRENCIES[dst] || { baseVolatility: 0.002 };
    const combinedVolatility = Math.sqrt(Math.pow(srcInfo.baseVolatility, 2) + Math.pow(dstInfo.baseVolatility, 2));

    // Retrieve moving averages if available
    const ma = fxCronService.getMovingAverages(src, dst);
    let trendMomentum = 0;
    if (ma.ema12h && ma.sma24h) {
      trendMomentum = (ma.ema12h - ma.sma24h) / ma.sma24h;
    }

    // Time-of-day cyclical component combined with fundamental volatility
    const now = new Date();
    const hourOfDay = now.getUTCHours();
    const cycleFactor = Math.sin((hourOfDay / 24) * 2 * Math.PI + src.charCodeAt(0) * 0.1) * combinedVolatility * 1.5;
    const finalTrend = (trendMomentum * 0.6) + (cycleFactor * 0.4);

    // Multi-horizon rate forecast projections (Exponential Smoothing)
    const horizon6h = parseFloat((currentRate * (1 + finalTrend * 0.45)).toFixed(6));
    const horizon12h = parseFloat((currentRate * (1 + finalTrend * 0.85)).toFixed(6));
    const horizon24h = parseFloat((currentRate * (1 + finalTrend * 0.60 + (combinedVolatility * 0.1))).toFixed(6));
    const horizon48h = parseFloat((currentRate * (1 + finalTrend * 0.25 - (combinedVolatility * 0.05))).toFixed(6));

    const volatilityPct = parseFloat((combinedVolatility * 100).toFixed(2));
    const confidencePct = Math.min(95, Math.max(55, Math.round(82 - (combinedVolatility * 2500) + (ma.dataPoints > 10 ? 10 : 0))));

    // Projections array
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
      trendDirection: finalTrend >= 0 ? 'BULLISH' : 'BEARISH',
      movingAverages: ma,
      optimalProjectedRate: maxRateObj.rate,
      optimalHorizon: maxRateObj.horizon,
      maxImprovementPct: Math.max(0, maxImprovementPct),
      timestamp: new Date()
    };
  }

  async evaluateTiming(sourceCurrency, destinationCurrency, userPriority = 'BALANCED', maxPermittedDelayHours = 24) {
    const forecast = await this.predictFXMovements(sourceCurrency, destinationCurrency);

    if (userPriority === 'SPEED' || maxPermittedDelayHours <= 0) {
      return {
        recommendation: 'EXECUTE_NOW',
        deferHours: 0,
        expectedSavingsPct: 0.0,
        reason: 'Payment urgency/speed priority requires immediate execution',
        forecast
      };
    }

    if (forecast.volatilityPct > 0.6) {
      return {
        recommendation: 'EXECUTE_NOW',
        deferHours: 0,
        expectedSavingsPct: 0.0,
        reason: 'High market volatility (>0.60%) — lock conversion rate now to prevent adverse slippage',
        forecast
      };
    }

    if (forecast.maxImprovementPct >= 0.12 && forecast.confidencePct >= 65) {
      let recommendation = 'EXECUTE_NOW';
      let deferHours = 0;

      if (forecast.optimalHorizon === '6h' && maxPermittedDelayHours >= 6) {
        recommendation = 'DEFER_6H';
        deferHours = 6;
      } else if (forecast.optimalHorizon === '12h' && maxPermittedDelayHours >= 12) {
        recommendation = 'DEFER_12H';
        deferHours = 12;
      } else if (forecast.optimalHorizon === '24h' && maxPermittedDelayHours >= 24) {
        recommendation = 'DEFER_24H';
        deferHours = 24;
      } else if (maxPermittedDelayHours >= 1) {
        recommendation = 'DEFER_1H';
        deferHours = 1;
      }

      if (recommendation !== 'EXECUTE_NOW') {
        return {
          recommendation,
          deferHours,
          expectedSavingsPct: forecast.maxImprovementPct,
          reason: `Algorithmic FX Timing: Predicted rate dip in ${forecast.optimalHorizon} horizon yields +${forecast.maxImprovementPct}% FX cost savings`,
          forecast
        };
      }
    }

    return {
      recommendation: 'EXECUTE_NOW',
      deferHours: 0,
      expectedSavingsPct: 0.0,
      reason: 'Current rate is near optimal short-term peak or trend is neutral',
      forecast
    };
  }
}

module.exports = new FXForecastingEngine();
