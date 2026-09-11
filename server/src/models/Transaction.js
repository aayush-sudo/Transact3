const mongoose = require('mongoose');

const TRANSACTION_STATUSES = [
  'CREATED',
  'VALIDATING',
  'ANALYZING',
  'ROUTE_SELECTED',
  'AWAITING_CONFIRMATION',
  'PROCESSING',
  'SETTLING',
  'COMPLETED',
  'COMPLETED_VIA_FALLBACK',
  'FAILED'
];

const TransactionSchema = new mongoose.Schema({
  quoteId: {
    type: String,
    required: true,
  },
  idempotencyKey: {
    type: String,
    sparse: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  receiverEmail: {
    type: String,
    required: true,
  },
  paymentMode: {
    type: String,
    enum: ['SEND_AMOUNT', 'RECIPIENT_GETS'],
    default: 'SEND_AMOUNT',
  },
  sourceCurrency: {
    type: String,
    required: true,
    uppercase: true,
  },
  destinationCurrency: {
    type: String,
    required: true,
    uppercase: true,
  },
  sourceAmount: {
    type: Number,
    required: true,
    min: 0.01,
  },
  destinationAmount: {
    type: Number,
    required: true,
  },
  referenceFXRate: {
    type: Number,
    required: true,
  },
  quotedFXRate: {
    type: Number,
    required: true,
  },
  executedFXRate: {
    type: Number,
  },
  fxSource: {
    type: String,
    enum: ['LIVE_API', 'CACHED', 'SIMULATED'],
    default: 'LIVE_API',
  },
  fxSpreadBps: {
    type: Number,
    required: true,
  },
  fxCostUSD: {
    type: Number,
    required: true,
  },
  fxAnalysis: {
    currentRate: Number,
    sma24h: Number,
    ema24h: Number,
    volatility: Number,
    volatilityClassification: String,
    recommendation: String,
    isSufficientHistory: Boolean,
  },
  selectedRail: {
    type: String,
    enum: ['REGIONAL_INSTANT', 'NETTING_LEDGER', 'RTGS_INSTANT', 'CARD_PUSH', 'SWIFT_BATCH'],
    required: true,
  },
  recommendedRail: {
    type: String,
    enum: ['REGIONAL_INSTANT', 'NETTING_LEDGER', 'RTGS_INSTANT', 'CARD_PUSH', 'SWIFT_BATCH'],
  },
  selectionMode: {
    type: String,
    enum: ['RECOMMENDED', 'MANUAL_OVERRIDE'],
    default: 'RECOMMENDED',
  },
  routingPreference: {
    type: String,
    enum: ['BALANCED', 'CHEAPEST', 'FASTEST'],
    default: 'BALANCED',
  },
  railFeeUSD: {
    type: Number,
    required: true,
  },
  totalSenderDebitUSD: {
    type: Number,
    required: true,
  },
  estimatedLatencyHours: {
    type: Number,
    required: true,
  },
  simulationDurationMs: {
    type: Number,
    default: 1500,
  },
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  riskLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'LOW',
  },
  totalCostUSD: {
    type: Number,
    required: true,
  },
  totalCostBps: {
    type: Number,
    required: true,
  },
  aiSavingsUSD: {
    type: Number,
    default: 0,
  },
  clearingReference: {
    type: String,
  },
  iso20022Message: {
    type: Object,
  },
  usedFallbackRail: {
    type: String,
  },
  status: {
    type: String,
    enum: TRANSACTION_STATUSES,
    default: 'CREATED',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

TransactionSchema.index({ sender: 1, timestamp: -1 });
TransactionSchema.index({ quoteId: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
module.exports.TRANSACTION_STATUSES = TRANSACTION_STATUSES;
