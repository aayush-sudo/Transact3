const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  transactionId: { type: String },
  actor: { type: String, required: true },
  action: { type: String, required: true },
  requestId: { type: String },
  result: { type: String, enum: ['SUCCESS', 'FAILURE', 'WARNING'], default: 'SUCCESS' },
  metadata: { type: Object },
  previousHash: { type: String, default: '0' },
  currentHash: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

AuditLogSchema.index({ transactionId: 1 });
AuditLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
