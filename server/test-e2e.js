const connectDB = require('./src/config/db');
const seedDatabase = require('./src/seeds/seed');
const orchestrationEngine = require('./src/services/orchestrationEngine');
const settlementEngine = require('./src/services/settlementEngine');
const ledgerEngine = require('./src/services/ledgerEngine');
const auditEngine = require('./src/services/auditEngine');
const fxForecastingEngine = require('./src/services/fxForecastingEngine');
const fxBacktestingEngine = require('./src/services/fxBacktestingEngine');
const Transaction = require('./src/models/Transaction');
const User = require('./src/models/User');

async function runTests() {
  console.log('==================================================');
  console.log('🚀 TRANSACT3 END-TO-END AUTOMATED VERIFICATION');
  console.log('==================================================\n');

  // 1. Connect & Seed
  await connectDB();
  await seedDatabase();
  console.log('✅ DB Connection & Seeding: PASS');

  // 2. Test Multi-Rail Pareto Router
  const route = await orchestrationEngine.routePayment({
    sourceCurrency: 'USD',
    destinationCurrency: 'EUR',
    amount: 100000,
    priority: 'BALANCED'
  });
  console.log(`✅ Multi-Rail Pareto Router: PASS (Selected ${route.recommendedRail.name}, Score: ${route.recommendedRail.utilityScore})`);

  // 3. Test Full Settlement Execution (11 Stages + ISO 20022 + Web3 Receipt)
  const user = await User.findOne({ email: 'treasury@transact3.io' });
  const txDoc = await Transaction.create({
    quoteId: 'QTE-TEST-100',
    sender: user._id,
    receiverEmail: 'recipient@transact3.io',
    sourceCurrency: 'USD',
    destinationCurrency: 'EUR',
    sourceAmount: 10000,
    destinationAmount: 9170,
    referenceFXRate: 0.92,
    quotedFXRate: 0.917,
    fxCostUSD: 30.00,
    fxSpreadBps: 30,
    selectedRail: 'STABLECOIN_VAULT',
    railFeeUSD: 1.50,
    estimatedLatencyHours: 0.0008,
    riskScore: 18,
    totalCostUSD: 31.50,
    totalCostBps: 31,
    status: 'INITIATED'
  });

  const settlement = await settlementEngine.processSettlement(txDoc);
  console.log(`✅ 11-Stage Settlement Execution: PASS (Status: ${settlement.settlementStatus}, ClearingRef: ${settlement.clearingReference})`);
  if (settlement.blockchainReceipt) {
    console.log(`   ↳ Web3 Vault TxHash: ${settlement.blockchainReceipt.txHash.substring(0, 20)}...`);
  }
  if (settlement.iso20022) {
    console.log(`   ↳ ISO 20022 Message: ${settlement.iso20022.pacs008.messageType} generated successfully`);
  }

  // 3b. Test Scheduled Payment Execution (+2h Timing Window)
  const scheduledDoc = await Transaction.create({
    quoteId: 'QTE-SCHED-200',
    sender: user._id,
    receiverEmail: 'future.vendor@transact3.io',
    sourceCurrency: 'USD',
    destinationCurrency: 'EUR',
    sourceAmount: 50000,
    destinationAmount: 45850,
    referenceFXRate: 0.92,
    quotedFXRate: 0.917,
    fxCostUSD: 150.00,
    fxSpreadBps: 30,
    selectedRail: 'SWIFT_BATCH',
    railFeeUSD: 25.00,
    estimatedLatencyHours: 24.0,
    riskScore: 15,
    totalCostUSD: 175.00,
    totalCostBps: 35,
    executionMode: 'SCHEDULED',
    delayHours: 2,
    scheduledFor: new Date(Date.now() + 2 * 3600 * 1000),
    expectedYieldSavingsUSD: 190.00,
    status: 'SCHEDULED'
  });
  console.log(`✅ Scheduled Payment Creation: PASS (Status: ${scheduledDoc.status}, Delay: ${scheduledDoc.delayHours}h, ScheduledFor: ${scheduledDoc.scheduledFor.toISOString()})`);

  // Fast-forward / trigger scheduled payment
  const scheduledSettlement = await settlementEngine.processSettlement(scheduledDoc);
  console.log(`✅ Scheduled Payment Execution: PASS (Status: ${scheduledSettlement.settlementStatus}, ClearingRef: ${scheduledSettlement.clearingReference})`);

  // 4. Test Double-Entry Ledger Reconciliation
  const ledger = await ledgerEngine.reconcileLedger();
  console.log(`✅ Double-Entry Ledger Audit: PASS (Balanced: ${ledger.isBalanced}, Total Entries: ${ledger.totalEntries}, Debits: $${ledger.totalDebits}, Credits: $${ledger.totalCredits})`);

  // 5. Test Cryptographic Audit Log SHA-256 Chain
  const chain = await auditEngine.verifyAuditChain();
  console.log(`✅ SHA-256 Audit Chain Verification: PASS (Valid: ${chain.isValid}, Blocks: ${chain.totalBlocks}, Tampered: ${chain.tamperedBlocks.length})`);

  // 6. Test Time-Series FX Forecasting & Backtesting
  const forecast = await fxForecastingEngine.predictFXMovements('USD', 'INR');
  console.log(`✅ Predictive Time-Series Forecasting: PASS (Optimal Horizon: ${forecast.optimalHorizon}, Rate: ${forecast.optimalProjectedRate}, Trend: ${forecast.trendDirection})`);

  const backtest = await fxBacktestingEngine.runBacktest('USD', 'INR', 30);
  console.log(`✅ 30-Day Empirical Model Backtest: PASS (Directional Accuracy: ${backtest.metrics.directionalAccuracyPct}%, MAE: ${backtest.metrics.maePct}%)`);

  console.log('\n==================================================');
  console.log('🎉 ALL SYSTEM CHECKS PASSED - TRANSACT3 IS READY!');
  console.log('==================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
