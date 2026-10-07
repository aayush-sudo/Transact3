const Portfolio = require('../models/Portfolio');
const ledgerEngine = require('./ledgerEngine');
const { SUPPORTED_CURRENCY_CODES } = require('../config/currencies');

const INITIAL_TEST_FUNDS_INR = 10000;

async function provisionNewUserWallet(user) {
  const holdings = SUPPORTED_CURRENCY_CODES.map(currency => ({
    currency,
    amount: currency === 'INR' ? INITIAL_TEST_FUNDS_INR : 0,
    averageBuyPrice: 1
  }));
  const portfolio = await Portfolio.create({ user: user._id, holdings });
  await ledgerEngine.recordDeposit({
    userId: user._id,
    userEmail: user.email,
    currency: 'INR',
    amount: INITIAL_TEST_FUNDS_INR,
    description: 'Initial platform test funds',
    externalReference: `TEST-CREDIT-${user._id}`,
    sourceName: 'Platform Test Funds'
  });
  return portfolio;
}

module.exports = { provisionNewUserWallet, INITIAL_TEST_FUNDS_INR };
