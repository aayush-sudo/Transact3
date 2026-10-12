const SUPPORTED_CURRENCIES = require('../config/currencies');
const { getCorridorConfig } = require('../config/corridors');

const RETAIL_INSTANT_LIMIT_USD = 1000;
const LOCAL_CLEARING = {
  USD: { name: 'FedNow / RTP (modeled)', timeZone: 'America/New_York' },
  EUR: { name: 'SEPA Instant (modeled)', timeZone: 'Europe/Berlin' },
  GBP: { name: 'Faster Payments (modeled)', timeZone: 'Europe/London' },
  INR: { name: 'UPI / IMPS (modeled)', timeZone: 'Asia/Kolkata' },
  BRL: { name: 'Pix (modeled)', timeZone: 'America/Sao_Paulo' },
  AED: { name: 'UAE Aani (modeled)', timeZone: 'Asia/Dubai' },
  SGD: { name: 'PayNow FAST (modeled)', timeZone: 'Asia/Singapore' },
  AUD: { name: 'NPP (modeled)', timeZone: 'Australia/Sydney' },
  CAD: { name: 'RTR / Interac (modeled)', timeZone: 'America/Toronto' }
};
const TIME_ZONES = {
  USD: 'America/New_York',
  EUR: 'Europe/Berlin',
  GBP: 'Europe/London',
  INR: 'Asia/Kolkata',
  BRL: 'America/Sao_Paulo',
  AED: 'Asia/Dubai',
  SGD: 'Asia/Singapore',
  AUD: 'Australia/Sydney',
  CAD: 'America/Toronto',
  JPY: 'Asia/Tokyo'
};
const LIQUIDITY_PREMIUM_BPS = { INR: 5, BRL: 5, AED: 3, SGD: 2, AUD: 2 };
const RAIL_SPREAD_PREMIUM_BPS = {
  INSTANT_PAYMENT_LINK: 5,
  REGIONAL_INSTANT: 5,
  CARD_PAYOUT: 10,
  CARD_PUSH: 10,
  SWIFT_CORRESPONDENT: 0,
  SWIFT_BATCH: 0
};

function currencyCode(value) {
  return String(value || '').toUpperCase();
}

function getInstantEligibility(sourceCurrency, destinationCurrency, amountUSD) {
  const source = currencyCode(sourceCurrency);
  const destination = currencyCode(destinationCurrency);
  const clearing = LOCAL_CLEARING[destination];
  if (!clearing) {
    return {
      eligible: false,
      reason: `No configured cross-border instant clearing route for ${destination}.`
    };
  }

  const limitUSD = RETAIL_INSTANT_LIMIT_USD;
  if (amountUSD > limitUSD) {
    return {
      eligible: false,
      limitUSD,
      reason: `Amount exceeds the instant rail clearing threshold of $${limitUSD.toLocaleString('en-US')} USD; standard banking settlement is required.`
    };
  }

  return {
    eligible: true,
    limitUSD,
    clearingRail: clearing.name,
    timeZone: clearing.timeZone,
    reason: null,
    sourceCurrency: source
  };
}

function getVolumeAdjustmentBps(amountUSD) {
  if (amountUSD < 100) return 8;
  if (amountUSD < 1000) return 4;
  if (amountUSD < 10000) return 0;
  if (amountUSD < 100000) return -2;
  return -5;
}

function calculateSpreadBps(sourceCurrency, destinationCurrency, amountUSD, railId) {
  const source = currencyCode(sourceCurrency);
  const destination = currencyCode(destinationCurrency);
  if (source === destination) return 0;
  const corridor = getCorridorConfig(source, destination);
  const liquidityPremium = Math.max(
    LIQUIDITY_PREMIUM_BPS[source] || 0,
    LIQUIDITY_PREMIUM_BPS[destination] || 0
  );
  const volumeAdjustment = getVolumeAdjustmentBps(Math.max(0, Number(amountUSD) || 0));
  const speedPremium = RAIL_SPREAD_PREMIUM_BPS[railId] || 0;
  return Math.max(
    5,
    (corridor.baseSpreadBps || 40) + liquidityPremium + volumeAdjustment + speedPremium
  );
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function getTimeZoneOffset(date, timeZone) {
  const parts = zonedParts(date, timeZone);
  const localAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return localAsUtc - date.getTime();
}

function fromZonedParts(parts, timeZone) {
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second || 0);
  const firstGuess = new Date(utcGuess);
  const result = new Date(utcGuess - getTimeZoneOffset(firstGuess, timeZone));
  return new Date(utcGuess - getTimeZoneOffset(result, timeZone));
}

