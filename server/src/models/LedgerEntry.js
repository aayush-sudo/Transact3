const mongoose = require('mongoose');

const LedgerEntrySchema = new mongoose.Schema({
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  quoteId: { type: String },
  accountId: { type: String, required: true },
  accountName: { type: String, required: true },
  currency: { type: String, required: true },
  amount: { type: Number, required: true },
  entryType: { type: String, enum: ['DEBIT', 'CREDIT'], required: true },
  settlementRail: { type: String },
  description: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

LedgerEntrySchema.index({ accountId: 1, timestamp: -1 });
LedgerEntrySchema.index({ transactionId: 1 });

module.exports = mongoose.model('LedgerEntry', LedgerEntrySchema);
