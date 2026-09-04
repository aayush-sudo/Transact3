const mongoose = require('mongoose');

const IdempotencyRecordSchema = new mongoose.Schema({
  idempotencyKey: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestHash: { type: String, required: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  responseBody: { type: Object, required: true },
  statusCode: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

IdempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('IdempotencyRecord', IdempotencyRecordSchema);
