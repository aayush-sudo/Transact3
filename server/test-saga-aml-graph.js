/**
 * Automated Verification Suite for:
 * 1. RegTech Fuzzy Matching AML & Sanction Screening (Jaro-Winkler + Levenshtein + Soundex)
 * 2. Dijkstra Multi-Hop FX Graph Router (Negative-Log Yield Weights)
 * 3. Standardized ISO 20022 pacs.008.001.10 XML Generation
 * 4. SAGA Event-Sourced Orchestrator & Compensating Rollback
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const amlService = require('./src/services/amlService');
const graphRouterService = require('./src/services/graphRouterService');
const iso20022 = require('./src/utils/iso20022');
const sagaOrchestrator = require('./src/services/sagaOrchestrator');
const instantRail = require('./src/rails/instantRail');

const User = require('./src/models/User');
const Portfolio = require('./src/models/Portfolio');
const Transaction = require('./src/models/Transaction');
const LedgerEntry = require('./src/models/LedgerEntry');
const AuditLog = require('./src/models/AuditLog');
const RailSetting = require('./src/models/RailSetting');
const liquidityManager = require('./src/services/liquidityManager');
const portfolioController = require('./src/controllers/portfolioController');

async function runTestSuite() {
  console.log('============================================================');
  console.log('🧪 SAGA, AML REGTECH & GRAPH ROUTING VERIFICATION SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. In-Memory MongoDB Setup
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  await liquidityManager.initialize();

  // Create Users
  const alice = await User.create({
    name: 'Alice Johnson',
    email: 'alice@test.com',
    password: 'Password123!',
    walletBalance: 5000
  });

  const bob = await User.create({
    name: 'Bob Smith',
    email: 'bob@test.com',
    password: 'Password123!',
    walletBalance: 1000
  });

  await Portfolio.create({
    user: alice._id,
    holdings: [{ currency: 'USD', amount: 5000, averageBuyPrice: 1.0 }]
  });

  await Portfolio.create({
    user: bob._id,
    holdings: [{ currency: 'EUR', amount: 1000, averageBuyPrice: 1.08 }]
  });

  console.log('--- 1. RegTech Fuzzy-Matching AML Sanction Screening ---');
  // Exact match test
  const aml1 = await amlService.screenName('Vladimir Petrov');
  assert(aml1.decision === 'REJECT' && aml1.risk_score >= 0.85, 'Exact match "Vladimir Petrov" triggers REJECT (Score: ' + aml1.risk_score + ')');

  // Phonetic & edit distance match test
  const aml2 = await amlService.screenName('Wladimir Petrow');
  assert(aml2.matched_target === 'VLADIMIR PETROV' && aml2.risk_score >= 0.70, 'Phonetic/edit permutation "Wladimir Petrow" matches VLADIMIR PETROV with high risk (' + aml2.risk_score + ')');

  // Soundex metric check
  assert(aml2.metrics.soundex_match === 1.0, 'Soundex phonetic encoding caught identical phonetic code for "Wladimir" & "Vladimir"');

  // Clean entity test
  const aml3 = await amlService.screenName('John Doe');
  assert(aml3.decision === 'PASS' && aml3.risk_score < 0.65, 'Clean entity "John Doe" successfully passes AML screening (Risk: ' + aml3.risk_score + ')');

  console.log('\n--- 2. Dijkstra Multi-Hop FX Graph Routing ---');
  const routeUSD_INR = await graphRouterService.findOptimalRoute('USD', 'INR');
  assert(routeUSD_INR && routeUSD_INR.path.includes('USD') && routeUSD_INR.path.includes('INR'), 'Dijkstra found optimal path for USD -> INR: [' + routeUSD_INR.path.join(' -> ') + ']');
  assert(routeUSD_INR.effective_rate > 0, 'Effective yield rate computed: ' + routeUSD_INR.effective_rate);
  assert(routeUSD_INR.net_fee_bps >= 0, 'Net conversion fee calculated in bps: ' + routeUSD_INR.net_fee_bps + ' bps');

  const routeJPY_EUR = await graphRouterService.findOptimalRoute('JPY', 'EUR');
  assert(routeJPY_EUR && routeJPY_EUR.path.length >= 2, 'Multi-hop graph path resolved for JPY -> EUR: [' + routeJPY_EUR.path.join(' -> ') + ']');

  console.log('\n--- 3. ISO 20022 pacs.008.001.10 XML Generation ---');
  const sampleTx = {
    _id: '67c72b2f9b1d8b0015f8e001',
    quoteId: 'QTE-SAGA-999',
    clearingReference: 'CLR-SAGA-100293',
    sourceCurrency: 'USD',
    destinationCurrency: 'EUR',
    sourceAmount: 1000,
    destinationAmount: 920,
    quotedFXRate: 0.92,
    selectedRail: 'REGIONAL_INSTANT',
    receiverEmail: 'bob@test.com'
  };
  const xml = iso20022.generatePacs008Xml(sampleTx);
  assert(xml.includes('urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10'), 'XML namespace pacs.008.001.10 correctly declared');
  assert(xml.includes('<FIToFICstmrCdtTrf>') && xml.includes('</FIToFICstmrCdtTrf>'), 'XML contains valid root <FIToFICstmrCdtTrf> element');
  assert(xml.includes('<GrpHdr>') && xml.includes('<CdtTrfTxInf>'), 'XML contains Group Header and Credit Transfer Transaction Information blocks');
  assert(xml.includes('<IntrBkSttlmAmt Ccy="USD">1000.00</IntrBkSttlmAmt>'), 'XML settlement amount correctly matches source amount');
  assert(xml.includes('<InstdAmt Ccy="EUR">920.00</InstdAmt>'), 'XML instructed amount correctly matches destination amount');

  console.log('\n--- 4. Event-Sourced SAGA Orchestration (Happy Path) ---');
  const txDocHappy = await Transaction.create({
    quoteId: 'QTE-HAPPY-001',
    sender: alice._id,
    recipient: bob._id,
    receiverEmail: 'bob@test.com',
    sourceCurrency: 'USD',
    destinationCurrency: 'EUR',
    sourceAmount: 500,
    destinationAmount: 460,
    referenceFXRate: 0.92,
    quotedFXRate: 0.92,
    fxSpreadBps: 30,
    fxCostUSD: 1.5,
    selectedRail: 'REGIONAL_INSTANT',
    recommendedRail: 'REGIONAL_INSTANT',
    railFeeUSD: 1.6,
    totalSenderDebitUSD: 501.6,
    estimatedLatencyHours: 0.0003,
    riskScore: 15,
    totalCostUSD: 3.1,
    totalCostBps: 31,
    clearingReference: 'CLR-SAGA-HAPPY-1',
    status: 'CREATED',
    sagaStatus: 'INITIATED'
  });

  const happyResult = await sagaOrchestrator.executeSaga(txDocHappy, instantRail);
  assert(happyResult.success === true, 'SAGA completed successfully across all 5 states');
  assert(happyResult.sagaStatus === 'SETTLED', 'Final SAGA status is SETTLED');

  const aliceBalAfterHappy = await portfolioController.checkUserBalance(alice._id, 'USD');
  const bobBalAfterHappy = await portfolioController.checkUserBalance(bob._id, 'EUR');
  assert(aliceBalAfterHappy === 4498.4, 'Alice wallet debited principal + rail fee: 5000 -> ' + aliceBalAfterHappy);
  assert(bobBalAfterHappy === 1460, 'Bob wallet credited destination amount: 1000 -> ' + bobBalAfterHappy);

  console.log('\n--- 5. SAGA Compensating Action (Rollback on Downstream Failure) ---');
  const txDocFailure = await Transaction.create({
    quoteId: 'QTE-FAIL-002',
    sender: alice._id,
    recipient: bob._id,
    receiverEmail: 'bob@test.com',
    sourceCurrency: 'USD',
    destinationCurrency: 'EUR',
    sourceAmount: 400,
    destinationAmount: 368,
    referenceFXRate: 0.92,
    quotedFXRate: 0.92,
    fxSpreadBps: 30,
    fxCostUSD: 1.2,
    selectedRail: 'REGIONAL_INSTANT',
    recommendedRail: 'REGIONAL_INSTANT',
    railFeeUSD: 1.58,
    totalSenderDebitUSD: 401.58,
    estimatedLatencyHours: 0.0003,
    riskScore: 15,
    totalCostUSD: 2.78,
    totalCostBps: 27.8,
    clearingReference: 'CLR-SAGA-FAIL-2',
    status: 'CREATED',
    sagaStatus: 'INITIATED'
  });

  let rollbackCaught = false;
  try {
    // Inject artificial downstream rail failure at Step 4
    await sagaOrchestrator.executeSaga(txDocFailure, instantRail, { simulateDownstreamFailure: true });
  } catch (err) {
    rollbackCaught = true;
  }

  assert(rollbackCaught === true, 'Downstream failure intercepted by SAGA orchestrator');
  
  const reloadedFailureTx = await Transaction.findById(txDocFailure._id);
  assert(reloadedFailureTx.sagaStatus === 'FAILED_ROLLBACK', 'Transaction state transitioned to FAILED_ROLLBACK');
  assert(reloadedFailureTx.status === 'FAILED', 'Transaction overall status is FAILED');

  const aliceBalAfterRollback = await portfolioController.checkUserBalance(alice._id, 'USD');
  assert(aliceBalAfterRollback === 4498.4, 'Compensating rollback restored Alice funds cleanly ($0.00 leakage): ' + aliceBalAfterRollback + ' USD');

  // Verify double-entry ledger invariant
  const allLedgers = await LedgerEntry.find({});
  let totalDebits = 0;
  let totalCredits = 0;
  for (const entry of allLedgers) {
    if (entry.direction === 'DEBIT') totalDebits += entry.amount;
    if (entry.direction === 'CREDIT') totalCredits += entry.amount;
  }
  assert(Math.abs(totalDebits - totalCredits) < 0.01, 'Double-entry ledger is globally balanced across SAGA settlements and rollbacks (Debits: ' + totalDebits + ', Credits: ' + totalCredits + ')');

  console.log('\n============================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================');

  await mongoose.disconnect();
  await mongoServer.stop();
  process.exit(failed > 0 ? 1 : 0);
}

runTestSuite().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
