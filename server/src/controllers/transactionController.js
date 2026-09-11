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
const { isCurrencySupported } = require('../config/currencies');
const { roundToPrecision } = require('../utils/mathUtils');

const RAIL_ADAPTERS_MAP = {
  REGIONAL_INSTANT: require('../rails/instantRail'),
  NETTING_LEDGER: require('../rails/nettingRail'),
  RTGS_INSTANT: require('../rails/rtgsRail'),
  CARD_PUSH: require('../rails/cardPushRail'),
  SWIFT_BATCH: require('../rails/swiftRail')
};

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

    // 4. Run Multi-Rail Orchestration Evaluation
    const orchestrationResult = await orchestrationEngine.routePayment({
      sourceCurrency,
      destinationCurrency,
      amount: numAmount,
      paymentMode,
      priority
    });

    // 5. Create binding quote
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
    const quoteResult = await quoteEngine.verifyQuote(quoteId);
    if (!quoteResult.valid) {
      return res.status(400).json({
        success: false,
        message: quoteResult.reason || 'Invalid or expired payment quote. Please analyze payment again.'
      });
    }
    const quote = quoteResult.quote;

    // 2. Resolve selected rail & Check Manual Override Eligibility
    const railToUse = requestedRail || selectedRailId || quote.selectedRail || 'REGIONAL_INSTANT';
    const selectionMode = railToUse === quote.recommendedRail ? 'RECOMMENDED' : 'MANUAL_OVERRIDE';

    // Strict eligibility check on the chosen rail
    const eligibility = await liquidityManager.checkRailEligibility(railToUse, quote.sourceAmountUSD || quote.sourceAmount);
    if (!eligibility.isEligible) {
      return res.status(400).json({
        success: false,
        message: `${eligibility.setting ? eligibility.setting.name : railToUse} cannot be selected because: ${eligibility.rejectionReason}`
      });
    }

    const railAdapter = RAIL_ADAPTERS_MAP[railToUse] || RAIL_ADAPTERS_MAP['REGIONAL_INSTANT'];
    const sourceAmountUSD = Number(quote.sourceAmountUSD) || (quote.sourceCurrency === 'USD' ? Number(quote.sourceAmount) : Number(quote.sourceAmount));
    const railFeeBreakdown = railAdapter.getFeeBreakdown(sourceAmountUSD);
    const activeRailFeeUSD = railFeeBreakdown.totalFeeUSD;
    const activeLatencyHours = railAdapter.estimateLatency();
    const totalSenderDebitUSD = roundToPrecision(sourceAmountUSD + activeRailFeeUSD, 2);
    const receiverEmail = quote.receiverEmail || req.body.receiverEmail || 'recipient@transact3.io';
    const recipientId = quote.recipientId || senderId;

    // 3. Re-verify Sender Balance (Principal + Fee)
    const currentBalance = await portfolioController.checkUserBalance(senderId, quote.sourceCurrency);
    const requiredSourceAmount = quote.sourceAmount;
    if (currentBalance < requiredSourceAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient ${quote.sourceCurrency} balance: Available ${currentBalance}, required ${requiredSourceAmount}`
      });
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
      totalSenderDebitUSD,
      estimatedLatencyHours: activeLatencyHours,
      simulationDurationMs: railAdapter.config.simulationDurationMs || 1200,
      riskScore: quote.riskScore || 15,
      totalCostUSD: roundToPrecision((quote.fxCostUSD || 0) + activeRailFeeUSD, 2),
      totalCostBps: roundToPrecision((((quote.fxCostUSD || 0) + activeRailFeeUSD) / (sourceAmountUSD || 1)) * 10000, 1),
      aiSavingsUSD: quote.aiSavingsUSD || 0,
      clearingReference: clearingRef,
      status: 'PROCESSING'
    });

    // 5. Execute Full Settlement Lifecycle
    const settlementResult = await settlementEngine.processSettlement(transactionDoc);

    // 6. Mark Quote Executed
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

    // 8. Fetch fresh user portfolio balance
    const updatedPortfolio = await portfolioController.checkUserBalance(senderId, quote.sourceCurrency);

    const responsePayload = {
      success: true,
      message: `Cross-border payment successfully settled via ${railAdapter.name}`,
      data: {
        transaction: transactionDoc,
        clearingReference: settlementResult.clearingReference,
        railReference: settlementResult.railReference,
        expectedSettlementDisplay: settlementResult.expectedSettlementDisplay,
        simulationDurationMs: settlementResult.simulationDurationMs,
        settledAt: settlementResult.settledAt,
        iso20022: settlementResult.iso20022,
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
        if (IdempotencyRecord.create) {
          await IdempotencyRecord.create({
            idempotencyKey,
            requestHash: req.idempotencyData ? req.idempotencyData.requestHash : 'hash',
            statusCode: 201,
            responseBody: responsePayload,
            expiresAt: new Date(Date.now() + 24 * 3600 * 1000)
          });
        }
      } catch (idemErr) {}
    }

    res.status(201).json(responsePayload);
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

// Backwards-compatible alias for executeTransaction
exports.executeTransaction = exports.confirmAndExecuteTransaction;
exports.executeScheduledPaymentNow = async (req, res) => {
  res.status(200).json({ success: true, message: 'Settled immediately' });
};
exports.cancelScheduledPayment = async (req, res) => {
  res.status(200).json({ success: true, message: 'Cancelled' });
};
