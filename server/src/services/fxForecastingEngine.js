const { getExchangeRates, getHistoricalRates } = require('./currencyService');
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

    const [rateData, historicalData] = await Promise.all([
      getExchangeRates(src),
      getHistoricalRates(src, dst, 365)
    ]);
    const currentRate = Number(rateData.conversion_rates?.[dst]);
    if (!Number.isFinite(currentRate) || currentRate <= 0) {
      throw new Error(`No reference rate is available for ${src}/${dst}.`);
    }

    const recentObservations = Object.entries(historicalData.conversion_rates)
      .map(([date, rateDataForDate]) => ({ date, rate: Number(rateDataForDate[dst]) }))
      .filter(({ rate }) => Number.isFinite(rate) && rate > 0)
      .sort((left, right) => left.date.localeCompare(right.date));
    if (rateData.rateDate && !recentObservations.some(({ date }) => date === rateData.rateDate)) {
      recentObservations.push({ date: rateData.rateDate, rate: currentRate });
      recentObservations.sort((left, right) => left.date.localeCompare(right.date));
    }

    let modelResult;
    try {
      modelResult = await fastApiClient.predictCurrency({
        slug: `${src}/${dst}`,
        current_rate: currentRate,
        recent_observations: recentObservations
      });
    } catch (error) {
      console.warn('[FXForecastingEngine] Trained FX model unavailable:', error.message);
      const forecast = this.unavailableForecast(src, dst, currentRate, rateData, error.message);
      this.cache.set(cacheKey, { forecast, cachedAt: Date.now() });
      return forecast;
    }

    if (modelResult.slug !== `${src}/${dst}`) {
      throw new Error(`The trained FX model returned ${modelResult.slug || 'an unspecified pair'} instead of ${src}/${dst}.`);
    }
    const predictedRate = Number(modelResult.forecasted_rate_next_observation ?? modelResult.forecasted_rate_24h);
    if (!Number.isFinite(predictedRate) || predictedRate <= 0) {
      throw new Error(`The trained FX model returned an invalid ${src}/${dst} prediction.`);
    }
    const predictedReturnPct = Number(modelResult.forecasted_return_pct);
    if (!Number.isFinite(predictedReturnPct)) {
      throw new Error(`The trained FX model returned an invalid ${src}/${dst} return estimate.`);
    }
    const rawValidation = modelResult.historical_validation || {};
    const historicalValidation = {
      status: rawValidation.status,
      source: rawValidation.source,
      evaluationStart: rawValidation.evaluation_start,
      evaluationEnd: rawValidation.evaluation_end,
      observations: Number(rawValidation.observations) || 0,
      directionalAccuracyPct: rawValidation.directional_accuracy_pct ?? null,
      directionalAccuracyInterval95Pct: rawValidation.directional_accuracy_interval_95_pct ?? null,
      maePct: rawValidation.mae_pct ?? null,
      baselineMaePct: rawValidation.baseline_mae_pct ?? null,
      rmsePct: rawValidation.rmse_pct ?? null,
      r2: rawValidation.r2 ?? null,
      reliabilityGatePassed: Boolean(rawValidation.reliability_gate_passed)
    };
    const rawInterval = modelResult.prediction_interval || {};

    const forecast = {
      sourceCurrency: src,
      destinationCurrency: dst,
      currencyPair: `${src}/${dst}`,
      currentRate,
      rateSource: rateData.source,
      rateDate: rateData.rateDate,
      forecastAvailable: true,
      forecastProvider: modelResult.model_metadata?.algorithm || 'HistGradientBoostingRegressor',
      modelTrainingDataThrough: modelResult.model_metadata?.training_data_through || null,
      forecastHorizon: modelResult.forecast_horizon || 'next daily reference-rate observation',
      forecastRate: predictedRate,
      forecastReturnPct: predictedReturnPct,
      forecastUnavailableReason: null,
      predictions: { h24: predictedRate },
      volatilityPct: modelResult.technical_indicators?.volatility_14d_pct ?? null,
      confidencePct: modelResult.confidence_score,
      confidenceType: modelResult.confidence_type,
      predictionInterval: {
        lowerBound: rawInterval.lower_bound ?? null,
        upperBound: rawInterval.upper_bound ?? null,
        confidenceLevel: rawInterval.confidence_level ?? null
      },
      historicalValidation,
      timingAdvisory: modelResult.timing_advisory,
      trendDirection: predictedReturnPct > 0 ? 'BULLISH' : predictedReturnPct < 0 ? 'BEARISH' : 'NEUTRAL',
      movingAverages: null,
      optimalProjectedRate: predictedRate,
      optimalHorizon: 'next daily observation',
      maxImprovementPct: Math.max(0, Number.isFinite(predictedReturnPct) ? predictedReturnPct : 0),
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
      forecastUnavailableReason: `The trained FX model could not produce a forecast: ${reason}`,
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
