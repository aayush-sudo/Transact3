/**
 * Comprehensive Multi-Agent System (MAS) Test Suite
 * Tests Agent 1 (Predictive FX Execution), Agent 2 (Liquidity Rebalancing),
 * Agent 3 (Compliance Sentinel), and natural language agent routing.
 *
 * Run with: node test-multi-agent-system.js
 */

process.env.NODE_ENV = 'test';
process.env.AI_AGENT_DEBUG = 'false';

const predictiveFXAgent = require('./src/services/predictiveFXExecutionAgent');
const liquidityAgent = require('./src/services/liquidityRebalancingAgent');
const complianceAgent = require('./src/services/complianceSentinelAgent');
const { resolveAgentTurn } = require('./src/services/aiConversationContext');

let passed = 0;
let failed = 0;

const assert = (condition, name, detail) => {
  if (condition) {
    console.log(`✅ PASS: ${name}`);
    passed += 1;
  } else {
    console.error(`❌ FAIL: ${name}${detail ? ` -> ${detail}` : ''}`);
    failed += 1;
  }
};

async function runTests() {
  console.log('============================================================');
  console.log('🤖 TRANSACT3 MULTI-AGENT SOCIETY (MAS) VERIFICATION SUITE');
  console.log('============================================================\n');

  // =========================================================================
  // AGENT 1: PREDICTIVE FX EXECUTION AGENT TESTS
  // =========================================================================
  console.log('--- [AGENT 1: Predictive FX Execution Agent] ---');

  // Test 1: Create conditional mandate
  const mandate = await predictiveFXAgent.createMandate({
    userId: 'user_test_123',
    sourceCurrency: 'USD',
    destinationCurrency: 'INR',
    amount: 5000,
    targetImprovementPct: 0.50,
    maxWaitHours: 24
  });

  assert(mandate && mandate.mandateId.startsWith('MND-'), 'A1.1 Mandate created with unique ID', mandate?.mandateId);
  assert(mandate.status === 'ACTIVE', 'A1.2 Mandate status is ACTIVE');
  assert(mandate.targetRate > mandate.initialRate, 'A1.3 Target rate computed with +0.50% threshold');
  assert(mandate.predictedTrend != null, 'A1.4 Model 1 trend predictions integrated');

  // Test 2: Evaluate mandate without trigger
  const eval1 = await predictiveFXAgent.evaluateMandate(mandate.mandateId);
  assert(eval1.status === 'ACTIVE' && !eval1.triggered, 'A1.5 Evaluates cleanly without false trigger when rate has not hit target');

  // Test 3: Simulate rate jump triggering target condition
  mandate.initialRate = mandate.latestRate * 0.98; // Artificial simulation of +2% rise
  const eval2 = await predictiveFXAgent.evaluateMandate(mandate.mandateId);
  assert(eval2.triggered && eval2.status === 'TRIGGERED', 'A1.6 Triggers autonomous execution when target improvement threshold hit');
  assert(eval2.mandate.executionResult != null, 'A1.7 Inscribes execution result and monetary gain');

  // Test 4: Cutoff window trigger test
  const mandate2 = await predictiveFXAgent.createMandate({
    userId: 'user_test_123',
    sourceCurrency: 'EUR',
    destinationCurrency: 'USD',
    amount: 2000,
    targetImprovementPct: 2.0,
    maxWaitHours: 24
  });
  // Simulate 30 mins remaining
  mandate2.expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const evalCutoff = await predictiveFXAgent.evaluateMandate(mandate2.mandateId);
  assert(evalCutoff.triggered && evalCutoff.triggerReason.includes('EXPIRATION_CUTOFF_APPROACHING'), 'A1.8 Autonomously triggers execution when cutoff window approaches to prevent banking delays');

  // Test 5: List & Cancel
  const userMandates = predictiveFXAgent.getUserMandates('user_test_123');
  assert(userMandates.length >= 2, 'A1.9 Lists all active and completed user mandates');

  const mandate3 = await predictiveFXAgent.createMandate({
    userId: 'user_test_123',
    sourceCurrency: 'GBP',
    destinationCurrency: 'EUR',
    amount: 1500
  });
  const cancelled = predictiveFXAgent.cancelMandate(mandate3.mandateId, 'user_test_123');
  assert(cancelled.status === 'CANCELLED', 'A1.10 User can cancel active mandate before execution');

  // =========================================================================
  // AGENT 2: AUTONOMOUS RAIL & LIQUIDITY REBALANCING AGENT TESTS
  // =========================================================================
  console.log('\n--- [AGENT 2: Autonomous Rail & Liquidity Rebalancing Agent] ---');

  // Test 6: Rail Health Assessment
  const health = await liquidityAgent.assessRailHealth(15000);
  assert(health && health.rails && health.rails.length >= 3, 'A2.1 Evaluates health across all canonical payment rails');
  assert(health.rails.every(r => typeof r.saturationRatio === 'number'), 'A2.2 Computes saturation ratio S_R for every rail');

  // Test 7: Retail threshold exceedance detection
  const instantRail = health.rails.find(r => r.railId === 'REGIONAL_INSTANT');
  assert(instantRail && instantRail.status === 'AMOUNT_EXCEEDED', 'A2.3 Flags retail limit exceedance when $15,000 sent over Regional Instant ($1k cap)');

  // Test 8: Never recommend an unverified FX route
  const reroutePlan = await liquidityAgent.planRerouteOrRebalance({
    sourceCurrency: 'USD',
    destinationCurrency: 'INR',
    amountUSD: 50000,
    congestedRailId: 'REGIONAL_INSTANT'
  });
  assert(reroutePlan && reroutePlan.planId.startsWith('REBAL-'), 'A2.4 Generates a liquidity diagnosis');
  assert(reroutePlan.status === 'NO_EXECUTABLE_ROUTE' && reroutePlan.graphPath.length === 0,
    'A2.5 Withholds routes not confirmed by an execution provider');
  assert(reroutePlan.actionPlan.includes('No payment provider confirms'),
    'A2.6 Explains why no route was recommended');

  // Test 9: Pool Replenishment Simulation
  const replenish = await liquidityAgent.executePoolReplenishment('CARD_PAYOUT', 25000);
  assert(replenish.success && replenish.injectedUSD === 25000, 'A2.7 Replenishes virtual liquidity pool with audited record');

  // =========================================================================
  // AGENT 3: COMPLIANCE & REGTECH SENTINEL AGENT TESTS
  // =========================================================================
  console.log('\n--- [AGENT 3: Compliance & RegTech Sentinel Agent] ---');

  // Test 10: Standard Low-Risk Transfer (STP Approved)
  const lowRisk = await complianceAgent.screenTransaction({
    userId: 'user_alice',
    amountUSD: 500,
    sourceCurrency: 'USD',
    destinationCurrency: 'EUR',
    recipientName: 'Alice Schmidt',
    timeOfDayUTC: 14,
    velocity24h: 1
  });
  assert(lowRisk.status === 'APPROVED_STP' && !lowRisk.requiresStepUp, 'A3.1 Standard low-risk transfer clears Straight-Through Processing (STP)');

  // Test 11: BSA Structuring Anomaly Detection ($9,850 transfer)
  const structuring = await complianceAgent.screenTransaction({
    userId: 'user_bob',
    amountUSD: 9850,
    sourceCurrency: 'USD',
    destinationCurrency: 'EUR',
    recipientName: 'Acme Import Corp',
    timeOfDayUTC: 15,
    velocity24h: 2
  });
  assert(structuring.requiresStepUp && structuring.status === 'CHALLENGE_REQUIRED', 'A3.2 Detects BSA $9,000-$9,999 structuring band and triggers interactive challenge');
  assert(structuring.triggers.some(t => t.code === 'STRUCTURING_SUSPICION'), 'A3.3 Generates STRUCTURING_SUSPICION trigger code');
  assert(structuring.challenge && structuring.challenge.challengeId.startsWith('CHAL-'), 'A3.4 Issues interactive Compliance Challenge with unique ID');

  // Test 12: Resolve Compliance Challenge
  const resolved = await complianceAgent.resolveChallenge({
    challengeId: structuring.challenge.challengeId,
    userId: 'user_bob',
    commercialPurpose: 'Payment for Industrial Machinery Parts Invoice #8492',
    sourceOfFunds: 'Corporate Operational Reserve'
  });
  assert(resolved.success && resolved.clearedForSettlement, 'A3.5 Verified commercial purpose clears challenge for settlement');
  assert(resolved.newRiskLevel === 'LOW', 'A3.6 Risk level safely downgraded upon audited documentation');

  // Test 13: Sanctions Screening Interception (Fuzzy Transliteration)
  const sanctionTest = await complianceAgent.screenTransaction({
    userId: 'user_charlie',
    amountUSD: 2500,
    sourceCurrency: 'USD',
    destinationCurrency: 'EUR',
    recipientName: 'Wladimir Petrow' // Phonetic Soundex/Levenshtein variant of Vladimir Petrov
  });
  assert(sanctionTest.status === 'MANDATORY_HOLD' || sanctionTest.compositeScore >= 85, 'A3.7 Intercepts fuzzy sanction alias and applies mandatory compliance hold');

  // =========================================================================
  // NATURAL LANGUAGE AGENT ORCHESTRATION TESTS
  // =========================================================================
  console.log('\n--- [NATURAL LANGUAGE AGENT ORCHESTRATION] ---');

  // Test 14: Mandate Prompt Routing
  const turn1 = await resolveAgentTurn({ prompt: 'Set an autonomous transfer of 5000 USD to INR when rate improves by 0.5% within 24 hours' });
  assert(turn1.actionType === 'FX_MANDATE', 'NL.1 Natural language mandate routes to FX_MANDATE', turn1.actionType);

  // Test 15: Mandate List Prompt Routing
  const turn2 = await resolveAgentTurn({ prompt: 'Check my active FX mandates' });
  assert(turn2.actionType === 'FX_MANDATE', 'NL.2 Mandate check routes to FX_MANDATE', turn2.actionType);

  // Test 16: Liquidity Health Prompt Routing
  const turn3 = await resolveAgentTurn({ prompt: 'Check rail liquidity health and capacity saturation' });
  assert(turn3.actionType === 'LIQUIDITY_HEALTH', 'NL.3 Liquidity health check routes to LIQUIDITY_HEALTH', turn3.actionType);

  // Test 17: Compliance Prompt Routing
  const turn4 = await resolveAgentTurn({ prompt: 'Run a compliance check on 9850 USD transfer' });
  assert(turn4.actionType === 'COMPLIANCE_AGENT', 'NL.4 Compliance inquiry routes to COMPLIANCE_AGENT', turn4.actionType);

  console.log('\n============================================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal error running multi-agent tests:', err);
  process.exit(1);
});
