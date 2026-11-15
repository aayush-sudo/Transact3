const Portfolio = require('../models/Portfolio');
const { SUPPORTED_CURRENCY_CODES } = require('../config/currencies');

async function provisionNewUserWallet(user) {
  const holdings = SUPPORTED_CURRENCY_CODES.map(currency => ({
    currency,
    amount: 0,
    averageBuyPrice: 1
  }));
  return Portfolio.create({ user: user._id, holdings });
}

module.exports = { provisionNewUserWallet };
