const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: [true, 'Please add an amount'],
    min: [0.01, 'Amount must be greater than 0'],
  },
  currency: {
    type: String,
    required: [true, 'Please add a currency'],
    uppercase: true,
  },
  receiverCurrency: {
    type: String,
    required: [true, 'Please add receiver currency'],
    uppercase: true,
  },
  exchangeRate: {
    type: Number,
    required: true,
  },
  convertedAmount: {
    type: Number,
    required: true,
  },
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
  },
  status: {
    type: String,
    enum: ['approved', 'under_review', 'blocked'],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

TransactionSchema.index({ sender: 1, timestamp: -1 });
TransactionSchema.index({ receiver: 1, timestamp: -1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
