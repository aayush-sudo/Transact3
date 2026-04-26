const express = require('express');
const router = express.Router();
const { getLatestRates, convertCurrency, getHistory } = require('../controllers/currencyController');

router.get('/latest', getLatestRates);
router.post('/convert', convertCurrency);
router.get('/history', getHistory);

module.exports = router;
