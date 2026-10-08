const orchestrationEngine = require('../services/orchestrationEngine');
const fxForecastingEngine = require('../services/fxForecastingEngine');
const liquidityManager = require('../services/liquidityManager');
const evaluationEngine = require('../services/evaluationEngine');
const railPricingService = require('../services/railPricingService');
const { isCurrencySupported } = require('../config/currencies');

exports.previewRoute = async (req, res, next) => {
  try {
    const {
      sourceCurrency = 'USD',
      destinationCurrency = 'EUR',
      amount = 10000,
      paymentMode = 'SEND_AMOUNT',
      priority = 'BALANCED',
      maxPermittedDelayHours = 24
    } = req.body;
    const result = await orchestrationEngine.routePayment({
      sourceCurrency,
      destinationCurrency,
      amount: Number(amount),
      paymentMode,
      priority,
      maxPermittedDelayHours: Number(maxPermittedDelayHours)
    });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.getFXForecast = async (req, res, next) => {
  try {
    const { sourceCurrency = 'USD', destinationCurrency = 'INR' } = req.body;
    const forecast = await fxForecastingEngine.predictFXMovements(sourceCurrency, destinationCurrency);
    res.status(200).json({ success: true, data: forecast });
  } catch (err) {
    next(err);
  }
};

exports.getRailsStatus = async (req, res, next) => {
  try {
    const status = await liquidityManager.getAllRailSettings();
    res.status(200).json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
};

exports.getProviderQuotes = async (req, res, next) => {
  try {
    const sourceCurrency = String(req.body.sourceCurrency || '').toUpperCase();
    const destinationCurrency = String(req.body.destinationCurrency || '').toUpperCase();
    const amount = Number(req.body.amount);
    if (!isCurrencySupported(sourceCurrency) || !isCurrencySupported(destinationCurrency)) {
      return res.status(400).json({ success: false, message: 'Unsupported currency pair for provider comparisons.' });
    }
    if (sourceCurrency === destinationCurrency) {
      return res.status(400).json({ success: false, message: 'Choose two different currencies.' });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
      return res.status(400).json({ success: false, message: 'Enter an amount between 0.01 and 10,000,000.' });
    }

    const comparison = await railPricingService.fetchLiveMarketQuotes(sourceCurrency, destinationCurrency, amount);
    res.status(200).json({
      success: true,
      data: {
        ...comparison,
        sourceCurrency,
        destinationCurrency,
        sendAmount: amount
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.runEvaluation = async (req, res, next) => {
  try {
    const { batchSize = 100 } = req.body;
    const evaluation = await evaluationEngine.runEvaluationBenchmark(Number(batchSize));
    res.status(200).json({ success: true, data: evaluation });
  } catch (err) {
    next(err);
  }
};
