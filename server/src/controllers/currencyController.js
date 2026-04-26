const { getExchangeRates, getHistoricalRates } = require('../services/currencyService');

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
    
    if (!base || !target || !amount) {
      return res.status(400).json({ success: false, message: 'Please provide base, target, and amount' });
    }

    const data = await getExchangeRates(base);
    
    const rate = data.conversion_rates[target];
    if (!rate) {
      return res.status(400).json({ success: false, message: 'Invalid target currency' });
    }

    const convertedAmount = (amount * rate).toFixed(2);

    res.status(200).json({
      success: true,
      base,
      target,
      rate,
      amount,
      convertedAmount
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
