class TCAEngine {
  calculateTCA(params) {
    const {
      sourceAmountUSD = 1000,
      fxCostUSD = 35.0,
      railFeeUSD = 1.5,
      spreadBps = 35,
      referenceRate = 1.0,
      executedRate = 1.0,
      aiSavingsUSD = 0.0
    } = params;

    const totalCostUSD = parseFloat((fxCostUSD + railFeeUSD).toFixed(2));
    const totalCostBps = Math.round((totalCostUSD / sourceAmountUSD) * 10000);

    // Calculate slippage bps between quoted reference rate and actual executed rate
    const slippageFrac = referenceRate > 0 ? (referenceRate - executedRate) / referenceRate : 0;
    const fxSlippageBps = Math.max(0, Math.round(slippageFrac * 10000));

    const aiSavingsBps = Math.round((aiSavingsUSD / sourceAmountUSD) * 10000);

    return {
      sourceAmountUSD,
      fxCostUSD,
      railFeeUSD,
      totalCostUSD,
      totalCostBps,
      spreadBps,
      fxSlippageBps,
      aiSavingsUSD,
      aiSavingsBps,
      breakdownPct: {
        fxShare: parseFloat(((fxCostUSD / totalCostUSD) * 100).toFixed(1)),
        railShare: parseFloat(((railFeeUSD / totalCostUSD) * 100).toFixed(1))
      }
    };
  }
}

module.exports = new TCAEngine();
