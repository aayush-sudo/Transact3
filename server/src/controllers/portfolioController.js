const Portfolio = require('../models/Portfolio');
const User = require('../models/User');
const ledgerEngine = require('../services/ledgerEngine');
const { getExchangeRates } = require('../services/currencyService');
const { isCurrencySupported, SUPPORTED_CURRENCY_CODES } = require('../config/currencies');
const { roundToPrecision, safeAdd, safeSubtract } = require('../utils/mathUtils');

const DEFAULT_PORTFOLIO_HOLDINGS = [
  { currency: 'USD', amount: 10000, averageBuyPrice: 1.0 },
  { currency: 'EUR', amount: 2000, averageBuyPrice: 1.08 },
  { currency: 'GBP', amount: 500, averageBuyPrice: 1.27 },
  { currency: 'INR', amount: 100000, averageBuyPrice: 0.0115 },
  { currency: 'AED', amount: 5000, averageBuyPrice: 0.272 },
  { currency: 'SGD', amount: 2500, averageBuyPrice: 0.74 },
  { currency: 'AUD', amount: 2000, averageBuyPrice: 0.66 },
  { currency: 'CAD', amount: 2000, averageBuyPrice: 0.735 },
  { currency: 'JPY', amount: 500000, averageBuyPrice: 0.0066 }
];

// Helper to get or initialize a user's portfolio
async function getOrCreatePortfolio(userId) {
  let portfolio = await Portfolio.findOne({ user: userId });
  if (!portfolio) {
    portfolio = await Portfolio.create({
      user: userId,
      holdings: DEFAULT_PORTFOLIO_HOLDINGS
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

// @desc    Add simulated funds to a holding & record in double-entry ledger
// @route   POST /api/portfolio/holdings
// @access  Private
exports.addHolding = async (req, res) => {
  try {
    const userId = req.user ? (req.user._id || req.user.id) : null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const { currency, amount } = req.body;
    const depositAmount = Number(amount);

    if (!currency || !isCurrencySupported(currency)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported currency '${currency}'. Supported currencies: ${SUPPORTED_CURRENCY_CODES.join(', ')}`
      });
    }

    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Deposit amount must be a positive number'
      });
    }

    const curr = currency.toUpperCase();
    const portfolio = await getOrCreatePortfolio(userId);

    const holding = portfolio.holdings.find(h => h.currency === curr);
    if (holding) {
      holding.amount = safeAdd(holding.amount, depositAmount);
    } else {
      portfolio.holdings.push({ currency: curr, amount: depositAmount, averageBuyPrice: 1.0 });
    }

    await portfolio.save();

    // If depositing USD, also sync User.walletBalance
    if (curr === 'USD') {
      await User.findByIdAndUpdate(userId, { $inc: { walletBalance: depositAmount } });
    }

    // Record simulated deposit in Double-Entry Ledger
    await ledgerEngine.recordDeposit({
      userId,
      userEmail: req.user.email,
      currency: curr,
      amount: depositAmount,
      description: `Simulated User Deposit: +${depositAmount} ${curr}`
    });

    res.status(200).json({
      success: true,
      message: `Successfully deposited ${depositAmount} ${curr} into your wallet. Financial ledger entry recorded.`,
      data: portfolio
    });
  } catch (error) {
    console.error('[PortfolioController] Deposit error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update holding' });
  }
};

// Atomic Helper: Debit user wallet
exports.debitUserWallet = async (userId, currency, amount) => {
  const curr = currency.toUpperCase();
  const debitAmount = roundToPrecision(amount, 2);

  const portfolio = await getOrCreatePortfolio(userId);
  const holding = portfolio.holdings.find(h => h.currency === curr);

  if (!holding || holding.amount < debitAmount) {
    const available = holding ? holding.amount : 0;
    throw new Error(`Insufficient ${curr} balance: Available ${available}, required ${debitAmount}`);
  }

  holding.amount = safeSubtract(holding.amount, debitAmount);
  await portfolio.save();

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