function localWeekday(parts) {
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))).getUTCDay();
}

function nextLocalDate(parts) {
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function nextBusinessOpening(parts, timeZone) {
  let dateParts = nextLocalDate(parts);
  while (localWeekday({ ...dateParts, weekday: '' }) === 0 || localWeekday({ ...dateParts, weekday: '' }) === 6) {
    dateParts = nextLocalDate({ ...dateParts, hour: 0, minute: 0, second: 0 });
  }
  return fromZonedParts({ ...dateParts, hour: 9, minute: 0, second: 0 }, timeZone);
}

function normalizeBusinessStart(date, timeZone) {
  let parts = zonedParts(date, timeZone);
  const hour = Number(parts.hour) + Number(parts.minute) / 60;
  const weekday = localWeekday(parts);
  if (weekday === 0 || weekday === 6 || hour >= 17) {
    return nextBusinessOpening(parts, timeZone);
  }
  if (hour < 9) {
    return fromZonedParts({
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: 9,
      minute: 0,
      second: 0
    }, timeZone);
  }
  return date;
}

function nextBankingOpening(date, timeZone) {
  const parts = zonedParts(date, timeZone);
  const hour = Number(parts.hour) + Number(parts.minute) / 60;
  const weekday = localWeekday(parts);
  if (weekday >= 1 && weekday <= 5 && hour >= 9 && hour < 17) return date;
  if (weekday >= 1 && weekday <= 5 && hour < 9) {
    return fromZonedParts({
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: 9,
      minute: 0,
      second: 0
    }, timeZone);
  }
  return nextBusinessOpening(parts, timeZone);
}

function addBusinessHours(start, businessHours, timeZone) {
  let cursor = normalizeBusinessStart(start, timeZone);
  let remaining = businessHours;
  while (remaining > 0) {
    const parts = zonedParts(cursor, timeZone);
    const hour = Number(parts.hour) + Number(parts.minute) / 60 + Number(parts.second) / 3600;
    const available = Math.max(0, 17 - hour);
    if (remaining <= available) {
      return new Date(cursor.getTime() + remaining * 3600000);
    }
    remaining -= available;
    cursor = nextBusinessOpening(parts, timeZone);
  }
  return cursor;
}

function formatBusinessWindow(minHours, maxHours) {
  if (maxHours <= 8) return `${minHours}–${maxHours} business hours (within local banking window)`;
  const minDays = Math.max(1, Math.ceil(minHours / 8));
  const maxDays = Math.max(minDays, Math.ceil(maxHours / 8));
  const dayLabel = minDays === maxDays ? `${minDays} business day${minDays === 1 ? '' : 's'}` : `${minDays}–${maxDays} business days`;
  return `${dayLabel} (${minHours}–${maxHours} business hours; local cutoff and weekends applied)`;
}

function getBankingHours(sourceCurrency, destinationCurrency, amountUSD) {
  const source = SUPPORTED_CURRENCIES[currencyCode(sourceCurrency)];
  const destination = SUPPORTED_CURRENCIES[currencyCode(destinationCurrency)];
  const sameRegion = source && destination && source.region === destination.region;
  const corridor = getCorridorConfig(sourceCurrency, destinationCurrency);
  const lowLiquidity = (corridor.baseSpreadBps || 40) >= 50;
  let minimum = sameRegion ? 4 : lowLiquidity ? 16 : 8;
  let maximum = minimum + (sameRegion ? 4 : 8);
  if (amountUSD >= 100000) {
    minimum += 8;
    maximum += 8;
  }
  if (amountUSD >= 1000000) {
    minimum += 8;
    maximum += 8;
  }
  return { minimum, maximum };
}

function getSettlementPlan(sourceCurrency, destinationCurrency, amountUSD, railId, currentTime = new Date()) {
  const instant = getInstantEligibility(sourceCurrency, destinationCurrency, amountUSD);
  const timeZone = TIME_ZONES[currencyCode(destinationCurrency)] || 'UTC';

  if (railId === 'INSTANT_PAYMENT_LINK' || railId === 'REGIONAL_INSTANT') {
    return {
      railId,
      appliedClearingRail: instant.clearingRail || 'Unavailable',
      is_instant: instant.eligible,
      instantFeasibility: instant.eligible ? 'Eligible' : 'Ineligible',
      instantIneligibilityReason: instant.reason,
      instantThresholdUSD: instant.limitUSD || RETAIL_INSTANT_LIMIT_USD,
      minimumSettlementHours: 0,
      maximumSettlementHours: 1 / 60,
      settlementWindow: instant.eligible ? '< 60 seconds (modeled local real-time clearing)' : null,
      earliestSettlementAt: instant.eligible ? currentTime.toISOString() : null,
      latestSettlementAt: instant.eligible ? new Date(currentTime.getTime() + 60000).toISOString() : null,
      timeZone
    };
  }

  if (railId === 'CARD_PAYOUT' || railId === 'CARD_PUSH') {
    const source = SUPPORTED_CURRENCIES[currencyCode(sourceCurrency)];
    const destination = SUPPORTED_CURRENCIES[currencyCode(destinationCurrency)];
    const corridor = getCorridorConfig(sourceCurrency, destinationCurrency);
    const corridorDelayMinutes = source?.region === destination?.region ? 0 : 5;
    const liquidityDelayMinutes = (corridor.baseSpreadBps || 40) >= 50 ? 5 : 0;
    const volumeDelayMinutes = amountUSD >= 500 ? 5 : 0;
    const minMinutes = 5 + corridorDelayMinutes + liquidityDelayMinutes;
    const maxMinutes = minMinutes + 10 + volumeDelayMinutes;
    const reason = instant.reason || 'Card payout is not an instant bank-clearing rail.';
    return {
      railId,
      appliedClearingRail: 'Card payout network (modeled)',
      is_instant: false,
      instantFeasibility: 'Ineligible',
      instantIneligibilityReason: reason,
      instantThresholdUSD: instant.limitUSD || RETAIL_INSTANT_LIMIT_USD,
      minimumSettlementHours: minMinutes / 60,
      maximumSettlementHours: maxMinutes / 60,
      settlementWindow: `${minMinutes}–${maxMinutes} minutes (modeled corridor/card payout)`,
      earliestSettlementAt: new Date(currentTime.getTime() + minMinutes * 60000).toISOString(),
      latestSettlementAt: new Date(currentTime.getTime() + maxMinutes * 60000).toISOString(),
      timeZone
    };
  }

  const { minimum, maximum } = getBankingHours(sourceCurrency, destinationCurrency, amountUSD);
  const sourceTimeZone = TIME_ZONES[currencyCode(sourceCurrency)] || 'UTC';
  const sourceOpening = nextBankingOpening(currentTime, sourceTimeZone);
  const destinationOpening = nextBankingOpening(currentTime, timeZone);
  const corridorStart = new Date(Math.max(sourceOpening.getTime(), destinationOpening.getTime()));
  const earliest = addBusinessHours(corridorStart, minimum, timeZone);
  const latest = addBusinessHours(corridorStart, maximum, timeZone);
  return {
    railId: railId || 'SWIFT_CORRESPONDENT',
    appliedClearingRail: 'SWIFT gpi / correspondent banking (modeled)',
    is_instant: false,
    instantFeasibility: 'Ineligible',
    instantIneligibilityReason: instant.reason || 'Standard banking settlement selected for this route.',
    instantThresholdUSD: instant.limitUSD || RETAIL_INSTANT_LIMIT_USD,
    minimumSettlementHours: minimum,
    maximumSettlementHours: maximum,
    settlementWindow: formatBusinessWindow(minimum, maximum),
    earliestSettlementAt: earliest.toISOString(),
    latestSettlementAt: latest.toISOString(),
    timeZone
  };
}

module.exports = {
  RETAIL_INSTANT_LIMIT_USD,
  getInstantEligibility,
  calculateSpreadBps,
  getSettlementPlan,
  getBankingHours
};
