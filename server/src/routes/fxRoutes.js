const express = require('express');
const router = express.Router();
const fxController = require('../controllers/fxController');
const { protect, validatePaymentQuoteRequest } = require('../middleware');

router.get('/currencies', fxController.getForecastCurrencies);
router.get('/pairs', fxController.getForecastPairs);
router.get('/rates/:pair', fxController.getRates);
router.post('/history', fxController.getHistory);
router.post('/quote', protect, validatePaymentQuoteRequest, fxController.generateQuote);
router.post('/forecast', fxController.getForecast);
router.post('/backtest', fxController.getBacktest);

module.exports = router;
