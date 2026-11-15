const { getExchangeRates, formatAmount } = require('./currencyService');
const { calculateSpreadBps } = require('./settlementPolicy');

class FXRateEngine {
  async getReferenceRate(sourceCurrency, destinationCurrency) {
    const src = sourceCurrency.toUpperCase();
    const dst = destinationCurrency.toUpperCase();

    if (src === dst) return 1.0;

    const ratesData = await getExchangeRates(src);
    const rate = Number(ratesData.conversion_rates?.[dst]);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`No reference rate is available for ${src}/${dst}.`);
    }
    return rate;
  }

  /**
   * Indicative (spread-free) conversion for display purposes.
   * Always returns the destination-per-source rate, inverting the published
   * quote mathematically when only the inverse is available. Never flips the
   * requested pair.
   */
  async getIndicativeConversion(sourceCurrency, destinationCurrency) {
    const src = String(sourceCurrency || '').toUpperCase();
    const dst = String(destinationCurrency || '').toUpperCase();
    if (!src || !dst || src === dst) {
      return { rate: 1, inverted: false, timestamp: new Date(), rateSource: 'IDENTITY', sourceCurrency: src, destinationCurrency: dst };
    }

    const directData = await getExchangeRates(src);
    const rate = Number(directData.conversion_rates?.[dst]);
    if (!Number.isFinite(rate) || rate <= 0) return null;

    return {
      rate,
      inverted: false,
      timestamp: directData.timestamp || new Date(),
      rateSource: directData.source || null,
      sourceCurrency: src,
      destinationCurrency: dst
    };
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
      const sourceCurrencyRate = Number(usdRates.conversion_rates?.[src]);
      if (!Number.isFinite(sourceCurrencyRate) || sourceCurrencyRate <= 0) {
        throw new Error(`No USD reference rate is available for ${src}.`);
      }
      sourceAmountUSD = Number(amount) / sourceCurrencyRate;
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
