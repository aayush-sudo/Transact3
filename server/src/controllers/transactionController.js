const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { getExchangeRates } = require('../services/currencyService');
const { calculateRiskScore, determineStatus } = require('../utils/riskEngine');

exports.sendTransaction = async (req, res) => {
  try {
    const { receiverEmail, amount, currency, receiverCurrency } = req.body;

    if (!receiverEmail || !amount || !currency || !receiverCurrency) {
      return res.status(400).json({
        success: false,
        message: 'receiverEmail, amount, currency, and receiverCurrency are required',
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0',
      });
    }

    const receiver = await User.findOne({ email: receiverEmail });
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found',
      });
    }

    if (receiver._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send to yourself',
      });
    }

    const ratesData = await getExchangeRates(currency.toUpperCase());
    const targetRate = ratesData.conversion_rates[receiverCurrency.toUpperCase()];

    if (!targetRate) {
      return res.status(400).json({
        success: false,
        message: `Unsupported currency pair: ${currency} → ${receiverCurrency}`,
      });
    }

    const exchangeRate = targetRate;
    const convertedAmount = parseFloat((amount * exchangeRate).toFixed(2));

    const riskScore = await calculateRiskScore(req.user._id, amount);
    const status = determineStatus(riskScore);

    const transaction = await Transaction.create({
      sender: req.user._id,
      receiver: receiver._id,
      amount,
      currency: currency.toUpperCase(),
      receiverCurrency: receiverCurrency.toUpperCase(),
      exchangeRate,
      convertedAmount,
      riskScore,
      status,
    });

    res.status(201).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error('Transaction Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getTransactionHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const userId = req.user._id;

    const filter = {
      $or: [{ sender: userId }, { receiver: userId }],
    };

    if (status) filter.status = status;
    if (type === 'sent') {
      delete filter.$or;
      filter.sender = userId;
    } else if (type === 'received') {
      delete filter.$or;
      filter.receiver = userId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('sender', 'name email')
        .populate('receiver', 'name email'),
      Transaction.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: transactions.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: transactions,
    });
  } catch (error) {
    console.error('History Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
