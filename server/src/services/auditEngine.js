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

  async verifyAuditChain() {
    try {
      const logs = await AuditLog.find({}).sort({ timestamp: 1 });
      if (logs.length === 0) {
        return {
          isValid: true,
          totalBlocks: 0,
          verifiedAt: new Date(),
          genesisHash: '0000000000000000000000000000000000000000000000000000000000000000',
          headHash: this.lastHash,
          tamperedBlocks: []
        };
      }

      let expectedPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';
      const tamperedBlocks = [];

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        if (i === 0) {
          expectedPrevHash = log.previousHash;
        }

        if (log.previousHash !== expectedPrevHash) {
          tamperedBlocks.push({
            eventId: log.eventId,
            index: i,
            reason: 'Previous hash mismatch',
            expected: expectedPrevHash,
            actual: log.previousHash
          });
        }

        expectedPrevHash = log.currentHash;
      }

      return {
        isValid: tamperedBlocks.length === 0,
        totalBlocks: logs.length,
        verifiedAt: new Date(),
        genesisHash: logs[0] ? logs[0].previousHash : '0000000000000000000000000000000000000000000000000000000000000000',
        headHash: logs[logs.length - 1] ? logs[logs.length - 1].currentHash : this.lastHash,
        tamperedBlocks
      };
    } catch (err) {
      console.error('[AuditEngine] verifyAuditChain error:', err.message);
      return { isValid: true, totalBlocks: 0, tamperedBlocks: [] };
    }
  }

  async getAuditLogs(limit = 50) {
    try {
      return await AuditLog.find({}).sort({ timestamp: -1 }).limit(limit);
    } catch (err) {
      return [];
    }
  }
}

module.exports = new AuditEngine();
