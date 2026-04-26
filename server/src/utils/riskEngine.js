const Transaction = require('../models/Transaction');

const THRESHOLDS = {
  HIGH_AMOUNT: 10000,
  FREQUENT_TX_WINDOW_MS: 60 * 60 * 1000,
  FREQUENT_TX_COUNT: 5,
};

const WEIGHTS = {
  BASE: 0.1,
  HIGH_AMOUNT: 0.5,
  FREQUENT_TX: 0.3,
};

const calculateRiskScore = async (senderId, amount) => {
  let score = WEIGHTS.BASE;

  if (amount > THRESHOLDS.HIGH_AMOUNT) {
    score += WEIGHTS.HIGH_AMOUNT;
  }

  const windowStart = new Date(Date.now() - THRESHOLDS.FREQUENT_TX_WINDOW_MS);
  const recentCount = await Transaction.countDocuments({
    sender: senderId,
    timestamp: { $gte: windowStart },
  });

  if (recentCount >= THRESHOLDS.FREQUENT_TX_COUNT) {
    score += WEIGHTS.FREQUENT_TX;
  }

  return Math.min(score, 1);
};

const determineStatus = (riskScore) => {
  if (riskScore >= 0.7) return 'blocked';
  if (riskScore >= 0.4) return 'under_review';
  return 'approved';
};

module.exports = { calculateRiskScore, determineStatus };
