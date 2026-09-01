const crypto = require('crypto');

const requestId = (req, res, next) => {
  const reqId = req.headers['x-request-id'] || `REQ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  req.requestId = reqId;
  res.setHeader('X-Request-ID', reqId);
  next();
};

module.exports = { requestId };
