const { getExchangeRates, formatAmount } = require('./currencyService');
const { calculateSpreadBps } = require('./settlementPolicy');

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

  async calculateFXQuoteAsync(sourceCurrency, destinationCurrency, amount, options = {}) {
    const src = sourceCurrency.toUpperCase();
    const dst = destinationCurrency.toUpperCase();
    const referenceRate = options.referenceRate || await this.getReferenceRate(src, dst);
    let sourceAmountUSD = Number(options.sourceAmountUSD);
    if (!Number.isFinite(sourceAmountUSD) || sourceAmountUSD < 0) {
      const usdRates = await getExchangeRates('USD');
      sourceAmountUSD = Number(amount) / (Number(usdRates.conversion_rates?.[src]) || 1);
    }
    const spreadBps = calculateSpreadBps(
      src,
      dst,
      sourceAmountUSD,
      options.settlementRail || 'SWIFT_CORRESPONDENT'
    );
    const spreadFraction = spreadBps / 10000;

    const quotedRate = parseFloat((referenceRate * (1 - spreadFraction)).toFixed(6));
    const destinationAmount = formatAmount(Number(amount) * quotedRate, dst);
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
      sourceAmountUSD,
      timestamp: new Date()
    };
  }
}

module.exports = new FXRateEngine();
