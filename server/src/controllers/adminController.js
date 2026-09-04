const Transaction = require('../models/Transaction');
const User = require('../models/User');
const ledgerEngine = require('../services/ledgerEngine');
const auditEngine = require('../services/auditEngine');
const liquidityManager = require('../services/liquidityManager');

exports.getAdminMetrics = async (req, res, next) => {
  try {
    let totalTransactions = 0;
    let totalVolumeUSD = 0;
    let approvedCount = 0;
    let flaggedCount = 0;
    let blockedCount = 0;

    try {
      if (Transaction.find) {
        const txs = await Transaction.find({});
        totalTransactions = txs.length;
        for (const tx of txs) {
          totalVolumeUSD += tx.sourceAmount || 0;
          if (tx.status === 'COMPLETED' || tx.status === 'COMPLETED_VIA_FALLBACK') approvedCount++;
          else if (tx.status === 'MANUAL_REVIEW') flaggedCount++;
          else if (tx.status === 'REJECTED' || tx.status === 'FAILED') blockedCount++;
          else approvedCount++;
        }
      }
    } catch (e) {}

    const liquidity = liquidityManager.getAllStatus();

    res.status(200).json({
      success: true,
      data: {
        totalTransactions,
        totalVolumeUSD: parseFloat(totalVolumeUSD.toFixed(2)),
        approvedCount,
        flaggedCount,
        blockedCount,
        liquidityPools: liquidity.currencies,
        railUtilization: liquidity.rails
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getAdminTransactions = async (req, res, next) => {
  try {
    const { status, limit = 50 } = req.query;
    const query = {};
    if (status && status !== 'all') {
      if (status === 'approved') query.status = { $in: ['COMPLETED', 'COMPLETED_VIA_FALLBACK', 'SETTLED'] };
      else if (status === 'flagged') query.status = 'MANUAL_REVIEW';
      else if (status === 'blocked') query.status = { $in: ['REJECTED', 'FAILED'] };
    }

    let transactions = [];
    try {
      if (Transaction.find) {
        transactions = await Transaction.find(query)
          .sort({ timestamp: -1 })
          .limit(parseInt(limit))
          .populate('sender', 'name email');
      }
    } catch (e) {}

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (err) {
    next(err);
  }
};

exports.reconcileLedger = async (req, res, next) => {
  try {
    const reconciliation = await ledgerEngine.reconcileLedger();
    const recentEntries = await ledgerEngine.getRecentEntries(30);

    res.status(200).json({
      success: true,
      data: {
        reconciliation,
        recentEntries
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyAuditChain = async (req, res, next) => {
  try {
    const chainStatus = await auditEngine.verifyAuditChain();
    const recentLogs = await auditEngine.getAuditLogs(30);

    res.status(200).json({
      success: true,
      data: {
        chainStatus,
        recentLogs
      }
    });
  } catch (err) {
    next(err);
  }
};
