/**
 * Currency Corridors & Rail Eligibility Configuration
 */
const SUPPORTED_CURRENCIES = require('./currencies');

const ALL_RAILS = ['SWIFT_BATCH', 'RTGS_INSTANT', 'REGIONAL_INSTANT', 'STABLECOIN_VAULT', 'NETTING_LEDGER', 'CARD_PUSH'];

const CORRIDOR_CONFIG = {
  // Common corridor limits & rail eligibility rules
  defaultEligibleRails: ALL_RAILS,
  maxTransactionAmountUSD: 5000000,
  minTransactionAmountUSD: 1,

  // Corridor specific overrides
  corridors: {
    'USD-EUR': { eligibleRails: ALL_RAILS, maxAmountUSD: 10000000, baseSpreadBps: 20 },
    'USD-GBP': { eligibleRails: ALL_RAILS, maxAmountUSD: 8000000, baseSpreadBps: 25 },
    'USD-INR': { eligibleRails: ALL_RAILS, maxAmountUSD: 5000000, baseSpreadBps: 35 },
    'EUR-GBP': { eligibleRails: ALL_RAILS, maxAmountUSD: 5000000, baseSpreadBps: 20 },
    'USD-JPY': { eligibleRails: ALL_RAILS, maxAmountUSD: 10000000, baseSpreadBps: 25 },
    'USD-BRL': { eligibleRails: ['SWIFT_BATCH', 'RTGS_INSTANT', 'REGIONAL_INSTANT', 'STABLECOIN_VAULT', 'CARD_PUSH'], maxAmountUSD: 2000000, baseSpreadBps: 55 },
    'USD-MXN': { eligibleRails: ALL_RAILS, maxAmountUSD: 3000000, baseSpreadBps: 45 },
    'EUR-BRL': { eligibleRails: ['SWIFT_BATCH', 'RTGS_INSTANT', 'STABLECOIN_VAULT', 'CARD_PUSH'], maxAmountUSD: 1500000, baseSpreadBps: 60 },
    'USD-CAD': { eligibleRails: ALL_RAILS, maxAmountUSD: 5000000, baseSpreadBps: 25 },
    'USD-SGD': { eligibleRails: ALL_RAILS, maxAmountUSD: 5000000, baseSpreadBps: 30 },
    'USD-AED': { eligibleRails: ALL_RAILS, maxAmountUSD: 5000000, baseSpreadBps: 30 },
    'USD-ZAR': { eligibleRails: ['SWIFT_BATCH', 'RTGS_INSTANT', 'STABLECOIN_VAULT', 'CARD_PUSH'], maxAmountUSD: 1000000, baseSpreadBps: 70 },
  }
};

const isCorridorSupported = (fromCurrency, toCurrency) => {
  if (fromCurrency === toCurrency) return true;
  if (!SUPPORTED_CURRENCIES[fromCurrency] || !SUPPORTED_CURRENCIES[toCurrency]) return false;
  return true; // All supported currency pairs are convertible
};

const getCorridorConfig = (fromCurrency, toCurrency) => {
  const pairKey = `${fromCurrency}-${toCurrency}`;
  const reversePairKey = `${toCurrency}-${fromCurrency}`;
  
  if (CORRIDOR_CONFIG.corridors[pairKey]) {
    return CORRIDOR_CONFIG.corridors[pairKey];
  }
  if (CORRIDOR_CONFIG.corridors[reversePairKey]) {
    return CORRIDOR_CONFIG.corridors[reversePairKey];
  }

  return {
    eligibleRails: ALL_RAILS,
    maxAmountUSD: CORRIDOR_CONFIG.maxTransactionAmountUSD,
    baseSpreadBps: 40
  };
};

module.exports = {
  CORRIDOR_CONFIG,
  isCorridorSupported,
  getCorridorConfig
};
