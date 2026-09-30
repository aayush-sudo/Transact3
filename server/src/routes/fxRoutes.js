const express = require('express');
const router = express.Router();
const fxController = require('../controllers/fxController');
const { protect, validatePaymentQuoteRequest } = require('../middleware');

router.get('/rates/:pair', fxController.getRates);
router.post('/quote', protect, validatePaymentQuoteRequest, fxController.generateQuote);
router.post('/forecast', fxController.getForecast);
router.post('/backtest', fxController.getBacktest);

module.exports = router;
