const Portfolio = require('../models/Portfolio');
const User = require('../models/User');
const { getExchangeRates } = require('../services/currencyService');
const { SUPPORTED_CURRENCY_CODES } = require('../config/currencies');
const { roundToPrecision, safeAdd, safeSubtract } = require('../utils/mathUtils');

// Helper to get or initialize a user's portfolio
async function getOrCreatePortfolio(userId) {
  let portfolio = await Portfolio.findOne({ user: userId });
  if (!portfolio) {
    portfolio = await Portfolio.create({
      user: userId,
      holdings: SUPPORTED_CURRENCY_CODES.map(currency => ({
        currency,
        amount: 0,
        averageBuyPrice: 1
      }))
    });
  }

  // Ensure all 9 supported currencies exist in holdings
  const existingCodes = new Set(portfolio.holdings.map(h => h.currency));
  let modified = false;
  for (const code of SUPPORTED_CURRENCY_CODES) {
    if (!existingCodes.has(code)) {
      portfolio.holdings.push({ currency: code, amount: 0, averageBuyPrice: 1.0 });
      modified = true;
    }
  }
  if (modified) {
    await portfolio.save();
  }

  return portfolio;
}

// @desc    Get user portfolio & multi-currency holdings
// @route   GET /api/portfolio
// @access  Private
exports.getPortfolio = async (req, res) => {
  try {
    const userId = req.user ? (req.user._id || req.user.id) : null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const portfolio = await getOrCreatePortfolio(userId);
    const ratesData = await getExchangeRates('USD');
    const rates = (ratesData && ratesData.conversion_rates) || {};

    let totalValueUSD = 0;
    const enrichedHoldings = portfolio.holdings.map(h => {
      const code = h.currency.toUpperCase();
      const amount = roundToPrecision(h.amount, 2);
      const rateToUSD = rates[code] || 1.0;
      const valueInUSD = rateToUSD > 0 ? (amount / rateToUSD) : amount;
      totalValueUSD += valueInUSD;

      return {
        _id: h._id,
        currency: code,
        amount,
        rateToUSD: roundToPrecision(rateToUSD, 4),
        currentValueUSD: roundToPrecision(valueInUSD, 2),
      };
    });

    res.status(200).json({
      success: true,
      data: {
        _id: portfolio._id,
        user: userId,
        holdings: enrichedHoldings,
        totalValueUSD: roundToPrecision(totalValueUSD, 2)
      }
    });
  } catch (error) {
    console.error('[PortfolioController] Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch portfolio' });
  }
};

// Atomic Helper: Debit user wallet
exports.debitUserWallet = async (userId, currency, amount) => {
  const curr = currency.toUpperCase();
  const debitAmount = roundToPrecision(amount, 2);

  const portfolio = await getOrCreatePortfolio(userId);
  const updated = await Portfolio.findOneAndUpdate(
    { _id: portfolio._id, holdings: { $elemMatch: { currency: curr, amount: { $gte: debitAmount } } } },
    { $inc: { 'holdings.$.amount': -debitAmount } },
    { new: true }
  );
  if (!updated) {
    const holding = portfolio.holdings.find(item => item.currency === curr);
    throw new Error(`Insufficient ${curr} balance: Available ${holding ? holding.amount : 0}, required ${debitAmount}`);
  }
  const holding = updated.holdings.find(item => item.currency === curr);

  if (curr === 'USD') {
    await User.findByIdAndUpdate(userId, { $inc: { walletBalance: -debitAmount } });
  }

  return holding.amount;
};

// Atomic Helper: Credit user wallet
exports.creditUserWallet = async (userId, currency, amount) => {
  const curr = currency.toUpperCase();
  const creditAmount = roundToPrecision(amount, 2);

  const portfolio = await getOrCreatePortfolio(userId);
  const holding = portfolio.holdings.find(h => h.currency === curr);

  if (holding) {
    holding.amount = safeAdd(holding.amount, creditAmount);
  } else {
    portfolio.holdings.push({ currency: curr, amount: creditAmount, averageBuyPrice: 1.0 });
  }

  await portfolio.save();

  if (curr === 'USD') {
    await User.findByIdAndUpdate(userId, { $inc: { walletBalance: creditAmount } });
  }

  return holding ? holding.amount : creditAmount;
};

// Helper: Check balance
exports.checkUserBalance = async (userId, currency) => {
  const curr = currency.toUpperCase();
  const portfolio = await getOrCreatePortfolio(userId);
  const holding = portfolio.holdings.find(h => h.currency === curr);
  return holding ? holding.amount : 0;
};
