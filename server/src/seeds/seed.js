const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');
const LedgerEntry = require('../models/LedgerEntry');
const AuditLog = require('../models/AuditLog');
const auditEngine = require('../services/auditEngine');
const ledgerEngine = require('../services/ledgerEngine');

const seedDatabase = async () => {
  try {
    console.log('[Seed] Starting database seeding...');

    // 1. Create Default Demo Treasury User if not exists
    let demoUser = await User.findOne({ email: 'treasury@transact3.io' });
    if (!demoUser) {
      demoUser = await User.create({
        _id: new mongoose.Types.ObjectId('60c72b2f9b1d8b0015f8e001'),
        name: 'Treasury Manager',
        email: 'treasury@transact3.io',
        password: 'Password123!',
        walletBalance: 250000
      });
      console.log('[Seed] Created default demo user: treasury@transact3.io');
    }

    // 2. Create Initial Multi-Currency Portfolio
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
          { currency: 'BRL', amount: 200000, averageBuyPrice: 0.18 }
        ]
      });
      console.log('[Seed] Created multi-currency portfolio');
    }

    // 3. Seed Sample Historical Cross-Border Transactions
    const txCount = await Transaction.countDocuments();
    if (txCount === 0) {
      const sampleTxs = [
        {
          quoteId: 'QTE-HIST-001',
          sender: demoUser._id,
          receiverEmail: 'berlin.supplier@transact3.io',
          sourceCurrency: 'USD',
          destinationCurrency: 'EUR',
          sourceAmount: 100000,
          destinationAmount: 91700,
          referenceFXRate: 0.92,
          quotedFXRate: 0.917,
          executedFXRate: 0.917,
          fxSpreadBps: 30,
          fxCostUSD: 300,
          selectedRail: 'STABLECOIN_VAULT',
          railFeeUSD: 10.50,
          estimatedLatencyHours: 0.0008,
          riskScore: 15,
          riskLevel: 'LOW',
          totalCostUSD: 310.50,
          totalCostBps: 31,
          aiSavingsUSD: 2271.50,
          status: 'COMPLETED',
          clearingReference: 'CLR-STAB-992143',
          timestamp: new Date(Date.now() - 3600000 * 24 * 3)
        },
        {
          quoteId: 'QTE-HIST-002',
          sender: demoUser._id,
          receiverEmail: 'london.hq@transact3.io',
          sourceCurrency: 'USD',
          destinationCurrency: 'GBP',
          sourceAmount: 500000,
          destinationAmount: 393750,
          referenceFXRate: 0.79,
          quotedFXRate: 0.7875,
          executedFXRate: 0.7875,
          fxSpreadBps: 25,
          fxCostUSD: 1250,
          selectedRail: 'NETTING_LEDGER',
          railFeeUSD: 0.00,
          estimatedLatencyHours: 0.0003,
          riskScore: 12,
          riskLevel: 'LOW',
          totalCostUSD: 1250.00,
          totalCostBps: 25,
          aiSavingsUSD: 525.00,
          status: 'COMPLETED',
          clearingReference: 'CLR-NETT-881230',
          timestamp: new Date(Date.now() - 3600000 * 24 * 2)
        },
        {
          quoteId: 'QTE-HIST-003',
          sender: demoUser._id,
          receiverEmail: 'mumbai.vendor@transact3.io',
          sourceCurrency: 'USD',
          destinationCurrency: 'INR',
          sourceAmount: 25000,
          destinationAmount: 2072500,
          referenceFXRate: 83.20,
          quotedFXRate: 82.90,
          executedFXRate: 82.90,
          fxSpreadBps: 35,
          fxCostUSD: 87.50,
          selectedRail: 'REGIONAL_INSTANT',
          railFeeUSD: 6.50,
          estimatedLatencyHours: 0.001,
          riskScore: 22,
          riskLevel: 'LOW',
          totalCostUSD: 94.00,
          totalCostBps: 37,
          aiSavingsUSD: 43.50,
          status: 'COMPLETED',
          clearingReference: 'CLR-INST-447812',
          timestamp: new Date(Date.now() - 3600000 * 24 * 1)
        }
      ];

      for (const tx of sampleTxs) {
        const createdTx = await Transaction.create(tx);
        await ledgerEngine.recordDoubleEntry({
          transactionId: createdTx._id,
          quoteId: tx.quoteId,
          sourceCurrency: tx.sourceCurrency,
          destinationCurrency: tx.destinationCurrency,
          sourceAmount: tx.sourceAmount,
          destinationAmount: tx.destinationAmount,
          selectedRail: tx.selectedRail
        });
        await auditEngine.logEvent({
          transactionId: String(createdTx._id),
          action: 'SETTLEMENT_COMPLETED',
          result: 'SUCCESS',
          metadata: { selectedRail: tx.selectedRail, clearingReference: tx.clearingReference }
        });
      }
      console.log('[Seed] Seeded historical transactions, double-entry ledger records, and audit log chain');
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
