const requestCounts = new Map();

// Simple, memory-efficient rate limiting middleware without external binary native dependencies
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

module.exports = { rateLimiter };
