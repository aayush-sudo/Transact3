const mongoose = require('mongoose');

const RailSettingSchema = new mongoose.Schema({
  railId: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'SWIFT_CORRESPONDENT', 'INSTANT_PAYMENT_LINK', 'RTGS_SETTLEMENT', 'BILATERAL_NETTING', 'CARD_PAYOUT',
      'REGIONAL_INSTANT', 'NETTING_LEDGER', 'RTGS_INSTANT', 'CARD_PUSH', 'SWIFT_BATCH'
    ]
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  isEnabled: {
    type: Boolean,
    default: true
  },
  baseFeeUSD: {
    type: Number,
    required: true
  },
  variableFeeBps: {
    type: Number,
    required: true
  },
  avgLatencyHours: {
    type: Number,
    required: true
  },
  expectedSettlementDisplay: {
    type: String,
    required: true
  },
  simulationDurationMs: {
    type: Number,
    default: 1500
  },
  maxAmountUSD: {
    type: Number,
    required: true
  },
  reliabilityScore: {
    type: Number,
    required: true
  },
  availableLiquidityUSD: {
    type: Number,
    required: true
  },
  initialLiquidityUSD: {
    type: Number,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('RailSetting', RailSettingSchema);
