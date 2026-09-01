const mongoose = require('mongoose');

const FXExecutionSchema = new mongoose.Schema({
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  quoteId: { type: String, required: true },
  currencyPair: { type: String, required: true },
  referenceRate: { type: Number, required: true },
  quotedRate: { type: Number, required: true },
  executedRate: { type: Number, required: true },
  forecastRate: { type: Number },
  predictionErrorPct: { type: Number, default: 0 },
  spreadBps: { type: Number, required: true },
  slippageBps: { type: Number, default: 0 },
  executionTimestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FXExecution', FXExecutionSchema);
