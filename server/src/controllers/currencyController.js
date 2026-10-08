const { getExchangeRates, getHistoricalRates } = require('../services/currencyService');
const { isCurrencySupported } = require('../config/currencies');

// @desc    Get latest exchange rates
// @route   GET /api/currency/latest?base=USD
// @access  Public
exports.getLatestRates = async (req, res) => {
  try {
    const base = req.query.base || 'USD';
    const data = await getExchangeRates(base);
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch rates' });
  }
};

// @desc    Convert currency
// @route   POST /api/currency/convert
// @access  Public
exports.convertCurrency = async (req, res) => {
  try {
    const { base, target, amount } = req.body;
    const normalizedBase = typeof base === 'string' ? base.toUpperCase() : '';
    const normalizedTarget = typeof target === 'string' ? target.toUpperCase() : '';
    const numericAmount = Number(amount);

    if (!normalizedBase || !normalizedTarget || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide base, target, and amount' });
    }
    if (!isCurrencySupported(normalizedBase) || !isCurrencySupported(normalizedTarget) || numericAmount > 1e12) {
      return res.status(400).json({ success: false, message: 'Unsupported currency or amount is too large' });
    }
    if (normalizedBase === normalizedTarget) {
      return res.status(400).json({ success: false, message: 'Choose two different currencies' });
    }

    const data = await getExchangeRates(normalizedBase);
    
    const rate = data.conversion_rates[normalizedTarget];
    if (!rate) {
      return res.status(400).json({ success: false, message: 'Invalid target currency' });
    }

    const convertedAmount = Number((numericAmount * rate).toFixed(normalizedTarget === 'JPY' ? 0 : 2));

    res.status(200).json({
      success: true,
      base: normalizedBase,
      target: normalizedTarget,
      rate,
      amount: numericAmount,
      convertedAmount,
      source: data.source,
      timestamp: data.timestamp,
      is_mock: data.is_mock
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to convert currency' });
  }
};

// @desc    Get historical rates
// @route   GET /api/currency/history?base=USD&target=EUR
// @access  Public
exports.getHistory = async (req, res) => {
  try {
    const base = req.query.base || 'USD';
    const target = req.query.target || 'EUR';
    const days = parseInt(req.query.days) || 7;
    
    // In a real app, you would loop through dates or call a specific timeframe endpoint
    // We are mocking history via the service if the real API fails (for free tier)
    const data = await getHistoricalRates(base, target, days);
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch historical rates' });
  }
};
