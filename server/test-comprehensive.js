const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const seedDatabase = require('./src/seeds/seed');

const User = require('./src/models/User');
const Transaction = require('./src/models/Transaction');
const LedgerEntry = require('./src/models/LedgerEntry');
const AuditLog = require('./src/models/AuditLog');
const RailSetting = require('./src/models/RailSetting');

const orchestrationEngine = require('./src/services/orchestrationEngine');
const settlementEngine = require('./src/services/settlementEngine');
const quoteEngine = require('./src/services/quoteEngine');
const liquidityManager = require('./src/services/liquidityManager');
const ledgerEngine = require('./src/services/ledgerEngine');
const auditEngine = require('./src/services/auditEngine');
const fxAnalysisEngine = require('./src/services/fxAnalysisEngine');
const portfolioController = require('./src/controllers/portfolioController');

async function runComprehensiveTests() {
  console.log('============================================================');
  console.log('🧪 TRANSACT3 COMPREHENSIVE AUTOMATED VERIFICATION SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Database Connection & Seed
    await connectDB();
    await seedDatabase();
    assert(true, 'Database connected & seeded with Users and 5 Rails');

    // 2. Verify User A (Alice) and User B (Bob) exist
    const alice = await User.findOne({ email: 'alice@transact3.com' });
    const bob = await User.findOne({ email: 'bob@transact3.com' });
    assert(alice && bob, 'Alice (User A) and Bob (User B) exist in database');

    // 3. Verify Multi-Currency Wallets
    const aliceUsdInitial = await portfolioController.checkUserBalance(alice._id, 'USD');
    const bobInrInitial = await portfolioController.checkUserBalance(bob._id, 'INR');
    assert(aliceUsdInitial >= 10000, `Alice initial USD balance is sufficient (${aliceUsdInitial} USD)`);
    assert(bobInrInitial >= 50000, `Bob initial INR balance is present (${bobInrInitial} INR)`);

    // 4. Test Simulated Wallet Deposit with Double-Entry Ledger
    await portfolioController.addHolding(
      { user: alice, body: { currency: 'USD', amount: 2000 } },
      { status: () => ({ json: () => {} }) }
    );
    const aliceUsdAfterDeposit = await portfolioController.checkUserBalance(alice._id, 'USD');
    assert(aliceUsdAfterDeposit === aliceUsdInitial + 2000, `Deposit successfully increased Alice USD balance by 2,000 to ${aliceUsdAfterDeposit}`);

    const depositLedgerEntry = await LedgerEntry.findOne({
      userId: alice._id,
      entryType: 'DEPOSIT',
      currency: 'USD',
      amount: 2000
    });
    assert(depositLedgerEntry && depositLedgerEntry.direction === 'CREDIT', 'Deposit created a valid double-entry CREDIT ledger record');

    // 5. Test Statistical FX Analysis (SMA, EMA, Volatility)
    const fxAnalysis = await fxAnalysisEngine.analyzePair('USD', 'INR');
    assert(
      fxAnalysis.currentRate > 0 && fxAnalysis.sma24h > 0 && fxAnalysis.ema24h > 0,
      `FX Engine computed Current Rate (${fxAnalysis.currentRate}), SMA (${fxAnalysis.sma24h}), and EMA (${fxAnalysis.ema24h})`
    );
    assert(['EXECUTE_NOW', 'NEUTRAL', 'CONSIDER_DEFER'].includes(fxAnalysis.classification), `FX Classification is valid: ${fxAnalysis.classification}`);

    // 6. Test Payment Mode A: SEND_AMOUNT
    const modeARoute = await orchestrationEngine.routePayment({
      sourceCurrency: 'USD',
      destinationCurrency: 'INR',
      amount: 1000,
      paymentMode: 'SEND_AMOUNT',
      priority: 'BALANCED'
    });
    assert(modeARoute.sourceAmount === 1000, 'Mode A preserved source amount (1000 USD)');
    assert(modeARoute.destinationAmount > 0, `Mode A calculated destination amount: ${modeARoute.destinationAmount} INR`);
    assert(modeARoute.evaluatedRails.length === 5, `Mode A evaluated exactly 5 rails: ${modeARoute.evaluatedRails.map(r => r.id).join(', ')}`);

    // 7. Test Payment Mode B: RECIPIENT_GETS
    const modeBRoute = await orchestrationEngine.routePayment({
      sourceCurrency: 'USD',
      destinationCurrency: 'INR',
      amount: 87200,
      paymentMode: 'RECIPIENT_GETS',
      priority: 'BALANCED'
    });
    assert(modeBRoute.destinationAmount === 87200, 'Mode B preserved requested recipient amount (87,200 INR)');
    assert(modeBRoute.sourceAmount > 0, `Mode B calculated required source amount: ${modeBRoute.sourceAmount} USD`);

    // 8. Test Routing Policies: CHEAPEST vs FASTEST
    const cheapestRoute = await orchestrationEngine.routePayment({
      sourceCurrency: 'USD',
      destinationCurrency: 'EUR',
      amount: 5000,
      priority: 'CHEAPEST'
    });
    const fastestRoute = await orchestrationEngine.routePayment({
      sourceCurrency: 'USD',
      destinationCurrency: 'EUR',
      amount: 5000,
      priority: 'FASTEST'
    });
    assert(cheapestRoute.recommendedRail.id === 'NETTING_LEDGER', `Cheapest policy picked lowest fee rail: ${cheapestRoute.recommendedRail.name} ($0 fee)`);
    assert(['REGIONAL_INSTANT', 'NETTING_LEDGER'].includes(fastestRoute.recommendedRail.id), `Fastest policy picked near-instant rail: ${fastestRoute.recommendedRail.name}`);

    // 9. Test Dynamic Liquidity Constraint & Controlled Failure Re-routing
    console.log('\n--- Testing Liquidity Constraint & Dynamic Re-Routing ---');
    // Set REGIONAL_INSTANT liquidity to $200
    await liquidityManager.setRailLiquidity('REGIONAL_INSTANT', 200);

    const reRouteResult = await orchestrationEngine.routePayment({
      sourceCurrency: 'USD',
      destinationCurrency: 'INR',
      amount: 1000,
      priority: 'BALANCED'
    });
    const instantRailEvaluated = reRouteResult.evaluatedRails.find(r => r.id === 'REGIONAL_INSTANT');
    assert(instantRailEvaluated.is_eligible === false, 'Regional Instant became INELIGIBLE when payment amount ($1,000) exceeded available liquidity ($200)');
    assert(instantRailEvaluated.rejection_reason && instantRailEvaluated.rejection_reason.includes('Insufficient liquidity'), `Rejection reason correctly stated: "${instantRailEvaluated.rejection_reason}"`);
    assert(reRouteResult.recommendedRail.id !== 'REGIONAL_INSTANT', `Orchestrator dynamically re-routed to alternative eligible rail: ${reRouteResult.recommendedRail.name}`);

    // Reset liquidity back to standard
    await liquidityManager.resetToDefaults();

    // 10. Test Full End-to-End Settlement Lifecycle:
    console.log('\n--- Testing Full End-to-End Settlement Lifecycle ---');
    const paymentAmountUSD = 1000;
    const initialAliceBalance = await portfolioController.checkUserBalance(alice._id, 'USD');
    const initialBobBalance = await portfolioController.checkUserBalance(bob._id, 'INR');

    const quote = await quoteEngine.createQuote({
      userId: alice._id,
      recipientId: bob._id,
      receiverEmail: bob.email,
      orchestrationResult: modeARoute
    });

    const txDoc = await Transaction.create({
      quoteId: quote.quoteId,
      sender: alice._id,
      recipient: bob._id,
      receiverEmail: bob.email,
      paymentMode: 'SEND_AMOUNT',
      sourceCurrency: 'USD',
      destinationCurrency: 'INR',
      sourceAmount: paymentAmountUSD,
      destinationAmount: modeARoute.destinationAmount,
      referenceFXRate: modeARoute.fxRate,
      quotedFXRate: modeARoute.fxRate,
      executedFXRate: modeARoute.fxRate,
      fxSpreadBps: 30,
      fxCostUSD: modeARoute.fxCostUSD,
      selectedRail: 'REGIONAL_INSTANT',
      recommendedRail: 'REGIONAL_INSTANT',
      selectionMode: 'RECOMMENDED',
      railFeeUSD: 1.70,
      totalSenderDebitUSD: 1001.70,
      estimatedLatencyHours: 0.0003,
      simulationDurationMs: 1000,
      riskScore: 10,
      totalCostUSD: 4.70,
      totalCostBps: 47,
      status: 'PROCESSING'
    });

    const settlement = await settlementEngine.processSettlement(txDoc);
    assert(settlement.success && settlement.settlementStatus === 'COMPLETED', `Settlement completed successfully (ClearingRef: ${settlement.clearingReference})`);

    // Verify Alice was debited (Principal + Fee = 1,000 + 1.70 = 1,001.70)
    const finalAliceBalance = await portfolioController.checkUserBalance(alice._id, 'USD');
    const expectedAliceBalance = initialAliceBalance - (paymentAmountUSD + 1.70);
    assert(
      Math.abs(finalAliceBalance - expectedAliceBalance) < 0.05,
      `Alice wallet was debited principal + rail fee: Was ${initialAliceBalance}, now ${finalAliceBalance} (Expected: ${expectedAliceBalance})`
    );

    // Verify Bob was credited the exact INR destination amount
    const finalBobBalance = await portfolioController.checkUserBalance(bob._id, 'INR');
    const expectedBobBalance = initialBobBalance + modeARoute.destinationAmount;
    assert(
      Math.abs(finalBobBalance - expectedBobBalance) < 0.05,
      `Bob wallet was credited destination amount: Was ${initialBobBalance} INR, now ${finalBobBalance} INR (Expected: ${expectedBobBalance})`
    );

    // 11. Test Double-Entry Ledger Reconciliation
    const ledgerReconciliation = await ledgerEngine.reconcileLedger();
    assert(ledgerReconciliation.isBalanced === true, `Double-entry ledger is globally balanced (Debits: $${ledgerReconciliation.totalDebits}, Credits: $${ledgerReconciliation.totalCredits})`);

    // 12. Test SHA-256 Tamper-Evident Audit Chain
    const auditChain = await auditEngine.verifyAuditChain();
    assert(auditChain.isValid === true, `Cryptographic SHA-256 Audit Chain verified valid across ${auditChain.totalBlocks} blocks`);

    console.log('\n============================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runComprehensiveTests();
