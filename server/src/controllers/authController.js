const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const { provisionNewUserWallet } = require('../services/walletProvisioning');
const { isDemoVerificationEnabled } = require('../config/demoVerification');
const jwt = require('jsonwebtoken');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;
const EMAIL_POLICY = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// @desc    Register a user
// @route   POST /api/user/register
// @access  Public
exports.registerUser = async (req, res, next) => {
  try {
    const { name, email, password, accountCountry } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, and password' });
    }
    if (typeof email !== 'string' || !EMAIL_POLICY.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }
    if (accountCountry != null && accountCountry !== '' && (
      typeof accountCountry !== 'string' || !/^[A-Za-z]{2}$/.test(accountCountry.trim())
    )) {
      return res.status(400).json({ success: false, message: 'Account country must be a two-letter ISO country code' });
    }
    if (
      typeof password !== 'string' ||
      !PASSWORD_POLICY.test(password) ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(400).json({
        success: false,
        message: 'Password must be 8–72 characters and include uppercase, lowercase, a number, and a symbol'
      });
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
      accountCountry: accountCountry ? accountCountry.trim().toUpperCase() : null,
      walletBalance: 0
    });

    // Initialize multi-currency portfolio for new user
    await provisionNewUserWallet(user);

    res.status(201).json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      walletBalance: user.walletBalance,
      accountCountry: user.accountCountry,
      accountCountryVerified: user.accountCountryVerified,
      accountCountryVerificationSource: user.accountCountryVerificationSource,
      kycStatus: user.kycStatus,
      kycVerificationSource: user.kycVerificationSource,
      demoVerificationEnabled: isDemoVerificationEnabled(),
      token: generateToken(user._id),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate a user
// @route   POST /api/user/login
// @access  Public
exports.loginUser = async (req, res, next) => {
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
      await provisionNewUserWallet(user);
    }

    res.json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      walletBalance: user.walletBalance,
      accountCountry: user.accountCountry,
      accountCountryVerified: user.accountCountryVerified,
      accountCountryVerificationSource: user.accountCountryVerificationSource,
      kycStatus: user.kycStatus,
      kycVerificationSource: user.kycVerificationSource,
      demoVerificationEnabled: isDemoVerificationEnabled(),
      token: generateToken(user._id),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Set the account's declared country; only a trusted verification process can verify it
// @route   PATCH /api/user/account-country
// @access  Private
exports.updateAccountCountry = async (req, res, next) => {
  try {
    const { accountCountry } = req.body;
    if (typeof accountCountry !== 'string' || !/^[A-Za-z]{2}$/.test(accountCountry.trim())) {
      return res.status(400).json({ success: false, message: 'Account country must be a two-letter ISO country code' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.accountCountry = accountCountry.trim().toUpperCase();
    user.accountCountryVerified = false;
    user.accountCountryVerificationSource = 'NONE';
    user.kycStatus = 'NOT_STARTED';
    user.kycVerificationSource = 'NONE';
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        accountCountry: user.accountCountry,
        accountCountryVerified: user.accountCountryVerified,
        accountCountryVerificationSource: user.accountCountryVerificationSource,
        kycStatus: user.kycStatus,
        kycVerificationSource: user.kycVerificationSource
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Simulate account-country and KYC verification for local/demo use only
// @route   POST /api/user/demo-verification
// @access  Private; disabled in production
exports.completeDemoVerification = async (req, res, next) => {
  try {
    if (!isDemoVerificationEnabled()) {
      return res.status(404).json({ success: false, message: 'Demo verification is not enabled' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!user.accountCountry) {
      return res.status(400).json({ success: false, message: 'Set your account country before running demo verification' });
    }

    user.accountCountryVerified = true;
    user.accountCountryVerificationSource = 'DEMO';
    user.kycStatus = 'VERIFIED';
    user.kycVerificationSource = 'DEMO';
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Demo verification completed. This is simulated and is not real KYC.',
      data: {
        accountCountry: user.accountCountry,
        accountCountryVerified: user.accountCountryVerified,
        accountCountryVerificationSource: user.accountCountryVerificationSource,
        kycStatus: user.kycStatus,
        kycVerificationSource: user.kycVerificationSource
      }
    });
  } catch (error) {
    next(error);
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
      data: { ...user.toObject(), demoVerificationEnabled: isDemoVerificationEnabled() },
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

    const recipients = await User.find(query)
      .select('name email _id createdAt accountCountry accountCountryVerified accountCountryVerificationSource kycStatus kycVerificationSource')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: recipients.length,
      data: recipients
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
