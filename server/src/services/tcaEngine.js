class TCAEngine {
  calculateTCA(params) {
    const {
      sourceAmountUSD = 1000,
      fxCostUSD = 35.0,
      railFeeUSD = 1.5,
      routeFeeUSD = null,
      spreadBps = 35,
      referenceRate = 1.0,
      executedRate = 1.0,
      aiSavingsUSD = null,
      estLatencyHours = 0.05,
      swiftBaselineFeeUSD = null
    } = params;

    const actualRouteFeeUSD = parseFloat((routeFeeUSD !== null ? routeFeeUSD : railFeeUSD).toFixed(2));
    const actualFxCostUSD = parseFloat(fxCostUSD.toFixed(2));
    const totalCostUSD = parseFloat((actualFxCostUSD + actualRouteFeeUSD).toFixed(2));
    const totalCostBps = sourceAmountUSD > 0 ? Math.round((totalCostUSD / sourceAmountUSD) * 10000) : 0;

    // Swift baseline benchmark ($25 fixed + 10 bps variable)
    const swiftBaseFee = swiftBaselineFeeUSD !== null 
      ? swiftBaselineFeeUSD 
      : parseFloat((25.0 + (sourceAmountUSD * 0.0010)).toFixed(2));
    const swiftBaselineCostUSD = parseFloat((swiftBaseFee + actualFxCostUSD).toFixed(2));

    const costSavedUSD = aiSavingsUSD !== null
      ? parseFloat(Number(aiSavingsUSD).toFixed(2))
      : parseFloat(Math.max(0, swiftBaseFee - actualRouteFeeUSD).toFixed(2));

    const swiftSettlementHours = 36.0;
    const timeSavedHours = parseFloat(Math.max(0, swiftSettlementHours - estLatencyHours).toFixed(2));

    // Calculate slippage bps between quoted reference rate and actual executed rate
    const slippageFrac = referenceRate > 0 ? (referenceRate - executedRate) / referenceRate : 0;
    const fxSlippageBps = Math.max(0, Math.round(slippageFrac * 10000));
    const aiSavingsBps = sourceAmountUSD > 0 ? Math.round((costSavedUSD / sourceAmountUSD) * 10000) : 0;

    const safeTotal = totalCostUSD > 0 ? totalCostUSD : 1;
    const fxShare = parseFloat(((actualFxCostUSD / safeTotal) * 100).toFixed(1));
    const railShare = parseFloat(((actualRouteFeeUSD / safeTotal) * 100).toFixed(1));

    return {
      sourceAmountUSD,
      fxCostUSD: actualFxCostUSD,
      railFeeUSD: actualRouteFeeUSD,
      routeFeeUSD: actualRouteFeeUSD,
      totalCostUSD,
      totalEstimatedCostUSD: totalCostUSD,
      totalCostBps,
      spreadBps,
      fxSlippageBps,
      swiftBaselineCostUSD,
      swiftBaselineFeeUSD: swiftBaseFee,
      costSavedUSD,
      aiSavingsUSD: costSavedUSD,
      aiSavingsBps,
      swiftSettlementHours,
      timeSavedHours,
      breakdownPct: {
        fxShare,
        railShare
      }
    };
  }
}

module.exports = new TCAEngine();
