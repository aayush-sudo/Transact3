const { getHistoricalRates } = require('./currencyService');

class FXBacktestingEngine {
  async runBacktest(baseCurrency = 'USD', targetCurrency = 'INR', days = 30) {
    const base = String(baseCurrency || '').toUpperCase();
    const target = String(targetCurrency || '').toUpperCase();
    const requestedDays = Number(days);
    if (!Number.isInteger(requestedDays) || requestedDays < 1 || requestedDays > 365) {
      throw new Error('Backtest days must be an integer from 1 to 365.');
    }

    const history = await getHistoricalRates(base, target, requestedDays + 1);
    const rates = Object.entries(history.conversion_rates)
      .map(([date, rateData]) => ({ date, rate: Number(rateData[target]) }))
      .filter(({ rate }) => Number.isFinite(rate) && rate > 0)
      .sort((left, right) => left.date.localeCompare(right.date));
    if (rates.length < 2) {
      throw new Error(`Not enough historical observations to backtest ${base}/${target}.`);
    }

    const observations = [];
    let absoluteErrorPctTotal = 0;
    let squaredErrorPctTotal = 0;

    for (let index = 1; index < rates.length; index += 1) {
      const previous = rates[index - 1];
      const actual = rates[index];
      const errorPct = Math.abs((previous.rate - actual.rate) / actual.rate) * 100;
      absoluteErrorPctTotal += errorPct;
      squaredErrorPctTotal += errorPct ** 2;
      observations.push({
        date: actual.date,
        predictedRate: previous.rate,
        actualRate: actual.rate,
        errorPct: Number(errorPct.toFixed(5))
      });
    }

    const count = observations.length;
    return {
      pair: `${base}/${target}`,
      model: 'PERSISTENCE_BASELINE',
      source: history.source,
      testPeriodDays: count,
      metrics: {
        maePct: Number((absoluteErrorPctTotal / count).toFixed(5)),
        rmsePct: Number((Math.sqrt(squaredErrorPctTotal / count)).toFixed(5)),
        directionalAccuracyPct: null,
        timingSuccessRatePct: null,
        avgSavingsBps: null
      },
      sampleObservations: observations.slice(-7)
    };
  }
}

module.exports = new FXBacktestingEngine();
