const { getExchangeRates } = require('./currencyService');
const fastApiClient = require('./fastapiClient');

class FXForecastingEngine {
  constructor() {
    this.cache = new Map();
    this.cacheTtlMs = 5 * 60 * 1000;
  }

  async predictFXMovements(sourceCurrency, destinationCurrency) {
    const src = String(sourceCurrency || '').toUpperCase();
    const dst = String(destinationCurrency || '').toUpperCase();
    if (src === dst) {
      throw new Error('An FX forecast requires two different currencies.');
    }
    const cacheKey = `${src}/${dst}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.cacheTtlMs) {
      return cached.forecast;
    }

    let modelResult;
    try {
      modelResult = await fastApiClient.predictHourlyFX({ base: src, target: dst });
    } catch (error) {
      console.warn('[FXForecastingEngine] Hourly FX forecaster unavailable:', error.message);
      const rateData = await getExchangeRates(src);
      const currentRate = Number(rateData.conversion_rates?.[dst]);
      if (!Number.isFinite(currentRate) || currentRate <= 0) {
        throw new Error(`No reference rate is available for ${src}/${dst}.`);
      }
      return this.unavailableForecast(src, dst, currentRate, rateData, error.message);
    }

    if (modelResult.base !== src || modelResult.target !== dst) {
      throw new Error(`The hourly FX forecaster returned ${modelResult.base}/${modelResult.target} instead of ${src}/${dst}.`);
    }
    const currentRate = Number(modelResult.current_rate);
    if (!Number.isFinite(currentRate) || currentRate <= 0) {
      throw new Error(`The hourly FX forecaster returned an invalid ${src}/${dst} current rate.`);
    }
    const rawPredictions = modelResult.predicted_rates || {};
    const hourlyPredictions = {};
    for (const horizon of ['+6h', '+12h', '+24h', '+48h']) {
      const prediction = rawPredictions[horizon] || {};
      const rate = Number(prediction.rate);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error(`The hourly FX forecaster returned an invalid ${horizon} ${src}/${dst} estimate.`);
      }
      hourlyPredictions[horizon] = {
        rate,
        low: Number.isFinite(Number(prediction.low)) ? Number(prediction.low) : null,
        high: Number.isFinite(Number(prediction.high)) ? Number(prediction.high) : null
      };
    }
    const predictedRate = hourlyPredictions['+24h'].rate;
    const predictedReturnPct = Number(((predictedRate / currentRate - 1) * 100).toFixed(5));
    const dataSource = modelResult.source === 'twelvedata_cross'
      ? 'Twelve Data hourly close (USD cross)'
      : modelResult.source === 'twelvedata'
        ? 'Twelve Data hourly close'
        : 'Synthetic demo hourly data';
    const interval24h = hourlyPredictions['+24h'];

    const forecast = {
      sourceCurrency: src,
      destinationCurrency: dst,
      currencyPair: `${src}/${dst}`,
      currentRate,
      rateSource: dataSource,
      rateDate: modelResult.rate_as_of || modelResult.as_of || null,
      forecastAvailable: true,
      forecastProvider: 'Damped Holt linear trend',
      forecastSource: modelResult.source,
      forecastAsOf: modelResult.as_of || null,
      forecastHorizon: 'hourly estimates through 48 hours',
      forecastRate: predictedRate,
      forecastReturnPct: predictedReturnPct,
      forecastUnavailableReason: null,
      predictions: hourlyPredictions,
      hourlyObservations: Array.isArray(modelResult.observations)
        ? modelResult.observations
          .filter((observation) => observation && Number.isFinite(Number(observation.rate)))
          .map((observation) => ({ date: observation.date, rate: Number(observation.rate) }))
        : [],
      volatilityPct: null,
      confidencePct: null,
      confidenceType: null,
      predictionInterval: {
        lowerBound: interval24h.low,
        upperBound: interval24h.high,
        confidenceLevel: null,
        note: modelResult.bounds_note || null
      },
      historicalValidation: null,
      timingAdvisory: null,
      trendDirection: predictedReturnPct > 0 ? 'BULLISH' : predictedReturnPct < 0 ? 'BEARISH' : 'NEUTRAL',
      movingAverages: null,
      optimalProjectedRate: predictedRate,
      optimalHorizon: '+24h',
      maxImprovementPct: Math.max(0, predictedReturnPct),
      timestamp: new Date()
    };
    this.cache.set(cacheKey, { forecast, cachedAt: Date.now() });
    return forecast;
  }

  unavailableForecast(sourceCurrency, destinationCurrency, currentRate, rateData, reason) {
    return {
      sourceCurrency,
      destinationCurrency,
      currencyPair: `${sourceCurrency}/${destinationCurrency}`,
      currentRate,
      rateSource: rateData.source,
      rateDate: rateData.rateDate,
      forecastAvailable: false,
      forecastProvider: null,
      forecastSource: null,
      forecastAsOf: null,
      forecastUnavailableReason: `The hourly FX forecaster could not produce a forecast: ${reason}`,
      forecastRate: null,
      forecastReturnPct: null,
      predictions: null,
      volatilityPct: null,
      confidencePct: null,
      confidenceType: null,
      historicalValidation: null,
      trendDirection: 'UNAVAILABLE',
      movingAverages: null,
      optimalProjectedRate: null,
      optimalHorizon: null,
      maxImprovementPct: null,
      timestamp: new Date()
    };
  }

  async evaluateTiming(sourceCurrency, destinationCurrency, userPriority = 'BALANCED') {
    const forecast = await this.predictFXMovements(sourceCurrency, destinationCurrency);

    return {
      recommendation: 'EXECUTE_NOW',
      deferHours: 0,
      expectedSavingsPct: 0,
      reason: userPriority === 'SPEED'
        ? 'Speed priority selected; FX model projections do not change transfer timing.'
        : forecast.timingAdvisory?.rationale || 'The system does not defer a transfer based on an FX model projection.',
      forecast
    };
  }
}

module.exports = new FXForecastingEngine();
