/**
 * Structured conversation context for the Transact3 AI Agent.
 *
 * The chat transcript alone is not a reliable source of truth: short follow-ups
 * ("Check its forecast") contain no currencies, and older turns can contain a
 * different pair. This module builds an explicit, versioned "active context"
 * from the transcript and merges it with the freshly classified intent using
 * deterministic rules:
 *
 *   - an explicit currency pair in the newest message always wins
 *   - an unchanged field is retained from the most recent financial operation
 *   - a field is only cleared when the user starts a genuinely new topic
 *   - the new intent is never overwritten by the previous intent
 *
 * It deliberately has no dependency on the LLM: it is the grounding layer that
 * makes the LLM's output safe to route to financial services.
 */

const {
  detectCurrencyMentions,
  detectAmount,
  normalizeCurrency,
  isCorrectionMessage,
  extractIntent
} = require('./aiAgentService');
const { isCurrencySupported } = require('../config/currencies');

const MAX_CONTEXT_DISTANCE = 10; // messages; older financial turns are considered stale
const MAX_CONTEXT_VERSION = 999;

const FINANCIAL_INTENTS = new Set([
  'TRANSFER_REQUEST',
  'TRANSFER_COMPARISON',
  'COMPETITOR_COMPARISON',
  'CHEAPEST_TRANSFER',
  'FASTEST_TRANSFER',
  'RECIPIENT_TRANSFER',
  'WHAT_IF_ANALYSIS',
  'PAYMENT_SCHEDULING',
  'CURRENCY_CONVERSION',
  'FX_FORECAST',
  'FX_INFORMATION',
  'FX_TIMING_ANALYSIS'
]);

// Intents whose answer is a *quote*, not an executed operation. They are still
// relevant context for follow-ups, so they are included above.
const PAIR_BEARING_INTENTS = new Set([
  'CURRENCY_CONVERSION',
  'FX_FORECAST',
  'FX_INFORMATION',
  'FX_TIMING_ANALYSIS',
  'TRANSFER_REQUEST',
  'TRANSFER_COMPARISON',
  'COMPETITOR_COMPARISON',
  'CHEAPEST_TRANSFER',
  'FASTEST_TRANSFER',
  'RECIPIENT_TRANSFER',
  'WHAT_IF_ANALYSIS',
  'PAYMENT_SCHEDULING'
]);

