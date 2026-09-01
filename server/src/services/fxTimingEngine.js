const fxForecastingEngine = require('./fxForecastingEngine');

class FXTimingEngine {
  async evaluateTiming(sourceCurrency, destinationCurrency, userPriority = 'BALANCED', maxPermittedDelayHours = 24) {
    const forecast = await fxForecastingEngine.predictFXMovements(sourceCurrency, destinationCurrency);

    // If speed is top priority or max permitted delay is 0, execute immediately
    if (userPriority === 'SPEED' || maxPermittedDelayHours <= 0) {
      return {
        recommendation: 'EXECUTE_NOW',
        deferHours: 0,
        expectedSavingsPct: 0.0,
        reason: 'Payment urgency/speed priority requires immediate execution',
        forecast
      };
    }

    // High volatility threshold: execute immediately to lock rate
    if (forecast.volatilityPct > 0.6) {
      return {
        recommendation: 'EXECUTE_NOW',
        deferHours: 0,
        expectedSavingsPct: 0.0,
        reason: 'High market volatility (>0.60%) — lock conversion rate now to prevent adverse slippage',
        forecast
      };
    }

    // If expected FX improvement is above minimum threshold (>0.12%)
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

module.exports = new FXTimingEngine();
