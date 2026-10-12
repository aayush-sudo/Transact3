const { getExchangeRates, formatAmount } = require('./currencyService');
const fxRateEngine = require('./fxRateEngine');
const railPricingService = require('./railPricingService');
const { getInstantEligibility, getSettlementPlan } = require('./settlementPolicy');

async function createCurrencyConversionQuote(sourceCurrency, destinationCurrency, amount) {
  const [rateData, usdRateData] = await Promise.all([
    getExchangeRates(sourceCurrency),
    getExchangeRates('USD')
  ]);
  const referenceRate = Number(rateData.conversion_rates?.[destinationCurrency]);
  if (!Number.isFinite(referenceRate) || referenceRate <= 0) {
    throw new Error(`No exchange rate is available for ${sourceCurrency}/${destinationCurrency}.`);
  }

  const sourceAmountUSD = amount / (Number(usdRateData.conversion_rates?.[sourceCurrency]) || 1);
  const instantEligibility = getInstantEligibility(sourceCurrency, destinationCurrency, sourceAmountUSD);
  const selectedRail = instantEligibility.eligible ? 'INSTANT_PAYMENT_LINK' : 'SWIFT_CORRESPONDENT';
  const fxQuote = await fxRateEngine.calculateFXQuoteAsync(sourceCurrency, destinationCurrency, amount, {
    referenceRate,
    sourceAmountUSD,
    settlementRail: selectedRail
  });
  const settlementPlan = getSettlementPlan(
    sourceCurrency,
    destinationCurrency,
    sourceAmountUSD,
    selectedRail
  );
  const railFee = railPricingService.calculateFeeBreakdown(selectedRail, sourceAmountUSD);

  return {
    base: sourceCurrency,
    target: destinationCurrency,
    amount,
    rate: referenceRate,
    convertedAmount: formatAmount(amount * referenceRate, destinationCurrency),
    currencyPair: `${amount} ${sourceCurrency} -> ${destinationCurrency}`,
    quotedRate: fxQuote.quotedRate,
    spreadBps: fxQuote.spreadBps,
    fxCostUSD: fxQuote.fxCostUSD,
    estimatedSettlementDuration: settlementPlan.settlementWindow,
    minimumSettlementHours: settlementPlan.minimumSettlementHours,
    maximumSettlementHours: settlementPlan.maximumSettlementHours,
    earliestSettlementAt: settlementPlan.earliestSettlementAt,
    latestSettlementAt: settlementPlan.latestSettlementAt,
    appliedClearingRail: settlementPlan.appliedClearingRail,
    is_instant: settlementPlan.is_instant,
    instantFeasibility: settlementPlan.instantFeasibility,
    instantIneligibilityReason: settlementPlan.instantIneligibilityReason,
    instantThresholdUSD: settlementPlan.instantThresholdUSD,
    finalNetPayout: fxQuote.destinationAmount,
    railFeeEstimateUSD: railFee.totalFeeUSD,
    railFeePaymentMethod: 'Charged separately to the sender; final payout includes the dynamic FX spread.',
    pricingSource: rateData.source,
    source: rateData.source,
    timestamp: rateData.timestamp,
    is_mock: rateData.is_mock
  };
}

module.exports = { createCurrencyConversionQuote };
