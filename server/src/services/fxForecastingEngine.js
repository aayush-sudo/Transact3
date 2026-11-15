const fxRateEngine = require('./fxRateEngine');
const { getExchangeRates } = require('./currencyService');

class FXForecastingEngine {
  async predictFXMovements(sourceCurrency, destinationCurrency) {
    const src = String(sourceCurrency || '').toUpperCase();
    const dst = String(destinationCurrency || '').toUpperCase();
    const [currentRate, rateData] = await Promise.all([
      fxRateEngine.getReferenceRate(src, dst),
      getExchangeRates(src)
    ]);

    return {
      sourceCurrency: src,
      destinationCurrency: dst,
      currencyPair: `${src}/${dst}`,
      currentRate,
      rateSource: rateData.source,
      rateDate: rateData.rateDate,
      forecastAvailable: false,
      forecastProvider: null,
      forecastUnavailableReason: 'No independently validated FX forecast provider is connected.',
      predictions: null,
      volatilityPct: null,
      confidencePct: null,
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
        ? 'Speed priority selected; no validated FX forecast provider is connected.'
        : 'No validated FX forecast provider is connected, so the system will not recommend delaying a transfer based on a model projection.',
      forecast
    };
  }
}

module.exports = new FXForecastingEngine();
