const crypto = require('crypto');
const AuditLog = require('../models/AuditLog');

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

class AuditEngine {
  constructor() {
    this.lastHash = GENESIS_HASH;
    this.appendQueue = Promise.resolve();
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

  logEvent(params) {
    const append = this.appendQueue.then(() => this.appendEvent(params));
    this.appendQueue = append.catch(() => {});
    return append;
  }

  async appendEvent(params) {
    const { transactionId, actor = 'SYSTEM', action, requestId, result = 'SUCCESS', metadata = {} } = params;
    const latestEvent = await AuditLog.findOne({}).sort({ timestamp: -1, _id: -1 });
    const previousHash = latestEvent ? latestEvent.currentHash : GENESIS_HASH;

    const eventId = this.generateEventId();
    const eventData = { eventId, transactionId, actor, action, requestId, result, metadata, timestamp: new Date() };

    const currentHash = this.calculateHash(previousHash, eventData);
    const auditRecord = {
      ...eventData,
      previousHash,
      currentHash
    };

    try {
      if (AuditLog.create) {
        await AuditLog.create(auditRecord);
      }
    } catch (e) {
      throw new Error(`Audit event persistence failed: ${e.message}`);
    }

    this.lastHash = currentHash;

    return auditRecord;
  }

  async verifyAuditChain() {
    try {
      const logs = await AuditLog.find({}).sort({ timestamp: 1, _id: 1 });
      if (logs.length === 0) {
        return {
          isValid: true,
          totalBlocks: 0,
          verifiedAt: new Date(),
          genesisHash: GENESIS_HASH,
          headHash: this.lastHash,
          tamperedBlocks: []
        };
      }

      let expectedPrevHash = GENESIS_HASH;
      const tamperedBlocks = [];

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        if (log.previousHash !== expectedPrevHash) {
          tamperedBlocks.push({
            eventId: log.eventId,
            index: i,
            reason: 'Previous hash mismatch',
            expected: expectedPrevHash,
            actual: log.previousHash
          });
        }

        const eventData = {
          eventId: log.eventId,
          transactionId: log.transactionId,
          actor: log.actor,
          action: log.action,
          requestId: log.requestId,
          result: log.result,
          metadata: log.metadata,
          timestamp: log.timestamp
        };
        const expectedHash = this.calculateHash(expectedPrevHash, eventData);
        if (log.currentHash !== expectedHash) {
          tamperedBlocks.push({
            eventId: log.eventId,
            index: i,
            reason: 'Event hash mismatch',
            expected: expectedHash,
            actual: log.currentHash
          });
        }

        expectedPrevHash = log.currentHash;
      }

      return {
        isValid: tamperedBlocks.length === 0,
        totalBlocks: logs.length,
        verifiedAt: new Date(),
        genesisHash: GENESIS_HASH,
        headHash: logs[logs.length - 1] ? logs[logs.length - 1].currentHash : this.lastHash,
        tamperedBlocks
      };
    } catch (err) {
      console.error('[AuditEngine] verifyAuditChain error:', err.message);
      return { isValid: false, totalBlocks: 0, tamperedBlocks: [], error: err.message };
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
