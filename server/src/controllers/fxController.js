const quoteEngine = require('../services/quoteEngine');
const fxForecastingEngine = require('../services/fxForecastingEngine');
const fxBacktestingEngine = require('../services/fxBacktestingEngine');
const orchestrationEngine = require('../services/orchestrationEngine');
const { createCurrencyConversionQuote } = require('../services/currencyConversionService');
const { isCurrencySupported } = require('../config/currencies');

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
