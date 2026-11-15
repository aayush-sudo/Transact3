const quoteEngine = require('../services/quoteEngine');
const fxForecastingEngine = require('../services/fxForecastingEngine');
const fxBacktestingEngine = require('../services/fxBacktestingEngine');
const orchestrationEngine = require('../services/orchestrationEngine');
const { createCurrencyConversionQuote } = require('../services/currencyConversionService');
const { isCurrencySupported } = require('../config/currencies');
const { getExchangeRates, getHistoricalRates } = require('../services/currencyService');

exports.getRates = async (req, res, next) => {
  try {
    const pair = req.params.pair || 'USD/EUR';
    const [src = 'USD', dst = 'EUR'] = pair.split(/[/-]/);
    const sourceCurrency = src.toUpperCase();
    const destinationCurrency = dst.toUpperCase();
    const amount = Number(req.query.amount ?? 1000);
    if (!isCurrencySupported(sourceCurrency) || !isCurrencySupported(destinationCurrency)) {
      return res.status(400).json({ success: false, message: 'Unsupported currency pair.' });
    }
    if (sourceCurrency === destinationCurrency || !Number.isFinite(amount) || amount <= 0 || amount > 1e12) {
      return res.status(400).json({ success: false, message: 'Choose different currencies and provide a valid amount.' });
    }
    const quote = await createCurrencyConversionQuote(sourceCurrency, destinationCurrency, amount);
    res.status(200).json({ success: true, data: quote });
  } catch (err) {
    next(err);
  }
};

exports.getHistory = async (req, res, next) => {
  try {
    const { baseCurrency, targetCurrency, days = 30 } = req.body;
    const base = String(baseCurrency || '').toUpperCase();
    const target = String(targetCurrency || '').toUpperCase();
    const count = Number(days);

    if (!isCurrencySupported(base) || !isCurrencySupported(target) || base === target) {
      return res.status(400).json({ success: false, message: 'Choose a supported pair of different currencies.' });
    }
    if (!Number.isInteger(count) || count < 1 || count > 365) {
      return res.status(400).json({ success: false, message: 'History days must be an integer from 1 to 365.' });
    }

    const [currentData, historyData] = await Promise.all([
      getExchangeRates(base),
      getHistoricalRates(base, target, count)
    ]);
    const currentRate = Number(currentData.conversion_rates?.[target]);
    if (!Number.isFinite(currentRate) || currentRate <= 0) {
      throw new Error(`No reference rate is available for ${base}/${target}.`);
    }

    const observations = Object.entries(historyData.conversion_rates)
      .map(([date, rateData]) => ({ date, rate: Number(rateData[target]) }))
      .filter((observation) => Number.isFinite(observation.rate) && observation.rate > 0)
      .sort((left, right) => left.date.localeCompare(right.date));
    if (currentData.rateDate && !observations.some((observation) => observation.date === currentData.rateDate)) {
      observations.push({ date: currentData.rateDate, rate: currentRate });
      observations.sort((left, right) => left.date.localeCompare(right.date));
    }

    res.status(200).json({
      success: true,
      data: {
        baseCurrency: base,
        targetCurrency: target,
        currencyPair: `${base}/${target}`,
        currentRate,
        rateDate: currentData.rateDate,
        source: currentData.source,
        observations
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.generateQuote = async (req, res, next) => {
  try {
    const { sourceCurrency, destinationCurrency, amount, priority } = req.body;
    const orchestrationResult = await orchestrationEngine.routePayment({
      sourceCurrency,
      destinationCurrency,
      amount: Number(amount),
      priority
    });

    const quote = await quoteEngine.createQuote({
      userId: req.user ? req.user._id : null,
      sourceCurrency,
      destinationCurrency,
      sourceAmount: Number(amount),
      orchestrationResult
    });

    res.status(200).json({ success: true, data: quote, orchestration: orchestrationResult });
  } catch (err) {
    next(err);
  }
};

exports.getForecast = async (req, res, next) => {
  try {
    const { sourceCurrency = 'USD', destinationCurrency = 'EUR' } = req.body;
    const forecast = await fxForecastingEngine.predictFXMovements(sourceCurrency, destinationCurrency);
    res.status(200).json({ success: true, data: forecast });
  } catch (err) {
    next(err);
  }
};

exports.getBacktest = async (req, res, next) => {
  try {
    const { baseCurrency = 'USD', targetCurrency = 'INR', days = 30 } = req.body;
    const backtest = await fxBacktestingEngine.runBacktest(baseCurrency, targetCurrency, Number(days));
    res.status(200).json({ success: true, data: backtest });
  } catch (err) {
    next(err);
  }
};
