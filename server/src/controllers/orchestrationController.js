const orchestrationEngine = require('../services/orchestrationEngine');
const fxForecastingEngine = require('../services/fxForecastingEngine');
const liquidityManager = require('../services/liquidityManager');
const evaluationEngine = require('../services/evaluationEngine');

exports.previewRoute = async (req, res, next) => {
  try {
    const { sourceCurrency = 'USD', destinationCurrency = 'EUR', amount = 10000, priority = 'BALANCED', maxPermittedDelayHours = 24 } = req.body;
    const result = await orchestrationEngine.routePayment({
      sourceCurrency,
      destinationCurrency,
      amount: Number(amount),
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
    const status = liquidityManager.getAllStatus();
    res.status(200).json({ success: true, data: status });
  } catch (err) {
    next(err);
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
