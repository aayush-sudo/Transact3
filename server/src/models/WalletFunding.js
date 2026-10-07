const mongoose = require('mongoose');

const WalletFundingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: { type: String, required: true, unique: true },
  paymentId: { type: String, unique: true, sparse: true },
  amountPaise: { type: Number, required: true, min: 100 },
  currency: { type: String, enum: ['INR'], default: 'INR' },
  status: {
    type: String,
    enum: ['ORDER_CREATED', 'VERIFYING', 'CAPTURED', 'CREDITED', 'FAILED'],
    default: 'ORDER_CREATED'
  },
  creditingAt: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WalletFunding', WalletFundingSchema);
