const Transaction = require('../models/Transaction');
const User = require('../models/User');
const ledgerEngine = require('../services/ledgerEngine');
const auditEngine = require('../services/auditEngine');
const liquidityManager = require('../services/liquidityManager');
const { roundToPrecision } = require('../utils/mathUtils');

exports.getAdminMetrics = async (req, res, next) => {
  try {
    let totalTransactions = 0;
    let totalVolumeUSD = 0;
    let completedCount = 0;
    let failedCount = 0;

    try {
      const txs = await Transaction.find({});
      totalTransactions = txs.length;
      for (const tx of txs) {
        totalVolumeUSD += tx.sourceAmount || 0;
        if (tx.status === 'COMPLETED' || tx.status === 'COMPLETED_VIA_FALLBACK') {
          completedCount++;
        } else if (tx.status === 'FAILED') {
          failedCount++;
        } else {
          completedCount++;
        }
      }
    } catch (e) {}

    const rails = await liquidityManager.getAllRailSettings();

    res.status(200).json({
      success: true,
      data: {
        totalTransactions,
        totalVolumeUSD: roundToPrecision(totalVolumeUSD, 2),
        completedCount,
        failedCount,
        rails
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getAdminRails = async (req, res, next) => {
  try {
    const rails = await liquidityManager.getAllRailSettings();
    res.status(200).json({
      success: true,
      data: rails
    });
  } catch (err) {
    next(err);
  }
};

exports.updateRail = async (req, res, next) => {
  try {
    const { railId } = req.params;
    const { isEnabled, availableLiquidityUSD } = req.body;

    let updated = null;
    if (isEnabled !== undefined) {
      updated = await liquidityManager.setRailEnabled(railId, isEnabled);
    }
    if (availableLiquidityUSD !== undefined) {
      updated = await liquidityManager.setRailLiquidity(railId, availableLiquidityUSD);
    }

    await auditEngine.logEvent({
      actor: req.user ? String(req.user._id) : 'ADMIN',
      action: 'ADMIN_RAIL_CONFIG_UPDATED',
      result: 'SUCCESS',
      metadata: { railId, isEnabled, availableLiquidityUSD }
    });

    res.status(200).json({
      success: true,
      message: `Rail ${railId} configuration updated successfully`,
      data: updated
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
      if (status === 'completed') query.status = 'COMPLETED';
      else if (status === 'failed') query.status = 'FAILED';
    }

    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'name email')
      .populate('recipient', 'name email');

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
    const recentEntries = await ledgerEngine.getRecentEntries(50);

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
    const recentLogs = await auditEngine.getAuditLogs(50);

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

exports.updateSimulationControls = async (req, res, next) => {
  try {
    const { action, railId, availableUSD } = req.body;

    if (action === 'RESET') {
      await liquidityManager.resetToDefaults();
    } else if (action === 'DISABLE_RAIL') {
      await liquidityManager.setRailEnabled(railId || 'REGIONAL_INSTANT', false);
    } else if (action === 'ENABLE_RAIL') {
      await liquidityManager.setRailEnabled(railId || 'REGIONAL_INSTANT', true);
    } else if (action === 'LOW_LIQUIDITY') {
      await liquidityManager.setRailLiquidity(railId || 'REGIONAL_INSTANT', availableUSD !== undefined ? availableUSD : 200);
    }

    const rails = await liquidityManager.getAllRailSettings();

    await auditEngine.logEvent({
      actor: req.user ? String(req.user._id) : 'ADMIN',
      action: `ADMIN_SIMULATION_CONTROL_${action}`,
      result: 'SUCCESS',
      metadata: { action, railId, availableUSD }
    });

    res.status(200).json({
      success: true,
      message: `Admin action '${action}' applied successfully to live orchestrator.`,
      data: rails
    });
  } catch (err) {
    next(err);
  }
};
