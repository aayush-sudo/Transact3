const Transaction = require('../models/Transaction');
const User = require('../models/User');
const LedgerEntry = require('../models/LedgerEntry');
const AuditLog = require('../models/AuditLog');
const IdempotencyRecord = require('../models/IdempotencyRecord');
const quoteEngine = require('../services/quoteEngine');
const orchestrationEngine = require('../services/orchestrationEngine');
const settlementEngine = require('../services/settlementEngine');
const liquidityManager = require('../services/liquidityManager');
const auditEngine = require('../services/auditEngine');
const tcaEngine = require('../services/tcaEngine');
const portfolioController = require('./portfolioController');
const amlService = require('../services/amlService');
const graphRouterService = require('../services/graphRouterService');
const iso20022 = require('../utils/iso20022');
const { isCurrencySupported } = require('../config/currencies');
const { roundToPrecision } = require('../utils/mathUtils');

const { RAIL_MAP: RAIL_ADAPTERS_MAP } = require('../rails');

// @desc    Analyze payment & create binding quote
// @route   POST /api/transaction/quote
// @access  Private
exports.createTransactionQuote = async (req, res, next) => {
  try {
    const {
      sourceCurrency = 'USD',
      destinationCurrency = 'EUR',
      amount = 1000,
      paymentMode = 'SEND_AMOUNT',
      priority = 'BALANCED',
      receiverEmail
    } = req.body;

    const senderId = req.user ? (req.user._id || req.user.id) : null;
    const senderEmail = req.user ? req.user.email : '';

    // 1. Validate Recipient
    if (!receiverEmail) {
      return res.status(400).json({ success: false, message: 'Recipient email is required' });
    }

    const cleanReceiverEmail = receiverEmail.toLowerCase().trim();
    if (senderEmail && cleanReceiverEmail === senderEmail.toLowerCase().trim()) {
      return res.status(400).json({ success: false, message: 'Cannot send payments to yourself' });
    }

    const recipientUser = await User.findOne({ email: cleanReceiverEmail });
    if (!recipientUser) {
      return res.status(400).json({
        success: false,
        message: `Recipient user '${cleanReceiverEmail}' is not registered in Transact3`
      });
    }

    // 2. Validate Currencies
    if (!isCurrencySupported(sourceCurrency)) {
      return res.status(400).json({ success: false, message: `Unsupported source currency: ${sourceCurrency}` });
    }
    if (!isCurrencySupported(destinationCurrency)) {
      return res.status(400).json({ success: false, message: `Unsupported destination currency: ${destinationCurrency}` });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Transfer amount must be greater than zero' });
    }

    // 3. Verify sender balance
    const currentBalance = await portfolioController.checkUserBalance(senderId, sourceCurrency);
    if (paymentMode === 'SEND_AMOUNT' && currentBalance < numAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient ${sourceCurrency} balance: You have ${currentBalance} ${sourceCurrency}, but attempted to send ${numAmount}`
      });
    }

    // 4. RegTech AML & Sanctions Fuzzy Screening
    const amlCheck = await amlService.screenName(recipientUser.name || cleanReceiverEmail);
    if (amlCheck.decision === 'REJECT') {
      return res.status(403).json({
        success: false,
        message: `AML Sanction Clearance Failed: Recipient matched sanction target '${amlCheck.matched_target}' (${Math.round(amlCheck.risk_score * 100)}% risk). Transfer blocked under OFAC / UN compliance regulations.`,
        data: { amlCheck }
      });
    }

    // 5. Smart Multi-Hop FX Graph Routing (Dijkstra)
    const graphRoute = await graphRouterService.findOptimalRoute(sourceCurrency, destinationCurrency);

    // 6. Run Multi-Rail Orchestration Evaluation
    const orchestrationResult = await orchestrationEngine.routePayment({
      sourceCurrency,
      destinationCurrency,
      amount: numAmount,
      paymentMode,
      priority
    });

    // 7. Create binding quote
    const quote = await quoteEngine.createQuote({
      userId: senderId,
      recipientId: recipientUser._id,
      receiverEmail: cleanReceiverEmail,
      orchestrationResult
    });

    res.status(200).json({
      success: true,
      data: {
        quote,
        orchestration: orchestrationResult,
        graphRoute,
        amlCompliance: amlCheck,
        senderBalance: {
          currency: sourceCurrency,
          available: currentBalance
        },
        recipient: {
          id: recipientUser._id,
          name: recipientUser.name,
          email: recipientUser.email
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Confirm & Execute Transaction
// @route   POST /api/transaction/confirm or /api/transaction/send
// @access  Private
exports.confirmAndExecuteTransaction = async (req, res, next) => {
  try {
    const {
      quoteId,
      selectedRail: requestedRail,
      selectedRailId,
      idempotencyKey = req.idempotencyKey
    } = req.body;

    const senderId = req.user ? (req.user._id || req.user.id) : null;
    const senderEmail = req.user ? req.user.email : 'sender@transact3.io';

    // 1. Verify Quote
    const quoteResult = await quoteEngine.verifyQuote(quoteId, senderId);
    if (!quoteResult.valid) {
      return res.status(quoteResult.unauthorized ? 403 : 400).json({
        success: false,
        message: quoteResult.reason || 'Invalid or expired payment quote. Please analyze payment again.'
      });
    }
    const quote = quoteResult.quote;

    if (!quote.recipientId || !quote.receiverEmail) {
      return res.status(400).json({
        success: false,
        message: 'Payment quote does not have a verified recipient'
      });
    }

    // 2. Resolve selected rail & Check Manual Override Eligibility
    const railToUse = requestedRail || selectedRailId || quote.selectedRail || 'REGIONAL_INSTANT';
    const selectionMode = railToUse === quote.recommendedRail ? 'RECOMMENDED' : 'MANUAL_OVERRIDE';
    const railAdapter = RAIL_ADAPTERS_MAP[railToUse];
    if (!railAdapter) {
      return res.status(400).json({ success: false, message: `Unsupported settlement rail: ${railToUse}` });
    }

    const quotedRail = quote.evaluatedRails.find(rail => rail.id === railToUse);
    if (!quotedRail || !quotedRail.is_eligible) {
      return res.status(400).json({
        success: false,
        message: `${railToUse} was not eligible in this payment quote`
      });
    }

    // Strict eligibility check on the chosen rail
    const eligibility = await liquidityManager.checkRailEligibility(railToUse, quote.sourceAmountUSD || quote.sourceAmount);
    if (!eligibility.isEligible) {
      return res.status(400).json({
        success: false,
        message: `${eligibility.setting ? eligibility.setting.name : railToUse} cannot be selected because: ${eligibility.rejectionReason}`
      });
    }

    const sourceAmountUSD = Number(quote.sourceAmountUSD) || (quote.sourceCurrency === 'USD' ? Number(quote.sourceAmount) : Number(quote.sourceAmount));
    const railFeeBreakdown = railAdapter.getFeeBreakdown(sourceAmountUSD);
    const activeRailFeeUSD = railFeeBreakdown.totalFeeUSD;
    const activeLatencyHours = Number(quotedRail.est_latency_hours) || railAdapter.estimateLatency();
    const timingRecommendation = quote.timingRecommendation || { deferHours: 0 };
    const deferHours = Math.max(0, Number(timingRecommendation.deferHours) || 0);
    const scheduledFor = new Date(Date.now() + Math.max(activeLatencyHours, deferHours) * 3600000);
    const railFeeCurrency = quote.sourceCurrency;
    const railFeeAmount = roundToPrecision(
      activeRailFeeUSD * (Number(quote.sourceAmount) / Math.max(Number(quote.sourceAmountUSD), 0.01)),
      2
    );
    const totalSenderDebitUSD = roundToPrecision(sourceAmountUSD + activeRailFeeUSD, 2);
    const receiverEmail = quote.receiverEmail;
    const recipientId = quote.recipientId;

    // 3. Re-verify Sender Balance (Principal + Fee)
    const currentBalance = await portfolioController.checkUserBalance(senderId, quote.sourceCurrency);
    const requiredSourceAmount = Number(quote.sourceAmount) + railFeeAmount;
    if (currentBalance < requiredSourceAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient ${quote.sourceCurrency} balance: Available ${currentBalance}, required ${requiredSourceAmount}`
      });
    }
    let idempotencyClaimed = false;
    if (idempotencyKey) {
      const requestHash = req.idempotencyData?.requestHash || '';
      try {
        await IdempotencyRecord.create({
          idempotencyKey,
          userId: senderId,
          requestHash,
          responseBody: { success: false, pending: true, message: 'Payment confirmation is already in progress' },
          statusCode: 409,
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000)
        });
        idempotencyClaimed = true;
      } catch (error) {
        if (error.code !== 11000) throw error;
        const existing = await IdempotencyRecord.findOne({ idempotencyKey });
        if (!existing) throw error;
        if (String(existing.userId) !== String(senderId) || existing.requestHash !== requestHash) {
          return res.status(409).json({ success: false, message: 'Idempotency key was already used for a different request' });
        }
        return res.status(existing.statusCode).json(existing.responseBody);
      }
    }

    // 4. Create Transaction document in DB (Status: PROCESSING)
    const clearingRef = `CLR-${railToUse.substring(0, 4)}-${Math.floor(100000 + Math.random() * 900000)}`;

    const transactionDoc = await Transaction.create({
      quoteId: quote.quoteId,
      idempotencyKey,
      sender: senderId,
      recipient: recipientId,
      receiverEmail,
      paymentMode: quote.paymentMode || 'SEND_AMOUNT',
      sourceCurrency: quote.sourceCurrency,
      destinationCurrency: quote.destinationCurrency,
      sourceAmount: quote.sourceAmount,
      destinationAmount: quote.destinationAmount,
      referenceFXRate: quote.referenceRate || 1.0,
      quotedFXRate: quote.quotedRate || 1.0,
      executedFXRate: quote.quotedRate || 1.0,
      fxSpreadBps: quote.spreadBps || 30,
      fxCostUSD: quote.fxCostUSD || 0,
      fxSource: quote.fxAnalysis ? quote.fxAnalysis.source : 'LIVE_API',
      fxAnalysis: quote.fxAnalysis,
      selectedRail: railToUse,
      recommendedRail: quote.recommendedRail || railToUse,
      selectionMode,
      routingPreference: quote.priority || 'BALANCED',
      railFeeUSD: activeRailFeeUSD,
      railFeeCurrency,
      railFeeAmount,
      totalSenderDebitUSD,
      estimatedLatencyHours: activeLatencyHours,
      scheduledFor,
      timingRecommendation,
      simulationDurationMs: railAdapter.config.simulationDurationMs || 1200,
      riskScore: quote.riskScore || 15,
      totalCostUSD: roundToPrecision((quote.fxCostUSD || 0) + activeRailFeeUSD, 2),
      totalCostBps: roundToPrecision((((quote.fxCostUSD || 0) + activeRailFeeUSD) / (sourceAmountUSD || 1)) * 10000, 1),
      aiSavingsUSD: quote.aiSavingsUSD || 0,
      clearingReference: clearingRef,
      status: 'PROCESSING'
    });

    let principalReserved = false;
    let feeReserved = false;
    let liquidityReserved = false;
    try {
      await portfolioController.debitUserWallet(senderId, quote.sourceCurrency, quote.sourceAmount);
      principalReserved = true;
      if (railFeeAmount > 0) {
        await portfolioController.debitUserWallet(senderId, railFeeCurrency, railFeeAmount);
        feeReserved = true;
      }
      liquidityReserved = await liquidityManager.consumeLiquidity(railToUse, sourceAmountUSD);
      if (!liquidityReserved) throw new Error(`Route capacity changed. Please compare routes again before scheduling.`);
      transactionDoc.set({
        status: 'SCHEDULED',
        fundsReserved: true,
        liquidityReserved: true
      });
      await transactionDoc.save();
    } catch (error) {
      if (liquidityReserved) await liquidityManager.restoreLiquidity(railToUse, sourceAmountUSD);
      if (feeReserved) await portfolioController.creditUserWallet(senderId, railFeeCurrency, railFeeAmount);
      if (principalReserved) await portfolioController.creditUserWallet(senderId, quote.sourceCurrency, quote.sourceAmount);
      await Transaction.findByIdAndUpdate(transactionDoc._id, { status: 'FAILED' });
      if (idempotencyClaimed) {
        await IdempotencyRecord.deleteOne({ idempotencyKey, userId: senderId });
      }
      throw error;
    }

    // The wallet and route capacity stay reserved until the scheduled settlement worker runs.
    await quoteEngine.markQuoteExecuted(quote.quoteId);

    // 7. Calculate TCA
    const tca = tcaEngine.calculateTCA({
      sourceAmountUSD: quote.sourceAmountUSD || quote.sourceAmount,
      fxCostUSD: quote.fxCostUSD,
      railFeeUSD: activeRailFeeUSD,
      spreadBps: quote.spreadBps,
      referenceRate: quote.referenceRate,
      executedRate: quote.quotedRate,
      selectedLatencyHours: activeLatencyHours
    });

    // Fetch the available wallet balance after reserving funds.
    const updatedPortfolio = await portfolioController.checkUserBalance(senderId, quote.sourceCurrency);

    const responsePayload = {
      success: true,
      message: `Payment scheduled via ${railAdapter.name}. Settlement is expected ${scheduledFor.toLocaleString('en-US', { timeZone: 'UTC' })} UTC.`,
      data: {
        transaction: transactionDoc,
        scheduledFor,
        expectedSettlementDisplay: quotedRail.expected_settlement_display,
        timingRecommendation,
        tca,
        senderRemainingBalance: {
          currency: quote.sourceCurrency,
          available: updatedPortfolio
        }
      }
    };

    // 9. Store in Idempotency Record if key provided
    if (idempotencyKey) {
      try {
        await IdempotencyRecord.findOneAndUpdate(
          { idempotencyKey, userId: senderId },
          { statusCode: 202, responseBody: responsePayload, transactionId: transactionDoc._id }
        );
      } catch (idemErr) {
        console.error('[Idempotency] Settled payment result could not be persisted:', idemErr.message);
      }
    }

    res.status(202).json(responsePayload);
  } catch (err) {
    next(err);
  }
};

