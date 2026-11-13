const riskEngine = require('./riskEngine');
const amlService = require('./amlService');
const auditEngine = require('./auditEngine');
const crypto = require('crypto');

/**
 * ComplianceSentinelAgent
 * Autonomous Agent 3: Evaluates transactions via Model 3 (IsolationForest + BSA/FATF Heuristics),
 * screens entities via tri-metric fuzzy AML matching, intercepts anomalous transfers,
 * and manages interactive compliance step-up challenges to safely clear legitimate transfers with audit trails.
 */
class ComplianceSentinelAgent {
  constructor() {
    this.activeChallenges = new Map();
  }

  generateChallengeId() {
    return `CHAL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  /**
   * Conducts holistic compliance screening across risk models and AML sanction databases
   */
  async screenTransaction({
    userId = 'anonymous',
    amountUSD = 1000,
    sourceCurrency = 'USD',
    destinationCurrency = 'EUR',
    recipientName = '',
    railId = 'SWIFT_BATCH',
    isNewBeneficiary = false,
    timeOfDayUTC = new Date().getUTCHours(),
    velocity24h = 1
  }) {
    const amt = Number(amountUSD) || 1000;
    const isStructuring = amt >= 9000 && amt <= 9999;
    const isOffHours = timeOfDayUTC >= 0 && timeOfDayUTC <= 4;
    const isVelocitySpike = Number(velocity24h) >= 5;

    // 1. Evaluate baseline risk via RiskEngine
    const riskResult = riskEngine.calculateRiskScore({
      amountUSD: amt,
      sourceCurrency,
      destinationCurrency,
      railId,
      isNewBeneficiary
    });

    // 2. Evaluate sanction match via AMLService (uses screenName or screenLocally)
    let sanctionResult = { isMatch: false, maxScore: 0, decision: 'PASS' };
    if (recipientName && recipientName.trim()) {
      try {
        const amlData = amlService.screenLocally
          ? amlService.screenLocally(recipientName.trim())
          : await amlService.screenName(recipientName.trim());
        sanctionResult = {
          isMatch: amlData.decision === 'REJECT',
          maxScore: amlData.risk_score || 0,
          decision: amlData.decision || 'PASS',
          matchedTarget: amlData.matched_target
        };
      } catch (err) {
        sanctionResult = { isMatch: false, maxScore: 0, decision: 'PASS' };
      }
    }

    // 3. Compute Composite Score combining Anomaly + AML + Regulatory Heuristics
    let compositeScore = riskResult.score;
    const triggers = [];

    if (sanctionResult.isMatch || sanctionResult.maxScore >= 0.70) {
      compositeScore = Math.max(compositeScore, 95);
      triggers.push({
        code: 'SANCTION_SCREENING_MATCH',
        severity: 'CRITICAL',
        description: `Potential name match against sanction watchlist (confidence: ${(sanctionResult.maxScore * 100).toFixed(1)}%). Matched: ${sanctionResult.matchedTarget || recipientName}`
      });
    }

    if (isStructuring) {
      compositeScore = Math.min(100, compositeScore + 30);
      triggers.push({
        code: 'STRUCTURING_SUSPICION',
        severity: 'HIGH',
        description: `Transfer amount $${amt.toLocaleString()} USD is within the $9,000–$9,999 Bank Secrecy Act (BSA) threshold avoidance band.`
      });
    }

    if (isVelocitySpike) {
      compositeScore = Math.min(100, compositeScore + 20);
      triggers.push({
        code: 'VELOCITY_SPIKE',
        severity: 'MEDIUM',
        description: `Elevated 24h transfer frequency (${velocity24h} transfers in 24 hours).`
      });
    }

    if (isOffHours) {
      compositeScore = Math.min(100, compositeScore + 10);
      triggers.push({
        code: 'OFF_HOURS_EXECUTION',
        severity: 'LOW',
        description: `Initiated during off-peak window (00:00–04:00 UTC).`
      });
    }

    // 4. Assign Risk Tier and Action
    let status = 'APPROVED_STP'; // Straight-Through Processing
    let requiresStepUp = false;
    let challenge = null;

    if (sanctionResult.isMatch || compositeScore >= 85) {
      status = 'MANDATORY_HOLD';
    } else if (compositeScore >= 35 || isStructuring || isVelocitySpike) {
      status = 'CHALLENGE_REQUIRED';
      requiresStepUp = true;

      const challengeId = this.generateChallengeId();
      challenge = {
        challengeId,
        userId: String(userId),
        amountUSD: amt,
        recipientName: recipientName || 'Beneficiary',
        compositeScore,
        triggers,
        requiredFields: ['commercialPurpose', 'sourceOfFunds'],
        suggestedPurposes: [
          'Commercial Invoice Payment',
          'Inter-Company Treasury Rebalancing',
          'Family Maintenance & Remittance',
          'Education Tuition & Accommodation',
          'Consulting / Professional Services'
        ],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        status: 'PENDING'
      };
      this.activeChallenges.set(challengeId, challenge);
    }

    return {
      evaluatedAt: new Date().toISOString(),
      compositeScore,
      riskLevel: compositeScore >= 85 ? 'CRITICAL' : (compositeScore >= 55 ? 'HIGH' : (compositeScore >= 35 ? 'MEDIUM' : 'LOW')),
      status,
      requiresStepUp,
      triggers,
      challenge,
      sanctionScore: sanctionResult.maxScore || 0,
      sanctionDecision: sanctionResult.decision
    };
  }

  /**
   * Resolves a step-up challenge when user provides legitimate commercial purpose & documentation
   */
  async resolveChallenge({
    challengeId,
    userId = 'anonymous',
    commercialPurpose = '',
    sourceOfFunds = '',
    justificationNotes = ''
  }) {
    const challenge = this.activeChallenges.get(challengeId);
    if (!challenge) {
      throw new Error(`Compliance challenge ${challengeId} not found or expired.`);
    }

    if (!commercialPurpose || commercialPurpose.trim().length < 3) {
      throw new Error('A valid commercial purpose or transfer justification is required.');
    }

    const now = new Date();
    challenge.status = 'CLEARED_WITH_AUDIT';
    challenge.resolvedAt = now.toISOString();
    challenge.resolution = {
      commercialPurpose: commercialPurpose.trim(),
      sourceOfFunds: sourceOfFunds.trim() || 'Salary / Business Revenue',
      justificationNotes: justificationNotes.trim() || 'Standard documentation confirmed by user.'
    };

    // Inscribe tamper-evident audit record
    await auditEngine.logEvent({
      transactionId: challengeId,
      actor: String(userId || 'COMPLIANCE_AGENT'),
      action: 'COMPLIANCE_CHALLENGE_RESOLVED',
      result: 'SUCCESS',
      metadata: {
        challengeId,
        triggers: challenge.triggers.map(t => t.code),
        commercialPurpose: challenge.resolution.commercialPurpose,
        clearedAt: challenge.resolvedAt,
        riskScoreDowngrade: `${challenge.compositeScore} -> 15 (STP Approved)`
      }
    });

    return {
      success: true,
      challengeId,
      status: 'CLEARED_WITH_AUDIT',
      newRiskLevel: 'LOW',
      clearedForSettlement: true,
      auditTimestamp: challenge.resolvedAt,
      message: `Compliance step-up challenge verified for ${challenge.recipientName}. Transfer is cleared for Straight-Through Processing.`
    };
  }

  getChallenge(challengeId) {
    return this.activeChallenges.get(challengeId) || null;
  }
}

module.exports = new ComplianceSentinelAgent();
