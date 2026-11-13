const Portfolio = require('../models/Portfolio');
const ledgerEngine = require('./ledgerEngine');
const { SUPPORTED_CURRENCY_CODES } = require('../config/currencies');

const INITIAL_TEST_FUNDS = {
  USD: 10000,
  EUR: 10000,
  GBP: 10000,
  INR: 100000,
  SGD: 10000,
  AED: 25000,
  CAD: 10000,
  AUD: 10000,
  JPY: 1000000
};

const INITIAL_TEST_FUNDS_INR = 100000;

async function provisionNewUserWallet(user) {
  const holdings = SUPPORTED_CURRENCY_CODES.map(currency => ({
    currency,
    amount: INITIAL_TEST_FUNDS[currency] || 5000,
    averageBuyPrice: 1
  }));
  const portfolio = await Portfolio.create({ user: user._id, holdings });

  // Record initial deposit for major testing currencies
  for (const curr of ['USD', 'EUR', 'INR']) {
    const amt = INITIAL_TEST_FUNDS[curr] || 5000;
    try {
      await ledgerEngine.recordDeposit({
        userId: user._id,
        userEmail: user.email,
        currency: curr,
        amount: amt,
        description: 'Initial platform test funds',
        externalReference: `TEST-CREDIT-${curr}-${user._id}`,
        sourceName: 'Platform Test Funds'
      });
    } catch (err) {
      // Ignore deposit logging failure if ledger is optional
    }
  }

  return portfolio;
}

module.exports = { provisionNewUserWallet, INITIAL_TEST_FUNDS, INITIAL_TEST_FUNDS_INR };
