const axios = require('axios');
const { SUPPORTED_CURRENCY_CODES, isCurrencySupported } = require('../config/currencies');

const FRANKFURTER_ENDPOINT = 'https://api.frankfurter.dev/v2';
const CACHE_TTL_MS = 60 * 60 * 1000;
const rateCache = new Map();

const getExchangeRates = async (baseCurrency = 'USD') => {
  const base = String(baseCurrency || 'USD').toUpperCase();
  if (!isCurrencySupported(base)) {
    throw new Error(`Unsupported base currency: ${base}`);
  }

  const cached = rateCache.get(base);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const quotes = SUPPORTED_CURRENCY_CODES.filter((code) => code !== base);
  const response = await axios.get(`${FRANKFURTER_ENDPOINT}/rates`, {
    params: { base, quotes: quotes.join(',') },
    timeout: 5000
  });
  const rows = Array.isArray(response.data) ? response.data : [];
  const rates = { [base]: 1 };
  let rateDate = null;

  for (const row of rows) {
    const quote = String(row.quote || '').toUpperCase();
    const rate = Number(row.rate);
    if (row.base === base && isCurrencySupported(quote) && Number.isFinite(rate) && rate > 0) {
      rates[quote] = rate;
      rateDate = row.date || rateDate;
    }
  }

  if (Object.keys(rates).length < 2 || !rateDate) {
    throw new Error(`No current reference rates are available for ${base}.`);
  }

  const data = {
    result: 'success',
    base_code: base,
    conversion_rates: rates,
    source: 'FRANKFURTER_REFERENCE',
    timestamp: new Date(`${rateDate}T00:00:00.000Z`),
    rateDate,
    is_mock: false
  };
  rateCache.set(base, { data, cachedAt: Date.now() });
  return data;
};

const getHistoricalRates = async (baseCurrency, targetCurrency, days = 14) => {
  const base = String(baseCurrency || 'USD').toUpperCase();
  const target = String(targetCurrency || 'EUR').toUpperCase();
  if (!isCurrencySupported(base) || !isCurrencySupported(target)) {
    throw new Error(`Unsupported currency pair: ${base}/${target}`);
  }

  const count = Math.max(1, Math.min(365, Math.floor(Number(days) || 14)));
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - count);
  const from = start.toISOString().slice(0, 10);
  const to = end.toISOString().slice(0, 10);
  const response = await axios.get(`${FRANKFURTER_ENDPOINT}/rates`, {
    params: { base, quotes: target, from, to },
    timeout: 5000
  });
  const rows = Array.isArray(response.data) ? response.data : [];
  const rates = {};

  for (const row of rows) {
    const rate = Number(row.rate);
    if (row.base === base && String(row.quote || '').toUpperCase() === target && Number.isFinite(rate) && rate > 0) {
      rates[row.date] = { [target]: rate };
    }
  }

  if (Object.keys(rates).length === 0) {
    throw new Error(`No historical reference rates are available for ${base}/${target}.`);
  }

  return {
    result: 'success',
    base_code: base,
    target_code: target,
    conversion_rates: rates,
    source: 'FRANKFURTER_REFERENCE',
    is_mock: false
  };
};

const formatAmount = (amount, currencyCode) => {
  const decimals = (currencyCode && currencyCode.toUpperCase() === 'JPY') ? 0 : 2;
  return parseFloat(Number(amount).toFixed(decimals));
};

module.exports = {
  getExchangeRates,
  getHistoricalRates,
  formatAmount
};
