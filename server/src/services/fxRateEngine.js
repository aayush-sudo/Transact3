const { getExchangeRates } = require('./currencyService');
const { getCorridorConfig } = require('../config/corridors');

// Standard reference rates table for fast reference & fallback across 15 currencies
const BASE_RATES_VS_USD = {
  USD: 1.0,
  CAD: 1.36,
  BRL: 5.55,
  MXN: 18.20,
  EUR: 0.92,
  GBP: 0.79,
  CHF: 0.90,
  SEK: 10.50,
  JPY: 151.5,
  INR: 83.20,
  SGD: 1.35,
  AUD: 1.52,
  HKD: 7.82,
  AED: 3.67,
  ZAR: 18.50
};

class FXRateEngine {
  async getReferenceRate(sourceCurrency, destinationCurrency) {
    const src = sourceCurrency.toUpperCase();
    const dst = destinationCurrency.toUpperCase();

    if (src === dst) return 1.0;

    try {
      const ratesData = await getExchangeRates(src);
      if (ratesData && ratesData.conversion_rates && ratesData.conversion_rates[dst]) {
        return ratesData.conversion_rates[dst];
      }
    } catch (err) {
      console.warn(`[FXRateEngine] Live rate fetch failed, using internal base rates matrix`);
    }

    // Fallback using base rate matrix
    const srcVsUSD = BASE_RATES_VS_USD[src] || 1.0;
    const dstVsUSD = BASE_RATES_VS_USD[dst] || 1.0;
    return parseFloat((dstVsUSD / srcVsUSD).toFixed(6));
  }

  calculateFXQuote(sourceCurrency, destinationCurrency, amount) {
    return this.calculateFXQuoteAsync(sourceCurrency, destinationCurrency, amount);
  }

  async calculateFXQuoteAsync(sourceCurrency, destinationCurrency, amount) {
    const src = sourceCurrency.toUpperCase();
    const dst = destinationCurrency.toUpperCase();
    const referenceRate = await this.getReferenceRate(src, dst);

    const corridor = getCorridorConfig(src, dst);
    const spreadBps = corridor.baseSpreadBps || 35; // Spread in basis points (e.g. 35 bps = 0.35%)
    const spreadFraction = spreadBps / 10000;

    // Customer rate is slightly lower than reference rate (bank keeps the spread)
    const quotedRate = parseFloat((referenceRate * (1 - spreadFraction)).toFixed(6));
    const destinationAmount = parseFloat((amount * quotedRate).toFixed(2));

    // Calculate FX cost in USD equivalent
    const srcVsUSD = BASE_RATES_VS_USD[src] || 1.0;
    const sourceAmountUSD = amount / srcVsUSD;
    const fxCostUSD = parseFloat((sourceAmountUSD * spreadFraction).toFixed(2));

    return {
      sourceCurrency: src,
      destinationCurrency: dst,
      sourceAmount: amount,
      destinationAmount,
      referenceRate,
      quotedRate,
      spreadBps,
      spreadFraction,
      fxCostUSD,
      timestamp: new Date()
    };
  }
}

module.exports = new FXRateEngine();
