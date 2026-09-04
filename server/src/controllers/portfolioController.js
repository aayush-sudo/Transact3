const Portfolio = require('../models/Portfolio');
const { getExchangeRates } = require('../services/currencyService');

// @desc    Get user portfolio
// @route   GET /api/portfolio
// @access  Private
exports.getPortfolio = async (req, res) => {
  try {
    const userId = req.user ? (req.user._id || req.user.id) : '60c72b2f9b1d8b0015f8e001';
    let portfolio = null;

    try {
      if (Portfolio.findOne) {
        portfolio = await Portfolio.findOne({ user: userId });
      }
    } catch (e) {}

    if (!portfolio) {
      // Default initial multi-currency holdings
      const defaultHoldings = [
        { currency: 'USD', amount: 50000, averageBuyPrice: 1.0 },
        { currency: 'EUR', amount: 20000, averageBuyPrice: 1.08 },
        { currency: 'GBP', amount: 15000, averageBuyPrice: 1.27 },
        { currency: 'JPY', amount: 1500000, averageBuyPrice: 0.0066 },
        { currency: 'INR', amount: 1000000, averageBuyPrice: 0.012 }
      ];

      try {
        if (Portfolio.create) {
          portfolio = await Portfolio.create({ user: userId, holdings: defaultHoldings });
        }
      } catch (createErr) {
        portfolio = { user: userId, holdings: defaultHoldings };
      }
    }

    const ratesData = await getExchangeRates('USD');
    const rates = (ratesData && ratesData.conversion_rates) || { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 151.5, INR: 83.2 };

    let totalValueUSD = 0;
    const holdings = portfolio.holdings || [];
    const enrichedHoldings = holdings.map(holding => {
      const currentRate = rates[holding.currency] || 1;
      const valueInUSD = holding.amount / currentRate;
      totalValueUSD += valueInUSD;

      const profitLoss = valueInUSD - (holding.amount * (holding.averageBuyPrice || 1));

      return {
        _id: holding._id,
        currency: holding.currency,
        amount: parseFloat(Number(holding.amount).toFixed(2)),
        averageBuyPrice: holding.averageBuyPrice || 1,
        currentValueUSD: parseFloat(valueInUSD.toFixed(2)),
        profitLoss: parseFloat(profitLoss.toFixed(2))
      };
    });

    res.status(200).json({
      success: true,
      data: {
        _id: portfolio._id,
        user: userId,
        holdings: enrichedHoldings,
        totalValueUSD: parseFloat(totalValueUSD.toFixed(2))
      }
    });
  } catch (error) {
    console.error('[PortfolioController] Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch portfolio' });
  }
};

// @desc    Add or update a holding
// @route   POST /api/portfolio/holdings
// @access  Private
exports.addHolding = async (req, res) => {
  try {
    const { currency, amount, averageBuyPrice } = req.body;

    if (!currency || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide currency and amount' });
    }

    let portfolio = await Portfolio.findOne({ user: req.user.id });

    if (!portfolio) {
      portfolio = new Portfolio({ user: req.user.id, holdings: [] });
    }

    const holdingIndex = portfolio.holdings.findIndex(h => h.currency === currency);

    if (holdingIndex > -1) {
      // Update existing holding
      const existingHolding = portfolio.holdings[holdingIndex];
      const newTotalAmount = existingHolding.amount + amount;
      
      // Calculate new average buy price if adding more
      if (amount > 0 && averageBuyPrice) {
        const totalCost = (existingHolding.amount / existingHolding.averageBuyPrice) + (amount / averageBuyPrice);
        existingHolding.averageBuyPrice = newTotalAmount / totalCost;
      }
      
      existingHolding.amount = newTotalAmount;
      
      // Remove holding if amount is 0 or less
      if (existingHolding.amount <= 0) {
        portfolio.holdings.splice(holdingIndex, 1);
      }
    } else {
      // Add new holding
      if (amount > 0) {
        portfolio.holdings.push({
          currency,
          amount,
          averageBuyPrice: averageBuyPrice || 1
        });
      }
    }

    await portfolio.save();

    res.status(200).json({
      success: true,
      data: portfolio
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update holding' });
  }
};
