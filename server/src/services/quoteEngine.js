const { v4: uuidv4 } = require('crypto');
const FXQuote = require('../models/FXQuote');
const fxRateEngine = require('./fxRateEngine');

class QuoteEngine {
  constructor() {
    this.quoteTTLSeconds = 30; // 30 seconds expiration period
  }

  generateQuoteId() {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `QTE-${Date.now().toString(36).toUpperCase()}-${randomHex}`;
  }

  async createQuote(params) {
    const { userId, sourceCurrency, destinationCurrency, sourceAmount, orchestrationResult } = params;

    const fxData = await fxRateEngine.calculateFXQuoteAsync(sourceCurrency, destinationCurrency, sourceAmount);

    const quoteId = this.generateQuoteId();
    const expiresAt = new Date(Date.now() + this.quoteTTLSeconds * 1000);

    const selectedRail = orchestrationResult ? orchestrationResult.recommendedRail.id : 'SWIFT_BATCH';
    const railFeeUSD = orchestrationResult ? orchestrationResult.recommendedRail.estFeeUSD : 25.00;
    const estimatedLatencyHours = orchestrationResult ? orchestrationResult.recommendedRail.estLatencyHours : 24.0;
    const totalCostUSD = parseFloat((fxData.fxCostUSD + railFeeUSD).toFixed(2));
    const riskScore = orchestrationResult ? orchestrationResult.riskScore : 15;
    const timingRecommendation = orchestrationResult ? orchestrationResult.fxTiming : null;

    const quoteDoc = {
      quoteId,
      userId: userId || '000000000000000000000000',
      currencyPair: `${fxData.sourceCurrency}/${fxData.destinationCurrency}`,
      sourceCurrency: fxData.sourceCurrency,
      destinationCurrency: fxData.destinationCurrency,
      sourceAmount: fxData.sourceAmount,
      destinationAmount: fxData.destinationAmount,
      referenceRate: fxData.referenceRate,
      quotedRate: fxData.quotedRate,
      spreadBps: fxData.spreadBps,
      fxCostUSD: fxData.fxCostUSD,
      selectedRail,
      railFeeUSD,
      totalCostUSD,
      estimatedLatencyHours,
      riskScore,
      timingRecommendation,
      expiresAt,
      status: 'ACTIVE',
      createdAt: new Date()
    };

    // Store in DB if available, or return document
    try {
      if (FXQuote.create) {
        await FXQuote.create(quoteDoc);
      }
    } catch (e) {
      console.warn('[QuoteEngine] DB persistence skipped:', e.message);
    }

    return quoteDoc;
  }

  async verifyQuote(quoteId) {
    let quote = null;
    try {
      if (FXQuote.findOne) {
        quote = await FXQuote.findOne({ quoteId });
      }
    } catch (e) {
      console.warn('[QuoteEngine] DB find failed:', e.message);
    }

    if (!quote) {
      return { valid: false, reason: 'Quote not found' };
    }

    if (new Date() > new Date(quote.expiresAt)) {
      return { valid: false, reason: 'Quote has expired (30-second TTL exceeded)', expired: true };
    }

    if (quote.status !== 'ACTIVE') {
      return { valid: false, reason: `Quote is no longer active (Status: ${quote.status})` };
    }

    return { valid: true, quote };
  }
}

module.exports = new QuoteEngine();