// A message that refers back to something already said.
const REFERENCE_PATTERN = /(?<![a-z])(?:its|it's|it|this|that|these|those|the same|same one|that one)(?![a-z])/i;

// Follow-up openings that carry no new subject of their own.
const FOLLOW_UP_PATTERN = new RegExp(
  [
    '^(?:ok(?:ay)?[,.!]?\\s*)?(?:and\\s+)?(?:what|how)\\s+(?:about|if)\\b',
    '^(?:ok(?:ay)?[,.!]?\\s*)?(?:now\\s+)?(?:check|show|explain|tell me|give me|compare|convert|forecast|analyse|analyze)\\b',
    '^(?:and|also|then)\\b',
    '^\\s*(?:should i|would it|is it|is now|will it|when should)',
    '^\\s*(?:make it|change|update|set)\\b',
    '^\\s*(?:what about|how about)'
  ].join('|'),
  'i'
);

// Explicit instruction to abandon the previous topic.
const RESET_PATTERN = /\b(?:new (?:transfer|conversation|chat|request)|start (?:a )?(?:new|over)|forget (?:that|this|everything)|reset (?:the )?context|different (?:transfer|request))\b/i;

// Pronoun-only finance follow-ups: no currency names, but clearly about FX.
const FINANCE_FOLLOW_UP_PATTERN = /\b(?:forecast|outlook|trend|prediction|rate|wait|convert|exchange|cheaper|cheapest|fastest|provider|option|timing|tomorrow|next week|next month|improve)\b/i;

const isFinancialIntent = (intent) => FINANCIAL_INTENTS.has(String(intent || '').toUpperCase());

const isReferenceMessage = (prompt) => REFERENCE_PATTERN.test(String(prompt || ''));

const isFollowUpMessage = (prompt) => {
  const text = String(prompt || '').trim();
  if (!text) return false;
  if (RESET_PATTERN.test(text)) return false;
  if (FOLLOW_UP_PATTERN.test(text)) return true;
  // Short messages that only reference a prior entity.
  if (text.length <= 60 && isReferenceMessage(text)) return true;
  return false;
};

const isResetMessage = (prompt) => RESET_PATTERN.test(String(prompt || ''));

/**
 * Finds every explicit currency pair written in the message.
 * Handles "SGD to INR", "SGD/INR", "USD in INR", "USD versus INR".
 * Order follows the sentence, never a hardcoded currency list.
 */
const detectExplicitPairs = (prompt) => {
  const text = String(prompt || '');
  const pairs = [];
  const seen = new Set();

  const pushPair = (rawSource, rawDestination) => {
    const sourceCurrency = normalizeCurrency(rawSource);
    const destinationCurrency = normalizeCurrency(rawDestination);
    if (!sourceCurrency || !destinationCurrency || sourceCurrency === destinationCurrency) return;
    const key = `${sourceCurrency}/${destinationCurrency}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ sourceCurrency, destinationCurrency, key });
  };

  const slash = /(?<![A-Za-z])([A-Za-z]{3})\s*[/\-]\s*([A-Za-z]{3})(?![A-Za-z])/g;
  let match;
  while ((match = slash.exec(text)) !== null) pushPair(match[1], match[2]);

  const words = /(?<![A-Za-z])([A-Za-z]{3})\s+(?:to|into|in|versus|vs\.?|against|->|→)\s+([A-Za-z]{3})(?![A-Za-z])/gi;
  while ((match = words.exec(text)) !== null) pushPair(match[1], match[2]);

  return pairs;
};

/**
 * Builds the active context from the transcript: the most recent *financial*
 * operation, plus everything needed to decide whether a reference is
 * unambiguous.
 */
const buildActiveContext = ({ history = [], prompt = '' } = {}) => {
  const messages = Array.isArray(history) ? history : [];
  const reset = isResetMessage(prompt);
  const explicitPairs = detectExplicitPairs(prompt);
  const mentions = detectCurrencyMentions(String(prompt || ''));
  const mentionedCodes = [...new Set(mentions.map((mention) => mention.code))];

  let active = null;
  let contextVersion = 0;
  const recentPairs = [];

  if (!reset) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (!message || message.role !== 'assistant' || !message.parsed) continue;
      const intent = String(message.parsed.intent || '').toUpperCase();
      if (!isFinancialIntent(intent)) continue;

      const sourceCurrency = normalizeCurrency(message.parsed.sourceCurrency);
      const destinationCurrency = normalizeCurrency(message.parsed.destinationCurrency);
      const referencedPairs = Array.isArray(message.parsed.referencedPairs)
        ? message.parsed.referencedPairs
            .map((pair) => ({
              sourceCurrency: normalizeCurrency(pair && pair.sourceCurrency),
              destinationCurrency: normalizeCurrency(pair && pair.destinationCurrency)
            }))
            .filter((pair) => pair.sourceCurrency && pair.destinationCurrency)
        : [];

      const isPairBearing = PAIR_BEARING_INTENTS.has(intent);
      if (isPairBearing && !sourceCurrency && !destinationCurrency && referencedPairs.length === 0) continue;

      const distance = messages.length - i;
      if (distance > MAX_CONTEXT_DISTANCE) break;

      recentPairs.push(...referencedPairs);

      if (!active) {
        active = {
          intent,
          amount: message.parsed.amount != null ? Number(message.parsed.amount) : null,
          amountType: message.parsed.amountType || 'SENDER_AMOUNT',
          sourceCurrency,
          destinationCurrency,
          priority: message.parsed.priority || 'BALANCED',
          paymentMode: message.parsed.paymentMode || 'SEND_AMOUNT',
          referencedPairs,
          messageIndex: i,
          distance,
          operationTimestamp: message.parsed.operationTimestamp || null
        };
      }
    }
  }

  // Version = number of financial operations already in the transcript, so the
  // caller can prove that newer context replaced older context.
  for (const message of messages) {
    if (message && message.role === 'assistant' && message.parsed && isFinancialIntent(message.parsed.intent)) {
      contextVersion += 1;
    }
  }
  contextVersion = Math.min(contextVersion, MAX_CONTEXT_VERSION);

  // A reference is ambiguous when the most recent operation itself covered more
  // than one pair ("Compare USD/INR and EUR/INR") and the new message supplies
  // no pair of its own.
  const multiPairContext = Boolean(
    active && ((active.referencedPairs && active.referencedPairs.length > 1)
      || (recentPairs.length > 1 && !active.sourceCurrency))
  );
  const isBareReference = explicitPairs.length === 0
    && mentionedCodes.length === 0
    && (isReferenceMessage(prompt) || isFollowUpMessage(prompt))
    && FINANCE_FOLLOW_UP_PATTERN.test(String(prompt || ''));

  return {
    conversationId: null, // filled in by the controller
    contextVersion,
    reset,
    isFollowUp: isFollowUpMessage(prompt),
    isBareReference,
    explicitPairs,
    mentionedCodes,
    ambiguousPairs: Boolean(multiPairContext && isBareReference),
    ambiguousOptions: multiPairContext && isBareReference
      ? (active.referencedPairs && active.referencedPairs.length ? active.referencedPairs : recentPairs)
      : [],
    active: active || null
  };
};

/**
 * Merges a freshly classified intent with the active context.
 *
 * Returns the merged parsed object plus an audit trail describing exactly which
 * fields were changed, retained or cleared. The current intent is never
 * replaced by the previous intent unless the message carried no intent of its
 * own (a pure clarification reply).
 */
const mergeIntentWithContext = ({ prompt, intentResult, context }) => {
  const parsed = { ...((intentResult && intentResult.parsed) || {}) };
  const active = context && context.active ? context.active : null;
  const reset = Boolean(context && context.reset);
  const followUp = Boolean(context && context.isFollowUp);
  const explicitPairs = (context && context.explicitPairs) || detectExplicitPairs(prompt);
  const mentionedCodes = (context && context.mentionedCodes) || [];

  const originalIntent = String(parsed.intent || 'UNKNOWN').toUpperCase();
  const fieldsChanged = [];
  const fieldsRetained = [];
  const fieldsCleared = [];

  const setField = (field, value, reason) => {
    const before = parsed[field];
    if (before === value) return;
    parsed[field] = value;
    if (value == null) fieldsCleared.push(field);
    else if (reason) fieldsChanged.push(field);
  };

  const retain = (field, value) => {
    if (value == null || parsed[field] != null) return;
    parsed[field] = value;
    fieldsRetained.push(field);
  };

  // ---- Intent -----------------------------------------------------------
  // Only a message that produced no intent of its own inherits the previous
  // intent. A genuine new intent always survives (e.g. CURRENCY_CONVERSION ->
  // FX_FORECAST is an intent change on the same entities, not a new topic).
  const treatAsClarification = originalIntent === 'CLARIFICATION_RESPONSE'
    || originalIntent === 'UNKNOWN'
    || Boolean(intentResult && intentResult.isClarification);

  const correction = isCorrectionMessage(prompt);

  if (reset) {
    parsed.intent = originalIntent === 'UNKNOWN' ? 'UNKNOWN' : originalIntent;
  } else if (active && active.intent && isFinancialIntent(active.intent)
    && (treatAsClarification || correction)) {
    // A clarification reply or an explicit edit ("change destination to EUR")
    // resumes the previous operation instead of starting a new transfer.
    parsed.intent = active.intent;
    fieldsRetained.push('intent');
  }

  // ---- Currencies -------------------------------------------------------
  let sourceCurrency = normalizeCurrency(parsed.sourceCurrency);
  let destinationCurrency = normalizeCurrency(parsed.destinationCurrency);

  if (explicitPairs.length === 1) {
    // An explicit, unambiguous pair always wins over anything older.
    const pair = explicitPairs[0];
    if (sourceCurrency !== pair.sourceCurrency || destinationCurrency !== pair.destinationCurrency) {
      fieldsChanged.push('sourceCurrency', 'destinationCurrency');
    }
    sourceCurrency = pair.sourceCurrency;
    destinationCurrency = pair.destinationCurrency;
  } else if (explicitPairs.length > 1) {
    // Multiple pairs in one message: keep the primary pair resolved by the
    // classifier, but never let an older unrelated pair fill the gap.
    const primary = explicitPairs[explicitPairs.length - 1];
    sourceCurrency = sourceCurrency || primary.sourceCurrency;
    destinationCurrency = destinationCurrency || primary.destinationCurrency;
  }

  // One currency mentioned on its own: fill only the missing side from context,
  // and honour an explicit role ("change destination to EUR").
  if (mentionedCodes.length === 1 && explicitPairs.length === 0) {
    const onlyCode = mentionedCodes[0];
    const role = roleOfMention(prompt, onlyCode);
    if (role === 'destination') {
      if (destinationCurrency !== onlyCode) fieldsChanged.push('destinationCurrency');
      destinationCurrency = onlyCode;
      sourceCurrency = sourceCurrency || (active && active.sourceCurrency) || null;
    } else if (role === 'source') {
      if (sourceCurrency !== onlyCode) fieldsChanged.push('sourceCurrency');
      sourceCurrency = onlyCode;
      destinationCurrency = destinationCurrency || (active && active.destinationCurrency) || null;
    } else if (!sourceCurrency && !destinationCurrency) {
      // "Use GBP instead" - ambiguous side.
      sourceCurrency = null;
      destinationCurrency = null;
    }
  }

  if (!reset && active) {
    if (!sourceCurrency) retain('sourceCurrency', active.sourceCurrency);
    if (!destinationCurrency) retain('destinationCurrency', active.destinationCurrency);
  }

  setField('sourceCurrency', sourceCurrency || null);
  setField('destinationCurrency', destinationCurrency || null);

  // ---- Amount -----------------------------------------------------------
  const amountInPrompt = detectAmount(String(prompt || ''));
  let amount = parsed.amount;
  if (amount == null && amountInPrompt != null) amount = amountInPrompt;
  if (amount == null && !reset && active && (followUp || treatAsClarification)) {
    if (active.amount != null) {
      amount = active.amount;
      fieldsRetained.push('amount');
    }
  }
  setField('amount', amount != null ? amount : null);

  // ---- Priority / payment mode -----------------------------------------
  if (!reset && active) {
    if (parsed.priority === 'BALANCED' && active.priority && active.priority !== 'BALANCED') {
      parsed.priority = active.priority;
      fieldsRetained.push('priority');
    }
    if (parsed.paymentMode === 'SEND_AMOUNT' && active.paymentMode === 'RECIPIENT_GETS'
      && !/\bsend\b/i.test(String(prompt || ''))) {
      parsed.paymentMode = active.paymentMode;
      fieldsRetained.push('paymentMode');
    }
  }

  if (explicitPairs.length > 1) {
    parsed.referencedPairs = explicitPairs.map((pair) => ({
      sourceCurrency: pair.sourceCurrency,
      destinationCurrency: pair.destinationCurrency
    }));
  } else if (explicitPairs.length === 0 && !reset && active && active.referencedPairs && active.referencedPairs.length > 1) {
    parsed.referencedPairs = active.referencedPairs.map((pair) => ({ ...pair }));
  }

  parsed.operationTimestamp = new Date().toISOString();
  parsed.contextVersion = (context && context.contextVersion != null ? context.contextVersion : 0) + 1;

  return {
    parsed,
    resolution: {
      previousIntent: active ? active.intent : null,
      intent: parsed.intent,
      previousSourceCurrency: active ? active.sourceCurrency : null,
      previousDestinationCurrency: active ? active.destinationCurrency : null,
      sourceCurrency: parsed.sourceCurrency,
      destinationCurrency: parsed.destinationCurrency,
      amount: parsed.amount,
      fieldsChanged: [...new Set(fieldsChanged)],
      fieldsRetained: [...new Set(fieldsRetained)],
      fieldsCleared: [...new Set(fieldsCleared)],
      resolutionDecision: context && context.ambiguousPairs
        ? 'AMBIGUOUS_REFERENCE'
        : (explicitPairs.length ? 'EXPLICIT_PAIR'
          : (active ? 'INHERITED_FROM_ACTIVE_CONTEXT' : 'NO_CONTEXT')),
      contextVersion: parsed.contextVersion
    }
  };
};

const roleOfMention = (prompt, code) => {
  const mentions = detectCurrencyMentions(String(prompt || '')).filter((mention) => mention.code === code);
  if (!mentions.length) return null;
  const { index } = mentions[mentions.length - 1];
  const before = String(prompt).slice(Math.max(0, index - 48), index).toLowerCase();
  const after = String(prompt).slice(index, index + 48).toLowerCase();

  if (/\b(?:destination|target|receive|receiving|receiver|recipient|beneficiary|to|into|in|towards?|gets?|get)\s*$/.test(before)) {
    return 'destination';
  }
  if (/\b(?:destination|target)\b/.test(before)) return 'destination';
  if (/\b(?:will|do|can|would)\s+(?:i|we)\s+(?:get|receive)\b|\b(?:i|we)\s+(?:get|receive)\b/.test(after)) {
    return 'destination';
  }
  if (/\b(?:source|from|using|with|send|sending|spend|convert|exchange|change)\s*$/.test(before)) {
    return 'source';
  }
  return null;
};

/**
 * Guards a forecast before it is shown to the user. The forecasting engine must
 * answer for the pair that was resolved from the conversation; a response for a
 * different pair is rejected rather than silently displayed.
 */
const validateForecastPair = (forecast, expectedSource, expectedDestination) => {
  const rawSource = String(expectedSource || '').trim().toUpperCase();
  const rawDestination = String(expectedDestination || '').trim().toUpperCase();
  if (!rawSource || !rawDestination) {
    return { ok: false, reason: 'MISSING_PAIR' };
  }
  if (!isCurrencySupported(rawSource) || !isCurrencySupported(rawDestination)) {
    return {
      ok: false,
      reason: 'UNSUPPORTED_PAIR',
      sourceCurrency: rawSource,
      destinationCurrency: rawDestination
    };
  }
  const sourceCurrency = normalizeCurrency(rawSource);
  const destinationCurrency = normalizeCurrency(rawDestination);
  if (!forecast || typeof forecast !== 'object') {
    return { ok: false, reason: 'EMPTY_FORECAST', sourceCurrency, destinationCurrency };
  }
  const actualSource = normalizeCurrency(forecast.sourceCurrency);
  const actualDestination = normalizeCurrency(forecast.destinationCurrency);
  if (!actualSource || !actualDestination) {
    return { ok: false, reason: 'FORECAST_PAIR_UNSPECIFIED', sourceCurrency, destinationCurrency };
  }
  if (actualSource !== sourceCurrency || actualDestination !== destinationCurrency) {
    return {
      ok: false,
      reason: 'FORECAST_PAIR_MISMATCH',
      sourceCurrency,
      destinationCurrency,
      actualSource,
      actualDestination
    };
  }
  if (!(Number(forecast.currentRate) > 0)) {
    return { ok: false, reason: 'INVALID_RATE', sourceCurrency, destinationCurrency };
  }
  return { ok: true, reason: null, sourceCurrency, destinationCurrency };
};

const describeForecastMismatch = (validation) => {
  if (!validation) return 'I could not validate that forecast request.';
  if (validation.reason === 'UNSUPPORTED_PAIR') {
    return `I can't forecast ${validation.sourceCurrency}/${validation.destinationCurrency} because that pair is not supported. Supported currencies are ${[...require('../config/currencies').SUPPORTED_CURRENCY_CODES].join(', ')}. I won't substitute another pair.`;
  }
  if (validation.reason === 'FORECAST_PAIR_MISMATCH') {
    return `I could not produce a forecast for ${validation.sourceCurrency}/${validation.destinationCurrency}. The forecasting model returned ${validation.actualSource}/${validation.actualDestination}, so I'm not going to show it as your requested forecast. Please try again.`;
  }
  return 'I could not produce a forecast for that currency pair right now. Please try again.';
};

const INTENT_ACTION_MAP = {
  TRANSFER_REQUEST: 'TRANSFER',
  CHEAPEST_TRANSFER: 'TRANSFER',
  FASTEST_TRANSFER: 'TRANSFER',
  TRANSFER_COMPARISON: 'TRANSFER',
  COMPETITOR_COMPARISON: 'COMPETITOR_COMPARISON',
  CURRENCY_CONVERSION: 'CONVERT',
  WALLET_BALANCE: 'BALANCE',
  WALLET_HOLDINGS: 'BALANCE',
  FX_FORECAST: 'FX_FORECAST',
  FX_TIMING_ANALYSIS: 'FX_TIMING_ANALYSIS',
  FX_INFORMATION: 'FX_FORECAST',
  TRANSACTION_HISTORY: 'HISTORY',
  TRANSACTION_STATUS: 'HISTORY',
  RECIPIENT_TRANSFER: 'TRANSFER',
  RECIPIENT_LOOKUP: 'BALANCE',
  WHAT_IF_ANALYSIS: 'TRANSFER',
  PAYMENT_SCHEDULING: 'TRANSFER',
  GREETING: 'GREETING',
  GENERAL_PLATFORM_QUESTION: 'GENERAL',
  TRANSACT3_PLATFORM_QUESTION: 'PLATFORM_INFO',
  GENERAL_KNOWLEDGE: 'GENERAL_KNOWLEDGE',
  GENERAL_CONVERSATION: 'GENERAL_CONVERSATION',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',
  UNSUPPORTED_OPERATION: 'OUT_OF_SCOPE',
  TRANSFER_EXPLANATION: 'GENERAL',
  CLARIFICATION_RESPONSE: 'CLARIFICATION',
  UNKNOWN: 'UNKNOWN'
};

const intentToAction = (intent) => INTENT_ACTION_MAP[String(intent || '').toUpperCase()] || 'UNKNOWN';

// Timing questions override a plain conversion classification.
const TIMING_PATTERN = /\b(?:now or wait|should i (?:convert|exchange|wait|send)|good time|better time|wait for|rate to improve|become stronger|become weaker)\b/i;

/**
 * Full deterministic resolution pipeline for one user turn:
 * transcript -> active context -> fresh intent -> merged entities -> operation.
 * The controller uses this exact function, so tests exercise production logic.
 */
const resolveAgentTurn = async ({
  prompt,
  history = [],
  conversationId = null,
  intentOptions = {}
}) => {
  const context = buildActiveContext({ history, prompt });
  context.conversationId = conversationId;

  const intentResult = await extractIntent(prompt, { history, ...intentOptions });
  const { parsed, resolution } = mergeIntentWithContext({ prompt, intentResult, context });

  let actionType = intentToAction(parsed.intent);
  if (TIMING_PATTERN.test(String(prompt || ''))) {
    actionType = 'FX_TIMING_ANALYSIS';
    parsed.intent = 'FX_TIMING_ANALYSIS';
  }

  return { conversationId, context, intentResult, parsed, resolution, actionType };
};

module.exports = {
  FINANCIAL_INTENTS,
  PAIR_BEARING_INTENTS,
  MAX_CONTEXT_DISTANCE,
  INTENT_ACTION_MAP,
  isFinancialIntent,
  isFollowUpMessage,
  isReferenceMessage,
  isResetMessage,
  detectExplicitPairs,
  roleOfMention,
  buildActiveContext,
  mergeIntentWithContext,
  validateForecastPair,
  describeForecastMismatch,
  intentToAction,
  resolveAgentTurn
};
