/**
 * 9 Standardized Supported Currencies for Transact3
 */
const SUPPORTED_CURRENCIES = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', region: 'Americas', precision: 2, baseVolatility: 0.0015, defaultPool: 50000000 },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', region: 'Europe', precision: 2, baseVolatility: 0.0018, defaultPool: 45000000 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', region: 'Europe', precision: 2, baseVolatility: 0.0022, defaultPool: 30000000 },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', region: 'Asia-Pacific', precision: 2, baseVolatility: 0.0035, defaultPool: 280000000 },
  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'AED', region: 'Middle East', precision: 2, baseVolatility: 0.0010, defaultPool: 35000000 },
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', region: 'Asia-Pacific', precision: 2, baseVolatility: 0.0020, defaultPool: 25000000 },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', region: 'Asia-Pacific', precision: 2, baseVolatility: 0.0028, defaultPool: 20000000 },
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', region: 'Americas', precision: 2, baseVolatility: 0.0020, defaultPool: 25000000 },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', region: 'Asia-Pacific', precision: 0, baseVolatility: 0.0025, defaultPool: 5000000000 },
};

const SUPPORTED_CURRENCY_CODES = Object.keys(SUPPORTED_CURRENCIES);

const isCurrencySupported = (currencyCode) => {
  if (!currencyCode || typeof currencyCode !== 'string') return false;
  return Boolean(SUPPORTED_CURRENCIES[currencyCode.toUpperCase()]);
};

const getCurrency = (currencyCode) => {
  if (!currencyCode) return null;
  return SUPPORTED_CURRENCIES[currencyCode.toUpperCase()] || null;
};

module.exports = SUPPORTED_CURRENCIES;
module.exports.SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCY_CODES;
module.exports.isCurrencySupported = isCurrencySupported;
module.exports.getCurrency = getCurrency;
