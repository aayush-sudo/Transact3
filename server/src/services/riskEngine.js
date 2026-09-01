const SUPPORTED_CURRENCIES = require('../config/currencies');

class RiskEngine {
  calculateRiskScore(params) {
    const { amountUSD = 1000, sourceCurrency = 'USD', destinationCurrency = 'EUR', railId = 'SWIFT_BATCH', isNewBeneficiary = false } = params;

    let score = 10; // Base baseline risk

    // 1. Amount Risk
    if (amountUSD > 1000000) score += 35;
    else if (amountUSD > 250000) score += 25;
    else if (amountUSD > 50000) score += 15;
    else if (amountUSD > 10000) score += 8;

    // 2. Currency Corridor Risk
    const srcInfo = SUPPORTED_CURRENCIES[sourceCurrency.toUpperCase()];
    const dstInfo = SUPPORTED_CURRENCIES[destinationCurrency.toUpperCase()];
    if (srcInfo && srcInfo.baseVolatility > 0.005) score += 10;
    if (dstInfo && dstInfo.baseVolatility > 0.005) score += 12;

    // 3. Beneficiary Status Risk
    if (isNewBeneficiary) score += 12;

    // 4. Rail Specific Risk Factor
    if (railId === 'STABLECOIN_VAULT') score += 5; // Slight digital asset compliance verification score
    if (railId === 'CARD_PUSH') score += 8;

    score = Math.min(100, Math.max(0, Math.round(score)));

    let riskLevel = 'LOW';
    let requiresManualReview = false;

    if (score >= 81) {
      riskLevel = 'CRITICAL';
      requiresManualReview = true;
    } else if (score >= 61) {
      riskLevel = 'HIGH';
      requiresManualReview = true;
    } else if (score >= 31) {
      riskLevel = 'MEDIUM';
    }

    return {
      score,
      riskLevel,
      requiresManualReview,
      breakdown: {
        baseScore: 10,
        amountFactor: amountUSD > 50000 ? (amountUSD > 250000 ? 25 : 15) : 8,
        corridorFactor: (srcInfo?.baseVolatility > 0.005 ? 10 : 0) + (dstInfo?.baseVolatility > 0.005 ? 12 : 0),
        newBeneficiaryFactor: isNewBeneficiary ? 12 : 0
      }
    };
  }
}

module.exports = new RiskEngine();
