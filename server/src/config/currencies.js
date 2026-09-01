/**
 * 15 Global & Emerging Supported Currencies
 */
const SUPPORTED_CURRENCIES = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', region: 'Americas', precision: 2, baseVolatility: 0.0015, defaultPool: 50000000 },
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', region: 'Americas', precision: 2, baseVolatility: 0.0020, defaultPool: 25000000 },
  BRL: { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', region: 'Americas', precision: 2, baseVolatility: 0.0055, defaultPool: 15000000 },
  MXN: { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$', region: 'Americas', precision: 2, baseVolatility: 0.0045, defaultPool: 20000000 },

  EUR: { code: 'EUR', name: 'Euro', symbol: '€', region: 'Europe/UK', precision: 2, baseVolatility: 0.0018, defaultPool: 45000000 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', region: 'Europe/UK', precision: 2, baseVolatility: 0.0022, defaultPool: 30000000 },
  CHF: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', region: 'Europe/UK', precision: 2, baseVolatility: 0.0016, defaultPool: 20000000 },
  SEK: { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', region: 'Europe/UK', precision: 2, baseVolatility: 0.0030, defaultPool: 15000000 },

  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', region: 'Asia-Pacific', precision: 0, baseVolatility: 0.0025, defaultPool: 5000000000 },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', region: 'Asia-Pacific', precision: 2, baseVolatility: 0.0035, defaultPool: 280000000 },
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', region: 'Asia-Pacific', precision: 2, baseVolatility: 0.0020, defaultPool: 25000000 },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', region: 'Asia-Pacific', precision: 2, baseVolatility: 0.0028, defaultPool: 20000000 },
  HKD: { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', region: 'Asia-Pacific', precision: 2, baseVolatility: 0.0012, defaultPool: 50000000 },

  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'AED', region: 'Middle East & Africa', precision: 2, baseVolatility: 0.0010, defaultPool: 35000000 },
  ZAR: { code: 'ZAR', name: 'South African Rand', symbol: 'R', region: 'Middle East & Africa', precision: 2, baseVolatility: 0.0060, defaultPool: 18000000 }
};

module.exports = SUPPORTED_CURRENCIES;
