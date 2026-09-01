const fxRateEngine = require('../services/fxRateEngine');
const quoteEngine = require('../services/quoteEngine');
const fxForecastingEngine = require('../services/fxForecastingEngine');
const fxBacktestingEngine = require('../services/fxBacktestingEngine');
const orchestrationEngine = require('../services/orchestrationEngine');

exports.getRates = async (req, res, next) => {
  try {
    const pair = req.params.pair || 'USD/EUR';
    const [src, dst] = pair.split('/');
    const quote = await fxRateEngine.calculateFXQuoteAsync(src || 'USD', dst || 'EUR', 1000);
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
