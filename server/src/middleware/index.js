const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const IdempotencyRecord = require('../models/IdempotencyRecord');
const SUPPORTED_CURRENCIES = require('../config/currencies');
const { isCorridorSupported, getCorridorConfig } = require('../config/corridors');

// ====================================================================
// 1. Request ID Middleware
// ====================================================================
const requestId = (req, res, next) => {
  const reqId = req.headers['x-request-id'] || `REQ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  req.requestId = reqId;
  res.setHeader('X-Request-ID', reqId);
  next();
};

// ====================================================================
// 2. In-Memory Rate Limiter Middleware
// ====================================================================
const requestCounts = new Map();
const rateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute
  const maxRequests = options.max || 60; // 60 requests per minute

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const now = Date.now();

    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const record = requestCounts.get(ip);
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    record.count++;
    if (record.count > maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please slow down.'
      });
    }

    next();
  };
};

// ====================================================================
// 3. JWT Authentication & Role Authorization Middleware
// ====================================================================
const protect = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const token = authorization.slice('Bearer '.length).trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    const foundUser = await User.findById(decoded.id).select('-password');
    if (!foundUser) {
      return res.status(401).json({ success: false, message: 'Invalid authentication credentials' });
    }

    req.user = foundUser;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const userRole = req.user.role || 'USER';
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `User role '${userRole}' is not authorized to access this resource`
      });
    }
    next();
  };
};

// ====================================================================
// 4. Request Validation Middleware
// ====================================================================
const validateCurrencies = (sourceCurrency, destinationCurrency) => {
  const src = sourceCurrency ? sourceCurrency.toUpperCase() : '';
  const dst = destinationCurrency ? destinationCurrency.toUpperCase() : '';

  if (!src || !SUPPORTED_CURRENCIES[src]) {
    return { valid: false, message: `Unsupported or invalid source currency: '${sourceCurrency}'` };
  }
  if (!dst || !SUPPORTED_CURRENCIES[dst]) {
    return { valid: false, message: `Unsupported or invalid destination currency: '${destinationCurrency}'` };
  }
  if (!isCorridorSupported(src, dst)) {
    return { valid: false, message: `Currency corridor ${src} → ${dst} is not supported` };
  }

  return {
    valid: true,
    sourceInfo: SUPPORTED_CURRENCIES[src],
    destinationInfo: SUPPORTED_CURRENCIES[dst],
    corridorConfig: getCorridorConfig(src, dst)
  };
};

const validateAmount = (amount) => {
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    return { valid: false, message: 'Transaction amount must be a positive number' };
  }
  if (amount > 10000000) {
    return { valid: false, message: 'Amount exceeds maximum single payment threshold' };
  }
  return { valid: true };
};

const validatePaymentQuoteRequest = (req, res, next) => {
  const { sourceCurrency, destinationCurrency, amount } = req.body;

  if (!sourceCurrency || !destinationCurrency) {
    return res.status(400).json({ success: false, message: 'sourceCurrency and destinationCurrency are required' });
  }

  const curVal = validateCurrencies(sourceCurrency, destinationCurrency);
  if (!curVal.valid) {
    return res.status(400).json({ success: false, message: curVal.message });
  }

  const amtVal = validateAmount(Number(amount));
  if (!amtVal.valid) {
    return res.status(400).json({ success: false, message: amtVal.message });
  }

  next();
};

const validatePaymentExecuteRequest = (req, res, next) => {
  const { quoteId, receiverEmail } = req.body;

  if (!quoteId) {
    return res.status(400).json({ success: false, message: 'quoteId is required' });
  }
  if (!receiverEmail) {
    return res.status(400).json({ success: false, message: 'receiverEmail is required' });
  }

  next();
};

// ====================================================================
// 5. Idempotency Key Middleware
// ====================================================================
const checkIdempotency = async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

  if (!idempotencyKey) {
    return next();
  }

  req.idempotencyKey = idempotencyKey;
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');

  try {
    if (IdempotencyRecord.findOne) {
      const existing = await IdempotencyRecord.findOne({ idempotencyKey });
      if (existing) {
        if (new Date() < new Date(existing.expiresAt)) {
          if (String(existing.userId) !== String(req.user?._id || req.user?.id) || existing.requestHash !== requestHash) {
            return res.status(409).json({
              success: false,
              message: 'Idempotency key was already used for a different request'
            });
          }
          return res.status(existing.statusCode).json(existing.responseBody);
        }
      }
    }
  } catch (e) {
    console.warn('[Idempotency Middleware] DB lookup failed:', e.message);
  }

  req.idempotencyData = { idempotencyKey, requestHash };
  next();
};

// ====================================================================
// 6. Global Error Handler Middleware
// ====================================================================
const errorHandler = (err, req, res, next) => {
  console.error('[Error Handler]', err);

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Server error during payment orchestration',
    requestId: req.requestId
  });
};

module.exports = {
  requestId,
  rateLimiter,
  protect,
  authorize,
  validateCurrencies,
  validateAmount,
  validatePaymentQuoteRequest,
  validatePaymentExecuteRequest,
  checkIdempotency,
  errorHandler
};
