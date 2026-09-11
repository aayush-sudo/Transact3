/**
 * 5 Simulated Settlement Rails Configuration & Baseline Properties
 */
const RAIL_CONFIG = {
  REGIONAL_INSTANT: {
    id: 'REGIONAL_INSTANT',
    name: 'Regional Instant Network',
    description: 'Direct instant clearing (SEPA Instant, FedNow, UPI, Pix, PayNow, FPS)',
    baseFeeUSD: 1.50,
    variableFeeBps: 2, // 2 bps = 0.0002
    variableFeePct: 0.0002,
    expectedSettlementDisplay: 'Approximately 1 second',
    minLatencyHours: 0.0003, // ~1 sec
    maxLatencyHours: 0.0027, // ~10 sec
    avgLatencyHours: 0.0003,
    simulationDurationMs: 1000,
    maxAmountUSD: 100000,
    reliabilityScore: 0.985,
    capacityHourlyUSD: 2000000,
    icon: 'Activity'
  },
  NETTING_LEDGER: {
    id: 'NETTING_LEDGER',
    name: 'Bilateral Intra-Bank Netting',
    description: 'Direct book-transfer netting between partner financial institutions',
    baseFeeUSD: 0.00,
    variableFeeBps: 0, // 0 bps
    variableFeePct: 0.0000,
    expectedSettlementDisplay: 'Instant',
    minLatencyHours: 0.0001,
    maxLatencyHours: 0.0003,
    avgLatencyHours: 0.0001,
    simulationDurationMs: 800,
    maxAmountUSD: 5000000,
    reliabilityScore: 0.999,
    capacityHourlyUSD: 15000000,
    icon: 'Repeat'
  },
  RTGS_INSTANT: {
    id: 'RTGS_INSTANT',
    name: 'RTGS High-Value Clearing',
    description: 'Real-time gross settlement (Fedwire/TARGET2/CHAPS style)',
    baseFeeUSD: 18.00,
    variableFeeBps: 5, // 5 bps = 0.0005
    variableFeePct: 0.0005,
    expectedSettlementDisplay: 'Approximately 15 minutes',
    minLatencyHours: 0.08, // ~5 min
    maxLatencyHours: 0.5,  // ~30 min
    avgLatencyHours: 0.25, // ~15 min
    simulationDurationMs: 1500,
    maxAmountUSD: 10000000,
    reliabilityScore: 0.995,
    capacityHourlyUSD: 10000000,
    icon: 'Zap'
  },
  CARD_PUSH: {
    id: 'CARD_PUSH',
    name: 'Card Push Network',
    description: 'Visa Direct / Mastercard Send account-to-card push payments',
    baseFeeUSD: 3.50,
    variableFeeBps: 15, // 15 bps = 0.0015
    variableFeePct: 0.0015,
    expectedSettlementDisplay: 'Fast (~5-15 mins)',
    minLatencyHours: 0.08, // ~5 min
    maxLatencyHours: 0.25, // ~15 min
    avgLatencyHours: 0.15,
    simulationDurationMs: 1200,
    maxAmountUSD: 50000,
    reliabilityScore: 0.970,
    capacityHourlyUSD: 1000000,
    icon: 'CreditCard'
  },
  SWIFT_BATCH: {
    id: 'SWIFT_BATCH',
    name: 'SWIFT Classic Batch',
    description: 'Correspondent-banking international settlement batch processing',
    baseFeeUSD: 25.00,
    variableFeeBps: 10, // 10 bps = 0.0010
    variableFeePct: 0.0010,
    expectedSettlementDisplay: 'Approximately 36 hours',
    minLatencyHours: 24,
    maxLatencyHours: 48,
    avgLatencyHours: 36,
    simulationDurationMs: 2000,
    maxAmountUSD: 50000000,
    reliabilityScore: 0.990,
    capacityHourlyUSD: 50000000,
    icon: 'Globe'
  }
};

module.exports = RAIL_CONFIG;
