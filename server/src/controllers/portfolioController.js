const Portfolio = require('../models/Portfolio');
const { getExchangeRates } = require('../services/currencyService');

// @desc    Get user portfolio
// @route   GET /api/portfolio
// @access  Private
exports.getPortfolio = async (req, res) => {
  try {
    let portfolio = await Portfolio.findOne({ user: req.user.id });

    if (!portfolio) {
      portfolio = await Portfolio.create({ user: req.user.id, holdings: [] });
    }

    // Optionally calculate current value based on latest exchange rates
    // Fetch rates base USD
    const ratesData = await getExchangeRates('USD');
    const rates = ratesData.conversion_rates;

    let totalValueUSD = 0;
    const enrichedHoldings = portfolio.holdings.map(holding => {
      const currentRate = rates[holding.currency] || 1;
      // Convert holding amount to USD (Base)
      const valueInUSD = holding.amount / currentRate; 
      totalValueUSD += valueInUSD;
      
      const profitLoss = valueInUSD - (holding.amount / holding.averageBuyPrice);

      return {
        ...holding._doc,
        currentValueUSD: valueInUSD,
        profitLoss
      };
    });

    res.status(200).json({
      success: true,
      data: {
        _id: portfolio._id,
        user: portfolio.user,
        holdings: enrichedHoldings,
        totalValueUSD
      }
    });
  } catch (error) {
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
