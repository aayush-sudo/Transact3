/**
 * Transact3: 5 Supported Simulated Settlement Routes
 * Orchestration layer configuration with realistic simulation parameters.
 */

const RAIL_CONFIG = {
  SWIFT_CORRESPONDENT: {
    id: 'SWIFT_CORRESPONDENT',
    name: 'SWIFT / Correspondent Banking',
    description: 'A traditional cross-border bank payment route using payment messaging and correspondent banking relationships (Universal fallback).',
    baseFeeUSD: 25.00,
    variableFeeBps: 10, // 10 bps = 0.0010
    variableFeePct: 0.0010,
    expectedSettlementDisplay: 'Approximately 36 hours (Simulated estimate)',
    settlementDisplayShort: '~36 hours',
    minLatencyHours: 24,
    maxLatencyHours: 48,
    avgLatencyHours: 36,
    simulationDurationMs: 2000,
    maxAmountUSD: 10000000,
    reliabilityScore: 0.999,
    capacityHourlyUSD: 50000000,
    icon: 'Globe',
    isUniversalFallback: true
  },
  INSTANT_PAYMENT_LINK: {
    id: 'INSTANT_PAYMENT_LINK',
    name: 'Cross-Border Instant Payment',
    description: 'Interconnected domestic instant-payment systems facilitating fast retail cross-border transfers.',
    baseFeeUSD: 1.50,
    variableFeeBps: 2, // 2 bps = 0.0002
    variableFeePct: 0.0002,
    expectedSettlementDisplay: 'Approximately 1 second',
    settlementDisplayShort: '~1 second',
    minLatencyHours: 0.0003, // ~1 sec
    maxLatencyHours: 0.0027, // ~10 sec
    avgLatencyHours: 0.0003,
    simulationDurationMs: 1000,
    maxAmountUSD: 100000,
    reliabilityScore: 0.985,
    capacityHourlyUSD: 2000000,
    icon: 'Activity'
  },
  BILATERAL_NETTING: {
    id: 'BILATERAL_NETTING',
    name: 'Bilateral / Institutional Netting',
    description: 'Settlement optimization where connected payment institutions offset bilateral obligations and settle net positions.',
    baseFeeUSD: 0.00,
    variableFeeBps: 0, // 0 bps
    variableFeePct: 0.0000,
    expectedSettlementDisplay: 'Instant',
    settlementDisplayShort: 'Instant',
    minLatencyHours: 0.0001,
    maxLatencyHours: 0.0003,
    avgLatencyHours: 0.0001,
    simulationDurationMs: 800,
    maxAmountUSD: 5000000,
    reliabilityScore: 0.999,
    capacityHourlyUSD: 15000000,
    icon: 'Repeat'
  },
  CARD_PAYOUT: {
    id: 'CARD_PAYOUT',
    name: 'Card-Based Payout',
    description: 'Fast payout route where funds are delivered to an eligible recipient card through payment provider card rails.',
    baseFeeUSD: 3.50,
    variableFeeBps: 15, // 15 bps = 0.0015
    variableFeePct: 0.0015,
    expectedSettlementDisplay: 'Fast (~5-15 mins)',
    settlementDisplayShort: 'Fast',
    minLatencyHours: 0.08, // ~5 min
    maxLatencyHours: 0.25, // ~15 min
    avgLatencyHours: 0.15,
    simulationDurationMs: 1200,
    maxAmountUSD: 25000,
    reliabilityScore: 0.970,
    capacityHourlyUSD: 1000000,
    icon: 'CreditCard'
  }
};

// Aliases for seamless backwards compatibility with earlier database documents
RAIL_CONFIG.REGIONAL_INSTANT = RAIL_CONFIG.INSTANT_PAYMENT_LINK;
RAIL_CONFIG.SWIFT_BATCH = RAIL_CONFIG.SWIFT_CORRESPONDENT;
RAIL_CONFIG.NETTING_LEDGER = RAIL_CONFIG.BILATERAL_NETTING;
RAIL_CONFIG.CARD_PUSH = RAIL_CONFIG.CARD_PAYOUT;

const CANONICAL_RAIL_IDS = [
  'SWIFT_CORRESPONDENT',
  'INSTANT_PAYMENT_LINK',
  'BILATERAL_NETTING',
  'CARD_PAYOUT'
];

module.exports = RAIL_CONFIG;
module.exports.CANONICAL_RAIL_IDS = CANONICAL_RAIL_IDS;
