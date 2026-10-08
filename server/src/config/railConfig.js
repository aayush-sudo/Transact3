/**
 * Transact3: Payment rail configuration for the simulated settlement routes
 * Orchestration layer configuration with realistic simulation parameters.
 */

const RAIL_CONFIG = {
  SWIFT_CORRESPONDENT: {
    id: 'SWIFT_CORRESPONDENT',
    name: 'SWIFT / Correspondent Banking',
    description: 'A traditional cross-border bank payment route using payment messaging and correspondent banking relationships (Universal fallback).',
    baseFeeUSD: 25.00,
    variableFeeBps: 10, // 10 bps = 0.0010 (0.10%)
    variableFeePct: 0.0010,
    expectedSettlementDisplay: 'Approximately 36 hours',
    settlementDisplayShort: '~36 hours',
    minLatencyHours: 24,
    maxLatencyHours: 48,
    avgLatencyHours: 36,
    simulationDurationMs: 2000,
    maxAmountUSD: 10000000,
    reliabilityScore: 0.999,
    capacityHourlyUSD: 50000000,
    icon: 'Globe',
    isUniversalFallback: true,
    pricingModel: 'BASE_PLUS_CORRESPONDENT_HOPS'
  },
  INSTANT_PAYMENT_LINK: {
    id: 'INSTANT_PAYMENT_LINK',
    name: 'Domestic instant payment (small amounts)',
    description: 'Designed for everyday, lower-value domestic payments. Instant timing is illustrative; settlement currently stays within the platform and is not connected to a domestic payment network.',
    baseFeeUSD: 1.50,
    variableFeeBps: 2, // 2 bps = 0.0002 (0.02%)
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
    icon: 'Activity',
    pricingModel: 'LOW_LATENCY_FLAT_PLUS_BPS'
  },
  CARD_PAYOUT: {
    id: 'CARD_PAYOUT',
    name: 'Card-Based Payout',
    description: 'Fast payout route where funds are delivered to an eligible recipient card through payment provider card rails.',
    baseFeeUSD: 3.50,
    variableFeeBps: 15, // 15 bps = 0.0015 (0.15%)
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
    icon: 'CreditCard',
    pricingModel: 'CARD_INTERCHANGE_OCT'
  },
  RTGS_SETTLEMENT: {
    id: 'RTGS_SETTLEMENT',
    name: 'RTGS Central Bank Wire',
    description: 'Real-Time Gross Settlement high-value central bank wire clearing network (Fedwire, TARGET2, CHAPS).',
    baseFeeUSD: 18.00,
    variableFeeBps: 5, // 5 bps = 0.0005 (0.05%)
    variableFeePct: 0.0005,
    expectedSettlementDisplay: 'Approximately 15 minutes',
    settlementDisplayShort: '~15 mins',
    minLatencyHours: 0.10,
    maxLatencyHours: 0.50,
    avgLatencyHours: 0.25,
    simulationDurationMs: 1500,
    maxAmountUSD: 50000000,
    reliabilityScore: 0.999,
    capacityHourlyUSD: 25000000,
    icon: 'Landmark',
    pricingModel: 'CENTRAL_BANK_GROSS_WIRE'
  }
};

// Aliases for seamless backwards compatibility with earlier database documents
RAIL_CONFIG.REGIONAL_INSTANT = RAIL_CONFIG.INSTANT_PAYMENT_LINK;
RAIL_CONFIG.SWIFT_BATCH = RAIL_CONFIG.SWIFT_CORRESPONDENT;
RAIL_CONFIG.CARD_PUSH = RAIL_CONFIG.CARD_PAYOUT;
RAIL_CONFIG.RTGS_INSTANT = RAIL_CONFIG.RTGS_SETTLEMENT;

const CANONICAL_RAIL_IDS = [
  'SWIFT_CORRESPONDENT',
  'INSTANT_PAYMENT_LINK',
  'CARD_PAYOUT',
  'RTGS_SETTLEMENT'
];

module.exports = RAIL_CONFIG;
module.exports.CANONICAL_RAIL_IDS = CANONICAL_RAIL_IDS;
