const fxRateEngine = require('./fxRateEngine');
const settlementEngine = require('./settlementEngine');
const auditEngine = require('./auditEngine');
const crypto = require('crypto');

/**
 * PredictiveFXExecutionAgent
 * Autonomous Agent 1: Monitors reference rates and executes conditional transfer mandates
 * when target rate thresholds or cutoffs are met.
 */
class PredictiveFXExecutionAgent {
  constructor() {
    // In-memory mandate store with lifecycle persistence
    this.mandates = new Map();
    this.pollIntervalMs = 60 * 1000; // 1 minute poller
    this.timer = null;
  }

  generateMandateId() {
    return `MND-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  /**
   * Create an autonomous execution mandate
   */
  async createMandate({
    userId,
    sourceCurrency = 'USD',
    destinationCurrency = 'INR',
    amount = 1000,
    recipientEmail = '',
    targetImprovementPct = 0.35, // e.g. execute if rate improves by >= +0.35%
    maxWaitHours = 24,
    priority = 'BALANCED'
  }) {
    const src = sourceCurrency.toUpperCase();
    const dst = destinationCurrency.toUpperCase();
    const amt = Number(amount);

    if (!amt || amt <= 0) {
      throw new Error('A valid transfer amount is required for an FX execution mandate.');
    }

    const currentRate = await fxRateEngine.getReferenceRate(src, dst);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + Math.max(1, maxWaitHours) * 3600 * 1000);
    const mandateId = this.generateMandateId();

    const mandate = {
      mandateId,
      userId: String(userId || 'anonymous'),
      sourceCurrency: src,
      destinationCurrency: dst,
      amount: amt,
      recipientEmail: recipientEmail || '',
      initialRate: currentRate,
      targetImprovementPct: Number(targetImprovementPct) || 0.35,
      targetRate: parseFloat((currentRate * (1 + (Number(targetImprovementPct) || 0.35) / 100)).toFixed(6)),
      maxWaitHours: Number(maxWaitHours) || 24,
      priority,
      status: 'ACTIVE', // ACTIVE | TRIGGERED | EXPIRED | CANCELLED
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastEvaluatedAt: now.toISOString(),
      checksCount: 1,
      latestRate: currentRate,
      predictedTrend: 'UNAVAILABLE',
      predictedHorizonRate: null,
      optimalHorizon: null,
      triggerReason: null,
      executionResult: null,
      history: [
        {
          timestamp: now.toISOString(),
          rate: currentRate,
          evaluation: `Mandate registered. Baseline rate: 1 ${src} = ${currentRate} ${dst}. Target: >= ${parseFloat((currentRate * (1 + targetImprovementPct / 100)).toFixed(6))}`
        }
      ]
    };

    this.mandates.set(mandateId, mandate);

    await auditEngine.logEvent({
      transactionId: mandateId,
      actor: String(userId || 'SYSTEM_AGENT'),
      action: 'AUTONOMOUS_FX_MANDATE_CREATED',
      result: 'SUCCESS',
      metadata: {
        mandateId,
        pair: `${src}/${dst}`,
        amount: amt,
        targetRate: mandate.targetRate,
        expiresAt: mandate.expiresAt
      }
    });

    return mandate;
  }

  /**
   * Evaluates a single mandate against the latest available reference rate
   */
  async evaluateMandate(mandateId) {
    const mandate = this.mandates.get(mandateId);
    if (!mandate) {
      throw new Error(`Mandate ${mandateId} not found.`);
    }

    if (mandate.status !== 'ACTIVE') {
      return { mandate, triggered: false, status: mandate.status };
    }

    const now = new Date();
    const expiresAt = new Date(mandate.expiresAt);
    const currentRate = await fxRateEngine.getReferenceRate(mandate.sourceCurrency, mandate.destinationCurrency);
    mandate.lastEvaluatedAt = now.toISOString();
    mandate.checksCount += 1;
    mandate.latestRate = currentRate;
    mandate.predictedTrend = 'UNAVAILABLE';

    const rateDeltaPct = ((currentRate - mandate.initialRate) / mandate.initialRate) * 100;
    const hoursRemaining = Math.max(0, (expiresAt.getTime() - now.getTime()) / 3600000);

    let triggered = false;
    let triggerReason = null;

    // Condition 1: Target improvement hit
    if (rateDeltaPct >= mandate.targetImprovementPct) {
      triggered = true;
      triggerReason = `TARGET_RATE_REACHED: Spot rate improved by +${rateDeltaPct.toFixed(3)}% (Hit: ${currentRate} >= ${mandate.targetRate})`;
    }
    // Condition 2: Imminent cutoff window (< 1 hour remaining before deadline)
    else if (hoursRemaining <= 1.0 && hoursRemaining > 0) {
      triggered = true;
      triggerReason = `EXPIRATION_CUTOFF_APPROACHING: Mandatory execution before deadline (${hoursRemaining.toFixed(1)}h remaining). Current rate: ${currentRate}`;
    }
    // Condition 3: Past expiration deadline
    else if (now >= expiresAt) {
      mandate.status = 'EXPIRED';
      triggerReason = 'MANDATE_EXPIRED_WITHOUT_TRIGGER';
      mandate.triggerReason = triggerReason;
      mandate.history.push({ timestamp: now.toISOString(), rate: currentRate, evaluation: triggerReason });
      return { mandate, triggered: false, status: 'EXPIRED' };
    }

    if (triggered) {
      mandate.status = 'TRIGGERED';
      mandate.triggerReason = triggerReason;
      mandate.executionResult = {
        executedRate: currentRate,
        gainVsInitial: parseFloat((mandate.amount * (currentRate - mandate.initialRate)).toFixed(2)),
        triggeredAt: now.toISOString()
      };
      mandate.history.push({
        timestamp: now.toISOString(),
        rate: currentRate,
        evaluation: triggerReason
      });

      await auditEngine.logEvent({
        transactionId: mandate.mandateId,
        actor: 'PREDICTIVE_FX_AGENT',
        action: 'AUTONOMOUS_FX_MANDATE_TRIGGERED',
        result: 'SUCCESS',
        metadata: {
          mandateId: mandate.mandateId,
          triggerReason,
          executedRate: currentRate,
          gain: mandate.executionResult.gainVsInitial
        }
      });
    } else {
      mandate.history.push({
        timestamp: now.toISOString(),
        rate: currentRate,
        evaluation: `Rate check: 1 ${mandate.sourceCurrency} = ${currentRate} ${mandate.destinationCurrency} (${rateDeltaPct >= 0 ? '+' : ''}${rateDeltaPct.toFixed(3)}%). Target: +${mandate.targetImprovementPct}%. Remaining: ${hoursRemaining.toFixed(1)}h.`
      });
    }

    return {
      mandate,
      triggered,
      status: mandate.status,
      currentRate,
      rateDeltaPct: parseFloat(rateDeltaPct.toFixed(3)),
      hoursRemaining: parseFloat(hoursRemaining.toFixed(1)),
      triggerReason
    };
  }

  /**
   * Evaluate all active mandates in the system
   */
  async evaluateAllActiveMandates() {
    const results = [];
    for (const [id, mandate] of this.mandates.entries()) {
      if (mandate.status === 'ACTIVE') {
        try {
          const evalResult = await this.evaluateMandate(id);
          results.push(evalResult);
        } catch (err) {
          console.error(`[PredictiveFXAgent] Error evaluating mandate ${id}:`, err.message);
        }
      }
    }
    return results;
  }

  getUserMandates(userId) {
    const userStr = String(userId || '');
    const list = [];
    for (const mandate of this.mandates.values()) {
      if (!userStr || mandate.userId === userStr || mandate.userId === 'anonymous') {
        list.push(mandate);
      }
    }
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  cancelMandate(mandateId, userId) {
    const mandate = this.mandates.get(mandateId);
    if (!mandate) throw new Error(`Mandate ${mandateId} not found.`);
    if (mandate.status !== 'ACTIVE') {
      throw new Error(`Mandate ${mandateId} cannot be cancelled because it is ${mandate.status}.`);
    }
    mandate.status = 'CANCELLED';
    mandate.triggerReason = `USER_CANCELLED: Cancelled by ${userId || 'user'}`;
    mandate.history.push({
      timestamp: new Date().toISOString(),
      rate: mandate.latestRate,
      evaluation: 'Mandate cancelled by user.'
    });
    return mandate;
  }
}

module.exports = new PredictiveFXExecutionAgent();
