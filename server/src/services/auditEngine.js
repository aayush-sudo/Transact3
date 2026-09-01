const crypto = require('crypto');
const AuditLog = require('../models/AuditLog');

class AuditEngine {
  constructor() {
    this.lastHash = '0000000000000000000000000000000000000000000000000000000000000000';
  }

  generateEventId() {
    return `EVT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }

  calculateHash(previousHash, eventData) {
    return crypto
      .createHash('sha256')
      .update(previousHash + JSON.stringify(eventData))
      .digest('hex');
  }

  async logEvent(params) {
    const { transactionId, actor = 'SYSTEM', action, requestId, result = 'SUCCESS', metadata = {} } = params;

    const eventId = this.generateEventId();
    const eventData = { eventId, transactionId, actor, action, requestId, result, metadata, timestamp: new Date() };

    const currentHash = this.calculateHash(this.lastHash, eventData);
    const auditRecord = {
      ...eventData,
      previousHash: this.lastHash,
      currentHash
    };

    this.lastHash = currentHash;

    try {
      if (AuditLog.create) {
        await AuditLog.create(auditRecord);
      }
    } catch (e) {
      console.warn('[AuditEngine] DB persistence skipped:', e.message);
    }

    return auditRecord;
  }
}

module.exports = new AuditEngine();
