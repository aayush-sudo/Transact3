const mongoose = require('mongoose');

const FXQuoteSchema = new mongoose.Schema({
  quoteId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  currencyPair: { type: String, required: true },
  sourceCurrency: { type: String, required: true },
  destinationCurrency: { type: String, required: true },
  sourceAmount: { type: Number, required: true },
  destinationAmount: { type: Number, required: true },
  referenceRate: { type: Number, required: true },
  quotedRate: { type: Number, required: true },
  spreadBps: { type: Number, required: true },
  fxCostUSD: { type: Number, required: true },
  selectedRail: { type: String, required: true },
  railFeeUSD: { type: Number, required: true },
  totalCostUSD: { type: Number, required: true },
  estimatedLatencyHours: { type: Number, required: true },
  riskScore: { type: Number, required: true },
  timingRecommendation: { type: Object },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ['ACTIVE', 'EXPIRED', 'EXECUTED', 'CANCELLED'], default: 'ACTIVE' },
  createdAt: { type: Date, default: Date.now }
});

FXQuoteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('FXQuote', FXQuoteSchema);
