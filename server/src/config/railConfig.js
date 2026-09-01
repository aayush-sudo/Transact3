/**
 * 6 Simulated Settlement Rails Configuration & Baseline Properties
 */
const RAIL_CONFIG = {
  SWIFT_BATCH: {
    id: 'SWIFT_BATCH',
    name: 'SWIFT Classic Batch',
    description: 'Correspondent-banking international settlement batch processing',
    baseFeeUSD: 25.00,
    variableFeePct: 0.0010, // 10 bps
    minLatencyHours: 24,
    maxLatencyHours: 48,
    avgLatencyHours: 36,
    maxAmountUSD: 50000000,
    reliabilityScore: 0.99,
    capacityHourlyUSD: 50000000,
    icon: 'Globe'
  },
  RTGS_INSTANT: {
    id: 'RTGS_INSTANT',
    name: 'RTGS High-Value Clearing',
    description: 'Real-time gross settlement (Fedwire/TARGET2/CHAPS style)',
    baseFeeUSD: 18.00,
    variableFeePct: 0.0005, // 5 bps
    minLatencyHours: 0.08, // 5 min
    maxLatencyHours: 0.5,  // 30 min
    avgLatencyHours: 0.25,
    maxAmountUSD: 2000000,
    reliabilityScore: 0.995,
    capacityHourlyUSD: 10000000,
    icon: 'Zap'
  },
  REGIONAL_INSTANT: {
    id: 'REGIONAL_INSTANT',
    name: 'Regional Instant Network',
    description: 'Direct instant clearing (SEPA Instant, FedNow, UPI, Pix, PayNow, FPS)',
    baseFeeUSD: 1.50,
    variableFeePct: 0.0002, // 2 bps
    minLatencyHours: 0.0003, // 1 sec
    maxLatencyHours: 0.0027, // 10 sec
    avgLatencyHours: 0.001,
    maxAmountUSD: 100000,
    reliabilityScore: 0.985,
    capacityHourlyUSD: 2000000,
    icon: 'Activity'
  },
  STABLECOIN_VAULT: {
    id: 'STABLECOIN_VAULT',
    name: 'Stablecoin Liquidity Vault',
    description: 'Institutional USDC/EURC API liquidity vault settlement pool',
    baseFeeUSD: 0.50,
    variableFeePct: 0.0001, // 1 bps
    minLatencyHours: 0.001, // 3 sec.
    maxLatencyHours: 0.008, // 30 sec
    avgLatencyHours: 0.003,
    maxAmountUSD: 1000000,
    reliabilityScore: 0.98,
    capacityHourlyUSD: 5000000,
    icon: 'ShieldCheck'
  },
  NETTING_LEDGER: {
    id: 'NETTING_LEDGER',
    name: 'Bilateral Intra-Bank Netting',
    description: 'Direct book-transfer netting between partner financial institutions',
    baseFeeUSD: 0.00,
    variableFeePct: 0.0000, // 0 bps
    minLatencyHours: 0.0002, // 1 sec
    maxLatencyHours: 0.0005,
    avgLatencyHours: 0.0003,
    maxAmountUSD: 5000000,
    reliabilityScore: 0.999,
    capacityHourlyUSD: 15000000,
    icon: 'Repeat'
  },
  CARD_PUSH: {
    id: 'CARD_PUSH',
    name: 'Card Push Network',
    description: 'Visa Direct / Mastercard Send account-to-card push payments',
    baseFeeUSD: 3.50,
    variableFeePct: 0.0015, // 15 bps
    minLatencyHours: 0.08, // 5 min
    maxLatencyHours: 0.25, // 15 min
    avgLatencyHours: 0.15,
    maxAmountUSD: 50000,
    reliabilityScore: 0.97,
    capacityHourlyUSD: 1000000,
    icon: 'CreditCard'
  }
};

module.exports = RAIL_CONFIG;
