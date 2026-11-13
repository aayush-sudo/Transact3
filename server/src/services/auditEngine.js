const crypto = require('crypto');
const mongoose = require('mongoose');
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

    let previousHash = this.lastHash;
    // Check if MongoDB is connected (readyState 1)
    const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;

    if (isDbConnected) {
      try {
        const latestEvent = await AuditLog.findOne({}).sort({ timestamp: -1, _id: -1 });
        if (latestEvent && latestEvent.currentHash) {
          previousHash = latestEvent.currentHash;
        }
      } catch (err) {
        // Fallback to in-memory head hash
        previousHash = this.lastHash;
      }
    }

    const eventId = this.generateEventId();
    const eventData = { eventId, transactionId, actor, action, requestId, result, metadata, timestamp: new Date() };

    const currentHash = this.calculateHash(previousHash, eventData);
    const auditRecord = {
      ...eventData,
      previousHash,
      currentHash
    };

    if (isDbConnected) {
      try {
        if (AuditLog.create) {
          await AuditLog.create(auditRecord);
        }
      } catch (e) {
        console.warn(`[AuditEngine] MongoDB persistence skipped: ${e.message}`);
      }
    }

    this.lastHash = currentHash;
    return auditRecord;
  }

  async verifyAuditChain() {
    const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      return {
        isValid: true,
        totalBlocks: 0,
        verifiedAt: new Date(),
        genesisHash: GENESIS_HASH,
        headHash: this.lastHash,
        tamperedBlocks: []
      };
    }

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

      let previousHash = GENESIS_HASH;
      const tamperedBlocks = [];

      for (let i = 0; i < logs.length; i++) {
        const record = logs[i];
        if (record.previousHash !== previousHash) {
          tamperedBlocks.push({
            sequence: i,
            eventId: record.eventId,
            expectedPreviousHash: previousHash,
            actualPreviousHash: record.previousHash,
            tamperType: 'PREVIOUS_HASH_MISMATCH'
          });
        }

        const eventData = {
          eventId: record.eventId,
          transactionId: record.transactionId,
          actor: record.actor,
          action: record.action,
          requestId: record.requestId,
          result: record.result,
          metadata: record.metadata,
          timestamp: record.timestamp
        };

        const recomputedHash = this.calculateHash(record.previousHash, eventData);
        if (recomputedHash !== record.currentHash) {
          tamperedBlocks.push({
            sequence: i,
            eventId: record.eventId,
            expectedHash: recomputedHash,
            actualHash: record.currentHash,
            tamperType: 'PAYLOAD_OR_CURRENT_HASH_MISMATCH'
          });
        }

        previousHash = record.currentHash;
      }

      return {
        isValid: tamperedBlocks.length === 0,
        totalBlocks: logs.length,
        verifiedAt: new Date(),
        genesisHash: GENESIS_HASH,
        headHash: previousHash,
        tamperedBlocks
      };
    } catch (err) {
      throw new Error(`Audit chain verification failed: ${err.message}`);
    }
  }
}

module.exports = new AuditEngine();
