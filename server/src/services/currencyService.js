const axios = require('axios');

// In-memory cache for FX rates with 60s TTL
const rateCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

const DEFAULT_USD_RATES = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  INR: 87.20,
  AED: 3.6725,
  SGD: 1.345,
  AUD: 1.52,
  CAD: 1.36,
  JPY: 152.0
};

const getExchangeRates = async (baseCurrency = 'USD') => {
  const base = (baseCurrency || 'USD').toUpperCase();
  const cacheKey = `RATES_${base}`;
  const cached = rateCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return {
      result: 'success',
      base_code: base,
      conversion_rates: cached.rates,
      source: 'CACHED',
      timestamp: new Date(cached.timestamp),
      is_mock: cached.is_mock
    };
  }

  const API_KEY = process.env.EXCHANGE_RATE_API_KEY;
  if (API_KEY && API_KEY !== 'your_api_key_here') {
    try {
      const url = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${base}`;
      const response = await axios.get(url, { timeout: 4000 });
      if (response.data && response.data.result === 'success' && response.data.conversion_rates) {
        const rates = response.data.conversion_rates;
        rateCache.set(cacheKey, { rates, timestamp: Date.now(), is_mock: false });
        return {
          result: 'success',
          base_code: base,
          conversion_rates: rates,
          source: 'LIVE_API',
          timestamp: new Date(),
          is_mock: false
        };
      }
    } catch (error) {
      console.warn(`[CurrencyService] Live API call failed (${error.message}). Falling back to simulated rates.`);
    }
  }

  // Realistic simulated rates derived from realistic baseline
  const rates = {};
  const baseToUSD = DEFAULT_USD_RATES[base] || 1.0;
  for (const [curr, usdRate] of Object.entries(DEFAULT_USD_RATES)) {
    rates[curr] = Number((usdRate / baseToUSD).toFixed(4));
  }

  rateCache.set(cacheKey, { rates, timestamp: Date.now(), is_mock: true });
  return {
    result: 'success',
    base_code: base,
    conversion_rates: rates,
    source: 'SIMULATED',
    timestamp: new Date(),
    is_mock: true
  };
};

const getHistoricalRates = async (baseCurrency, targetCurrency, days = 14) => {
  const base = (baseCurrency || 'USD').toUpperCase();
  const target = (targetCurrency || 'EUR').toUpperCase();

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const endStr = endDate.toISOString().split('T')[0];
    const startStr = startDate.toISOString().split('T')[0];

    const url = `https://api.frankfurter.dev/v1/${startStr}..${endStr}?base=${base}&symbols=${target}`;
    const response = await axios.get(url, { timeout: 3500 });

    if (response.data && response.data.rates && Object.keys(response.data.rates).length > 0) {
      return {
        result: 'success',
        base_code: base,
        target_code: target,
        conversion_rates: response.data.rates,
        source: 'LIVE_API',
        is_mock: false
      };
    }
    throw new Error('Invalid or empty response from Frankfurter API');
  } catch (error) {
    const latestRates = await getExchangeRates(base);
    const anchorRate = (latestRates.conversion_rates && latestRates.conversion_rates[target]) || 1.0;
    return mockHistoricalData(base, target, days, anchorRate);
  }
};

const mockHistoricalData = (base, target, days, anchorRate) => {
  const rates = {};
  let currentRate = anchorRate;
  const trend = (Math.random() - 0.48) * 0.001 * anchorRate;

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    rates[dateStr] = { [target]: Number(currentRate.toFixed(4)) };
    const volatility = anchorRate * 0.003;
    currentRate = Math.max(0.0001, currentRate - ((Math.random() * 2 - 1) * volatility) - trend);
  }

  return {
    result: 'success',
    base_code: base,
    target_code: target,
    conversion_rates: rates,
    source: 'SIMULATED',
    is_mock: true
  };
};

module.exports = {
  getExchangeRates,
  getHistoricalRates,
  DEFAULT_USD_RATES
};
