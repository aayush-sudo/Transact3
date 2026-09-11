const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const jwt = require('jsonwebtoken');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// Default initial holdings for new users
const DEFAULT_INITIAL_HOLDINGS = [
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

// @desc    Register a user
// @route   POST /api/user/register
// @access  Public
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, and password' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password,
      walletBalance: 10000
    });

    // Initialize multi-currency portfolio for new user
    await Portfolio.create({
      user: user._id,
      holdings: DEFAULT_INITIAL_HOLDINGS
    });

    res.status(201).json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      walletBalance: user.walletBalance,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Authenticate a user
// @route   POST /api/user/login
// @access  Public
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Check for user email
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Ensure portfolio exists
    const portfolio = await Portfolio.findOne({ user: user._id });
    if (!portfolio) {
      await Portfolio.create({
        user: user._id,
        holdings: DEFAULT_INITIAL_HOLDINGS
      });
    }

    res.json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      walletBalance: user.walletBalance,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user data
// @route   GET /api/user/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all eligible recipients (other Transact3 users)
// @route   GET /api/user/recipients
// @access  Private
exports.getRecipients = async (req, res) => {
  try {
    const currentUserId = req.user ? (req.user._id || req.user.id) : null;
    const query = currentUserId ? { _id: { $ne: currentUserId } } : {};

    const recipients = await User.find(query).select('name email _id createdAt').sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: recipients.length,
      data: recipients
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
