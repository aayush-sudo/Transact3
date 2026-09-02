const mongoose = require('mongoose');

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
  receiverEmail: {
    type: String,
    required: true,
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
  fxSpreadBps: {
    type: Number,
    required: true,
  },
  fxCostUSD: {
    type: Number,
    required: true,
  },
  fxForecast: {
    horizon6h: Number,
    horizon12h: Number,
    horizon24h: Number,
    horizon48h: Number,
    volatility: Number,
    confidence: Number,
  },
  fxTimingDecision: {
    recommendation: {
      type: String,
      enum: ['EXECUTE_NOW', 'DEFER_1H', 'DEFER_6H', 'DEFER_12H', 'DEFER_24H'],
      default: 'EXECUTE_NOW',
    },
    expectedSavingsPct: Number,
    explanation: String,
  },
  selectedRail: {
    type: String,
    enum: ['SWIFT_BATCH', 'RTGS_INSTANT', 'REGIONAL_INSTANT', 'STABLECOIN_VAULT', 'NETTING_LEDGER', 'CARD_PUSH'],
    required: true,
  },
  railFeeUSD: {
    type: Number,
    required: true,
  },
  estimatedLatencyHours: {
    type: Number,
    required: true,
  },
  currencyLiquidityRequired: Number,
  currencyLiquidityAvailable: Number,
  railUtilizationPct: Number,
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
  fxSlippageBps: {
    type: Number,
    default: 0,
  },
  aiSavingsUSD: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: [
      'INITIATED',
      'VALIDATED',
      'QUOTED',
      'AUTHORIZED',
      'FX_PENDING',
      'FX_EXECUTED',
      'RAIL_SELECTED',
      'LIQUIDITY_RESERVED',
      'SETTLEMENT_PENDING',
      'SETTLED',
      'COMPLETED',
      'REJECTED',
      'EXPIRED',
      'FAILED',
      'CANCELLED',
      'MANUAL_REVIEW'
    ],
    default: 'INITIATED',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

TransactionSchema.index({ sender: 1, timestamp: -1 });
TransactionSchema.index({ quoteId: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
