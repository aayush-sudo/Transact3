/**
 * Financial Precision & Safe Decimal Math Utility
 */

function roundToPrecision(value, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function calculateRailFee(amount, baseFeeUSD, variableFeeBps) {
  const safeAmount = Math.max(0, Number(amount) || 0);
  const fixed = Number(baseFeeUSD) || 0;
  // 1 bps = 0.0001 (0.01%)
  const variableRate = (Number(variableFeeBps) || 0) / 10000;
  const variable = safeAmount * variableRate;
  const total = fixed + variable;
  return {
    fixedFeeUSD: roundToPrecision(fixed, 2),
    variableFeeUSD: roundToPrecision(variable, 2),
    totalFeeUSD: roundToPrecision(total, 2)
  };
}

function safeAdd(a, b, decimals = 2) {
  return roundToPrecision((Number(a) || 0) + (Number(b) || 0), decimals);
}

function safeSubtract(a, b, decimals = 2) {
  return roundToPrecision((Number(a) || 0) - (Number(b) || 0), decimals);
}

function safeMultiply(a, b, decimals = 4) {
  return roundToPrecision((Number(a) || 0) * (Number(b) || 0), decimals);
}

function safeDivide(a, b, decimals = 4) {
  if (!b || Number(b) === 0) return 0;
  return roundToPrecision((Number(a) || 0) / Number(b), decimals);
}

module.exports = {
  roundToPrecision,
  calculateRailFee,
  safeAdd,
  safeSubtract,
  safeMultiply,
  safeDivide
};
