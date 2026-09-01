const SUPPORTED_CURRENCIES = require('../config/currencies');
const { isCorridorSupported, getCorridorConfig } = require('../config/corridors');

class CurrencyEngine {
  validateCurrencies(sourceCurrency, destinationCurrency) {
    const src = sourceCurrency ? sourceCurrency.toUpperCase() : '';
    const dst = destinationCurrency ? destinationCurrency.toUpperCase() : '';

    if (!src || !SUPPORTED_CURRENCIES[src]) {
      return { valid: false, message: `Unsupported or invalid source currency: '${sourceCurrency}'` };
    }
    if (!dst || !SUPPORTED_CURRENCIES[dst]) {
      return { valid: false, message: `Unsupported or invalid destination currency: '${destinationCurrency}'` };
    }
    if (!isCorridorSupported(src, dst)) {
      return { valid: false, message: `Currency corridor ${src} → ${dst} is not supported` };
    }

    return {
      valid: true,
      sourceInfo: SUPPORTED_CURRENCIES[src],
      destinationInfo: SUPPORTED_CURRENCIES[dst],
      corridorConfig: getCorridorConfig(src, dst)
    };
  }

  validateAmount(amount, sourceCurrency) {
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      return { valid: false, message: 'Transaction amount must be a positive number' };
    }
    if (amount > 10000000) {
      return { valid: false, message: `Amount exceeds maximum single payment threshold` };
    }
    return { valid: true };
  }

  formatAmount(amount, currencyCode) {
    const currency = SUPPORTED_CURRENCIES[currencyCode ? currencyCode.toUpperCase() : 'USD'];
    const decimals = currency ? currency.precision : 2;
    return parseFloat(Number(amount).toFixed(decimals));
  }
}

module.exports = new CurrencyEngine();
