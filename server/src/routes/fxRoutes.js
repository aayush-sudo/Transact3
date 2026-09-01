const express = require('express');
const router = express.Router();
const fxController = require('../controllers/fxController');
const { protect } = require('../middleware/auth');
const { validatePaymentQuoteRequest } = require('../middleware/validation');

router.get('/rates/:pair', fxController.getRates);
router.post('/quote', protect, validatePaymentQuoteRequest, fxController.generateQuote);
router.post('/forecast', fxController.getForecast);
router.post('/backtest', fxController.getBacktest);

module.exports = router;
