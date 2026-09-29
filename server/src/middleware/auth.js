const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

module.exports = { protect };