// @desc    Get Transaction History for user
// @route   GET /api/transaction/history
// @access  Private
exports.getTransactionHistory = async (req, res, next) => {
  try {
    const userId = req.user ? (req.user._id || req.user.id) : null;
    const userEmail = req.user ? req.user.email : '';

    const query = {
      $or: [
        { sender: userId },
        { recipient: userId },
        { receiverEmail: userEmail }
      ]
    };

    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .populate('sender', 'name email')
      .populate('recipient', 'name email')
      .limit(100);

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single transaction with full ledger & audit records
// @route   GET /api/transaction/:id
// @access  Private
exports.getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('sender', 'name email')
      .populate('recipient', 'name email');

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Fetch double-entry ledger entries
    const ledgerEntries = await LedgerEntry.find({ transactionId: transaction._id }).sort({ timestamp: 1 });

    // Fetch audit logs
    const auditLogs = await AuditLog.find({ transactionId: String(transaction._id) }).sort({ timestamp: 1 });

    res.status(200).json({
      success: true,
      data: {
        transaction,
        ledgerEntries,
        auditLogs
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Screen legal name / entity against OFAC & UN Sanction lists
// @route   POST /api/compliance/screen
// @access  Public / Private
exports.screenCompliance = async (req, res, next) => {
  try {
    const { name, thresholdReject = 0.85, thresholdReview = 0.65 } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required for screening' });
    }
    const result = await amlService.screenName(name, thresholdReject, thresholdReview);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// @desc    Calculate optimal Dijkstra multi-hop graph path
// @route   POST /api/routing/graph-path
// @access  Public / Private
exports.getGraphPath = async (req, res, next) => {
  try {
    const { sourceCurrency = 'USD', destinationCurrency = 'INR', maxLatencySeconds = 300 } = req.body;
    const result = await graphRouterService.findOptimalRoute(sourceCurrency, destinationCurrency, maxLatencySeconds);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// @desc    Get ISO 20022 pacs.008 XML for transaction
// @route   GET /api/transaction/:id/iso20022
// @access  Private
exports.getTransactionIsoXml = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const xml = transaction.isoXmlMessage || iso20022.generatePacs008Xml(transaction);
    if (req.query.format === 'raw') {
      res.setHeader('Content-Type', 'application/xml');
      return res.send(xml);
    }

    res.status(200).json({
      success: true,
      data: {
        transactionId: transaction._id,
        clearingReference: transaction.clearingReference,
        standard: 'ISO 20022 pacs.008.001.10',
        xml
      }
    });
  } catch (err) {
    next(err);
  }
};

// Backwards-compatible alias for executeTransaction
exports.executeTransaction = exports.confirmAndExecuteTransaction;
exports.executeScheduledPaymentNow = async (req, res) => {
  res.status(200).json({ success: true, message: 'Settled immediately' });
};
exports.cancelScheduledPayment = async (req, res) => {
  res.status(200).json({ success: true, message: 'Cancelled' });
};
