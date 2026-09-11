const FXQuote = require('../models/FXQuote');
const { roundToPrecision } = require('../utils/mathUtils');

class QuoteEngine {
  constructor() {
    this.quoteTTLSeconds = 60; // 60 seconds validity window for user confirmation
    this.memoryQuotes = new Map();
  }

  generateQuoteId() {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `QTE-${Date.now().toString(36).toUpperCase()}-${randomHex}`;
  }

  async createQuote(params) {
    const {
      userId,
      recipientId,
      receiverEmail,
      orchestrationResult
    } = params;

    const quoteId = this.generateQuoteId();
    const expiresAt = new Date(Date.now() + this.quoteTTLSeconds * 1000);

    const recommended = orchestrationResult.recommendedRail || { id: 'SWIFT_BATCH', est_fee_usd: 25.0, est_latency_hours: 36.0 };
    const railFeeUSD = recommended.est_fee_usd || 1.50;

    const sourceAmount = orchestrationResult.sourceAmount;
    const sourceCurrency = orchestrationResult.sourceCurrency;
    const destinationAmount = orchestrationResult.destinationAmount;
    const destinationCurrency = orchestrationResult.destinationCurrency;
    const sourceAmountUSD = orchestrationResult.sourceAmountUSD || (sourceCurrency === 'USD' ? sourceAmount : sourceAmount);

    // Total sender debit in source currency
    const totalSenderDebitUSD = roundToPrecision(
      sourceAmountUSD + railFeeUSD,
      2
    );

    const quoteDoc = {
      quoteId,
      userId: userId || '60c72b2f9b1d8b0015f8e001',
      recipientId: recipientId || null,
      receiverEmail: receiverEmail || 'recipient@transact3.io',
      currencyPair: `${sourceCurrency}/${destinationCurrency}`,
      sourceCurrency,
      destinationCurrency,
      paymentMode: orchestrationResult.paymentMode || 'SEND_AMOUNT',
      sourceAmount,
      destinationAmount,
      sourceAmountUSD,
      referenceRate: orchestrationResult.fxRate,
      quotedRate: orchestrationResult.fxRate,
      spreadBps: orchestrationResult.spreadBps || 30,
      fxCostUSD: orchestrationResult.fxCostUSD,
      fxAnalysis: orchestrationResult.fxAnalysis,
      selectedRail: recommended.id,
      recommendedRail: recommended.id,
      railFeeUSD,
      totalCostUSD: roundToPrecision((orchestrationResult.fxCostUSD || 0) + railFeeUSD, 2),
      totalSenderDebitUSD,
      estimatedLatencyHours: recommended.est_latency_hours || 0.0003,
      riskScore: 15,
      timingRecommendation: orchestrationResult.fxAnalysis ? orchestrationResult.fxAnalysis.recommendation : 'Execute now',
      priority: orchestrationResult.priorityProfile || 'BALANCED',
      evaluatedRails: orchestrationResult.evaluatedRails || [],
      aiSavingsUSD: recommended.ai_savings_usd || 0,
      expiresAt,
      status: 'ACTIVE',
      createdAt: new Date()
    };

    // Store in in-memory map
    this.memoryQuotes.set(quoteId, { ...quoteDoc });

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
    let memoryQuote = this.memoryQuotes.get(quoteId);
    let dbQuote = null;

    try {
      if (FXQuote.findOne) {
        const found = await FXQuote.findOne({ quoteId });
        if (found) {
          dbQuote = found.toObject ? found.toObject() : found;
        }
      }
    } catch (e) {
      console.warn('[QuoteEngine] DB find failed:', e.message);
    }

    // Merge memory quote and db quote (memory quote has full uncast object)
    const quote = memoryQuote ? { ...dbQuote, ...memoryQuote } : dbQuote;

    if (!quote) {
      return { valid: false, reason: 'Quote not found or expired' };
    }

    if (new Date() > new Date(quote.expiresAt)) {
      return { valid: false, reason: 'Quote has expired (60-second execution window exceeded)', expired: true, quote };
    }

    if (quote.status !== 'ACTIVE') {
      return { valid: false, reason: `Quote is no longer active (Status: ${quote.status})`, quote };
    }

    return { valid: true, quote };
  }

  async markQuoteExecuted(quoteId) {
    const memoryQuote = this.memoryQuotes.get(quoteId);
    if (memoryQuote) {
      memoryQuote.status = 'EXECUTED';
    }

    try {
      if (FXQuote.findOneAndUpdate) {
        await FXQuote.findOneAndUpdate({ quoteId }, { status: 'EXECUTED' });
      }
    } catch (e) {}
  }
}

module.exports = new QuoteEngine();
