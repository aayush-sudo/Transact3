const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');
const LedgerEntry = require('../models/LedgerEntry');
const AuditLog = require('../models/AuditLog');
const RailSetting = require('../models/RailSetting');
const auditEngine = require('../services/auditEngine');
const ledgerEngine = require('../services/ledgerEngine');
const liquidityManager = require('../services/liquidityManager');
const RAIL_CONFIG = require('../config/railConfig');

const seedDatabase = async () => {
  try {
    console.log('[Seed] Starting database seeding...');

    // 1. Initialize RailSettings in MongoDB
    await liquidityManager.initialize();

    // 2. Seed Alice (User A)
    let alice = await User.findOne({ email: 'alice@transact3.com' });
    if (!alice) {
      alice = await User.create({
        name: 'Alice Johnson',
        email: 'alice@transact3.com',
        password: 'Password123!',
        walletBalance: 10000
      });
      console.log('[Seed] Created User A: alice@transact3.com');
    }

    let alicePortfolio = await Portfolio.findOne({ user: alice._id });
    if (!alicePortfolio) {
      await Portfolio.create({
        user: alice._id,
        holdings: [
          { currency: 'USD', amount: 10000, averageBuyPrice: 1.0 },
          { currency: 'EUR', amount: 2000, averageBuyPrice: 1.08 },
          { currency: 'GBP', amount: 500, averageBuyPrice: 1.27 },
          { currency: 'INR', amount: 100000, averageBuyPrice: 0.0115 },
          { currency: 'AED', amount: 5000, averageBuyPrice: 0.272 },
          { currency: 'SGD', amount: 2500, averageBuyPrice: 0.74 },
          { currency: 'AUD', amount: 2000, averageBuyPrice: 0.66 },
          { currency: 'CAD', amount: 2000, averageBuyPrice: 0.735 },
          { currency: 'JPY', amount: 500000, averageBuyPrice: 0.0066 }
        ]
      });
      await ledgerEngine.recordDeposit({
        userId: alice._id,
        userEmail: alice.email,
        currency: 'USD',
        amount: 10000,
        description: 'Genesis Alice USD Funding'
      });
    }

    // 3. Seed Bob (User B)
    let bob = await User.findOne({ email: 'bob@transact3.com' });
    if (!bob) {
      bob = await User.create({
        name: 'Bob Smith',
        email: 'bob@transact3.com',
        password: 'Password123!',
        walletBalance: 5000
      });
      console.log('[Seed] Created User B: bob@transact3.com');
    }

    let bobPortfolio = await Portfolio.findOne({ user: bob._id });
    if (!bobPortfolio) {
      await Portfolio.create({
        user: bob._id,
        holdings: [
          { currency: 'USD', amount: 5000, averageBuyPrice: 1.0 },
          { currency: 'EUR', amount: 1000, averageBuyPrice: 1.08 },
          { currency: 'GBP', amount: 200, averageBuyPrice: 1.27 },
          { currency: 'INR', amount: 50000, averageBuyPrice: 0.0115 },
          { currency: 'AED', amount: 1000, averageBuyPrice: 0.272 },
          { currency: 'SGD', amount: 1000, averageBuyPrice: 0.74 },
          { currency: 'AUD', amount: 1000, averageBuyPrice: 0.66 },
          { currency: 'CAD', amount: 1000, averageBuyPrice: 0.735 },
          { currency: 'JPY', amount: 250000, averageBuyPrice: 0.0066 }
        ]
      });
      await ledgerEngine.recordDeposit({
        userId: bob._id,
        userEmail: bob.email,
        currency: 'USD',
        amount: 5000,
        description: 'Genesis Bob USD Funding'
      });
    }

    // 4. Seed Treasury / Admin User
    let demoUser = await User.findOne({ email: 'treasury@transact3.io' });
    if (!demoUser) {
      demoUser = await User.create({
        _id: new mongoose.Types.ObjectId('60c72b2f9b1d8b0015f8e001'),
        name: 'Treasury Admin',
        email: 'treasury@transact3.io',
        password: 'Password123!',
        walletBalance: 250000
      });
      console.log('[Seed] Created Treasury Admin: treasury@transact3.io');
    }

    let portfolio = await Portfolio.findOne({ user: demoUser._id });
    if (!portfolio) {
      await Portfolio.create({
        user: demoUser._id,
        holdings: [
          { currency: 'USD', amount: 150000, averageBuyPrice: 1.0 },
          { currency: 'EUR', amount: 80000, averageBuyPrice: 1.08 },
          { currency: 'GBP', amount: 50000, averageBuyPrice: 1.27 },
          { currency: 'INR', amount: 5000000, averageBuyPrice: 0.012 },
          { currency: 'JPY', amount: 12000000, averageBuyPrice: 0.0066 },
          { currency: 'AED', amount: 100000, averageBuyPrice: 0.272 },
          { currency: 'SGD', amount: 50000, averageBuyPrice: 0.74 },
          { currency: 'AUD', amount: 50000, averageBuyPrice: 0.66 },
          { currency: 'CAD', amount: 50000, averageBuyPrice: 0.735 }
        ]
      });
    }

    // 5. Seed Initial Sample Transactions
    const txCount = await Transaction.countDocuments();
    if (txCount === 0) {
      const sampleTxs = [
        {
          quoteId: 'QTE-HIST-001',
          sender: alice._id,
          recipient: bob._id,
          receiverEmail: 'bob@transact3.com',
          paymentMode: 'SEND_AMOUNT',
          sourceCurrency: 'USD',
          destinationCurrency: 'EUR',
          sourceAmount: 1000,
          destinationAmount: 920,
          referenceFXRate: 0.92,
          quotedFXRate: 0.92,
          executedFXRate: 0.92,
          fxSpreadBps: 30,
          fxCostUSD: 3.0,
          selectedRail: 'INSTANT_PAYMENT_LINK',
          recommendedRail: 'INSTANT_PAYMENT_LINK',
          selectionMode: 'RECOMMENDED',
          routingPreference: 'BALANCED',
          railFeeUSD: 1.70,
          totalSenderDebitUSD: 1001.70,
          estimatedLatencyHours: 0.0003,
          riskScore: 12,
          riskLevel: 'LOW',
          totalCostUSD: 4.70,
          totalCostBps: 47,
          aiSavingsUSD: 24.30,
          status: 'COMPLETED',
          clearingReference: 'CLR-INST-992143',
          timestamp: new Date(Date.now() - 3600000 * 24 * 2)
        },
        {
          quoteId: 'QTE-HIST-002',
          sender: demoUser._id,
          recipient: alice._id,
          receiverEmail: 'alice@transact3.com',
          paymentMode: 'SEND_AMOUNT',
          sourceCurrency: 'USD',
          destinationCurrency: 'GBP',
          sourceAmount: 5000,
          destinationAmount: 3950,
          referenceFXRate: 0.79,
          quotedFXRate: 0.79,
          executedFXRate: 0.79,
          fxSpreadBps: 25,
          fxCostUSD: 12.50,
          selectedRail: 'BILATERAL_NETTING',
          recommendedRail: 'BILATERAL_NETTING',
          selectionMode: 'RECOMMENDED',
          routingPreference: 'CHEAPEST',
          railFeeUSD: 0.00,
          totalSenderDebitUSD: 5000.00,
          estimatedLatencyHours: 0.0001,
          riskScore: 10,
          riskLevel: 'LOW',
          totalCostUSD: 12.50,
          totalCostBps: 25,
          aiSavingsUSD: 25.00,
          status: 'COMPLETED',
          clearingReference: 'CLR-NETT-881230',
          timestamp: new Date(Date.now() - 3600000 * 24 * 1)
        }
      ];

      for (const tx of sampleTxs) {
        const createdTx = await Transaction.create(tx);
        await ledgerEngine.recordPaymentSettlement({
          transactionId: createdTx._id,
          quoteId: tx.quoteId,
          senderId: tx.sender,
          recipientId: tx.recipient,
          senderEmail: 'sender@transact3.io',
          recipientEmail: tx.receiverEmail,
          sourceCurrency: tx.sourceCurrency,
          destinationCurrency: tx.destinationCurrency,
          sourceAmount: tx.sourceAmount,
          destinationAmount: tx.destinationAmount,
          railFeeUSD: tx.railFeeUSD,
          selectedRail: tx.selectedRail
        });
        await auditEngine.logEvent({
          transactionId: String(createdTx._id),
          actor: String(tx.sender),
          action: 'SETTLEMENT_COMPLETED',
          result: 'SUCCESS',
          metadata: { selectedRail: tx.selectedRail, clearingReference: tx.clearingReference }
        });
      }
      console.log('[Seed] Seeded sample transactions and ledger entries');
    }

    console.log('[Seed] Seeding completed successfully!');
  } catch (err) {
    console.error('[Seed] Seeding error:', err.message);
  }
};

module.exports = seedDatabase;

if (require.main === module) {
  const connectDB = require('../config/db');
  connectDB().then(() => {
    seedDatabase().then(() => process.exit(0));
  });
}
