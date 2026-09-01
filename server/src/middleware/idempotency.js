const crypto = require('crypto');
const IdempotencyRecord = require('../models/IdempotencyRecord');

const checkIdempotency = async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

  if (!idempotencyKey) {
    return next(); // Proceed normally if no key provided
  }

  req.idempotencyKey = idempotencyKey;
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');

  try {
    if (IdempotencyRecord.findOne) {
      const existing = await IdempotencyRecord.findOne({ idempotencyKey });
      if (existing) {
        if (new Date() < new Date(existing.expiresAt)) {
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

module.exports = { checkIdempotency };
