const crypto = require('crypto');
const axios = require('axios');
const WalletFunding = require('../models/WalletFunding');
const Portfolio = require('../models/Portfolio');
const ledgerEngine = require('../services/ledgerEngine');
const { SUPPORTED_CURRENCY_CODES } = require('../config/currencies');

const gatewayConfig = () => {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    const error = new Error('Wallet funding is not configured. Add Razorpay test keys to the server environment.');
    error.statusCode = 503;
    throw error;
  }
  return { keyId: RAZORPAY_KEY_ID, keySecret: RAZORPAY_KEY_SECRET };
};

const gatewayRequest = async (method, path, data, config) => {
  const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');
  try {
    return await axios({
      method,
      url: `https://api.razorpay.com/v1${path}`,
      data,
      headers: { Authorization: `Basic ${auth}` },
      timeout: 15000
    });
  } catch {
    const error = new Error('Razorpay could not complete the request. Check the test credentials and payment status.');
    error.statusCode = 502;
    throw error;
  }
};

exports.createFundingOrder = async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    const amountPaise = Math.round(amount * 100);
    if (!Number.isFinite(amount) || amountPaise < 100 || Math.abs(amount * 100 - amountPaise) > 0.00001) {
      return res.status(400).json({ success: false, message: 'Enter a valid INR amount of at least ₹1.00.' });
    }
    if (amountPaise > 10000000) {
      return res.status(400).json({ success: false, message: 'A single wallet top-up cannot exceed ₹100,000.' });
    }

    const config = gatewayConfig();
    const { data: order } = await gatewayRequest('post', '/orders', {
      amount: amountPaise,
      currency: 'INR',
      receipt: `t3_${req.user._id}_${Date.now()}`,
      payment_capture: 1
    }, config);
    await WalletFunding.create({
      userId: req.user._id,
      orderId: order.id,
      amountPaise,
      currency: order.currency
    });
    res.status(201).json({
      success: true,
      data: { keyId: config.keyId, orderId: order.id, amount: order.amount, currency: order.currency }
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyFundingPayment = async (req, res, next) => {
  let funding;
  let paymentCaptured = false;
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
    if (![orderId, paymentId, signature].every(value => typeof value === 'string' && value.length > 0)) {
      return res.status(400).json({ success: false, message: 'Payment verification details are incomplete.' });
    }

    funding = await WalletFunding.findOne({ orderId, userId: req.user._id });
    if (!funding) {
      return res.status(404).json({ success: false, message: 'Wallet funding order was not found.' });
    }
    if (funding.status === 'CREDITED') {
      return res.status(200).json({ success: true, message: 'Wallet funding is complete.', data: { amount: funding.amountPaise / 100 } });
    }
    if (!['ORDER_CREATED', 'CAPTURED'].includes(funding.status)) {
      return res.status(409).json({ success: false, message: 'This payment is already being verified.' });
    }

    const claimed = await WalletFunding.findOneAndUpdate(
      { _id: funding._id, status: funding.status },
      { status: 'VERIFYING', paymentId, creditingAt: new Date() },
      { new: true }
    );
    if (!claimed) {
      return res.status(409).json({ success: false, message: 'This payment is already being verified.' });
    }
    funding = claimed;

    const config = gatewayConfig();
    const expectedSignature = crypto
      .createHmac('sha256', config.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest();
    const suppliedSignature = Buffer.from(signature, 'hex');
    if (suppliedSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(expectedSignature, suppliedSignature)) {
      await WalletFunding.updateOne(
        { _id: funding._id, status: 'VERIFYING' },
        { status: 'ORDER_CREATED', $unset: { paymentId: 1 } }
      );
      return res.status(400).json({ success: false, message: 'Payment signature verification failed.' });
    }

    let { data: payment } = await gatewayRequest('get', `/payments/${encodeURIComponent(paymentId)}`, undefined, config);
    if (payment.order_id !== orderId || payment.amount !== funding.amountPaise || payment.currency !== 'INR') {
      await WalletFunding.updateOne({ _id: funding._id, status: 'VERIFYING' }, { status: 'FAILED' });
      return res.status(400).json({ success: false, message: 'Payment does not match this wallet funding order.' });
    }
    if (payment.status === 'authorized') {
      ({ data: payment } = await gatewayRequest('post', `/payments/${encodeURIComponent(paymentId)}/capture`, {
        amount: funding.amountPaise,
        currency: 'INR'
      }, config));
    }
    if (payment.status !== 'captured') {
      await WalletFunding.updateOne(
        { _id: funding._id, status: 'VERIFYING' },
        { status: 'ORDER_CREATED', $unset: { paymentId: 1 } }
      );
      return res.status(409).json({ success: false, message: 'Payment has not been captured. You can retry verification shortly.' });
    }

    paymentCaptured = true;
    await WalletFunding.updateOne({ _id: funding._id, status: 'VERIFYING' }, { status: 'CAPTURED' });
    const portfolio = await Portfolio.findOneAndUpdate(
      { user: req.user._id },
      {
        $setOnInsert: {
          holdings: SUPPORTED_CURRENCY_CODES.map(currency => ({
            currency,
            amount: 0,
            averageBuyPrice: 1
          }))
        }
      },
      { new: true, upsert: true }
    );
    const applied = await Portfolio.findOneAndUpdate(
      { user: req.user._id, appliedFundingIds: { $ne: orderId }, 'holdings.currency': 'INR' },
      {
        $inc: { 'holdings.$.amount': funding.amountPaise / 100 },
        $addToSet: { appliedFundingIds: orderId }
      },
      { new: true }
    );
    if (!applied && !portfolio.appliedFundingIds.includes(orderId)) {
      throw new Error('Could not credit the verified payment to the wallet.');
    }
    await ledgerEngine.recordDeposit({
      userId: req.user._id,
      userEmail: req.user.email,
      currency: 'INR',
      amount: funding.amountPaise / 100,
      description: `Razorpay payment ${paymentId}`,
      externalReference: orderId
    });
    await WalletFunding.updateOne({ _id: funding._id }, { status: 'CREDITED' });
    res.status(200).json({
      success: true,
      message: 'Wallet funded successfully.',
      data: { amount: funding.amountPaise / 100 }
    });
  } catch (error) {
    if (funding?._id) {
      try {
        await WalletFunding.updateOne(
          { _id: funding._id, status: 'VERIFYING' },
          paymentCaptured
            ? { status: 'CAPTURED', creditingAt: new Date() }
            : { status: 'ORDER_CREATED', $unset: { creditingAt: 1, paymentId: 1 } }
        );
      } catch (recoveryError) {
        console.error('[WalletFunding] Could not reset payment verification state:', recoveryError.message);
      }
    }
    next(error);
  }
};

exports.getFundingStatus = async (req, res, next) => {
  try {
    const funding = await WalletFunding.findOne({
      orderId: req.params.orderId,
      userId: req.user._id
    }).select('amountPaise currency status');
    if (!funding) return res.status(404).json({ success: false, message: 'Wallet funding order was not found.' });
    res.json({ success: true, data: funding });
  } catch (error) {
    next(error);
  }
};
