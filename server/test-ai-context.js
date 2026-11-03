/* eslint-disable no-console */
/**
 * Multi-turn regression tests for the Transact3 AI Agent conversation memory.
 *
 * Run with:  node test-ai-context.js
 *
 * These tests exercise the *production* resolution pipeline (resolveAgentTurn)
 * that the controller calls, using the deterministic fallback classifier so the
 * suite does not depend on network access or a Groq key. They also exercise the
 * existing FX forecasting engine and forecast-pair validation.
 */

process.env.GROQ_API_KEY = '';
process.env.EXCHANGE_RATE_API_KEY = '';
process.env.NODE_ENV = 'test';

const {
  resolveAgentTurn,
  buildActiveContext,
  validateForecastPair
} = require('./src/services/aiConversationContext');
const fxForecastingEngine = require('./src/services/fxForecastingEngine');
const fxRateEngine = require('./src/services/fxRateEngine');

const FINANCIAL_ACTIONS = new Set([
  'TRANSFER',
  'CONVERT',
  'FX_FORECAST',
  'FX_TIMING_ANALYSIS',
  'COMPETITOR_COMPARISON',
  'CLARIFY'
]);

let passed = 0;
let failed = 0;

const assert = (condition, name, detail) => {
  if (condition) {
    console.log(`✅ PASS: ${name}`);
    passed += 1;
  } else {
    console.error(`❌ FAIL: ${name}${detail ? ` -> ${detail}` : ''}`);
    failed += 1;
  }
};

/**
 * Simulates the running application: each turn is resolved, and the assistant
 * turn is appended to history exactly as the frontend does (parsed payload only
 * for financial operations, matching the controller's responses).
 */
const makeConversation = (conversationId) => {
  const history = [];
  const ask = async (prompt) => {
    const turn = await resolveAgentTurn({ prompt, history, conversationId });
    const effectiveActionType = turn.context.ambiguousPairs ? 'CLARIFY' : turn.actionType;

    const storedParsed = FINANCIAL_ACTIONS.has(effectiveActionType) && turn.parsed
      ? JSON.parse(JSON.stringify(turn.parsed))
      : undefined;

    history.push({ role: 'user', content: prompt });
    history.push({
      role: 'assistant',
      content: `[${effectiveActionType}]`,
      parsed: storedParsed,
      actionType: effectiveActionType
    });

    return { ...turn, effectiveActionType };
  };
  return { history, ask };
};

const pairOf = (turn) => `${turn.parsed.sourceCurrency}/${turn.parsed.destinationCurrency}`;

async function run() {
  console.log('============================================================');
  console.log('🤖 TRANSACT3 AI AGENT — CONVERSATION CONTEXT REGRESSION SUITE');
  console.log('============================================================\n');

  // -- A: conversion followed by forecast (USD/INR) ------------------------
  {
    const c = makeConversation('test-a');
    const t1 = await c.ask('How much is 100 USD to INR?');
    assert(t1.effectiveActionType === 'CONVERT', 'A1 USD conversion routes to CONVERT', t1.effectiveActionType);
    assert(pairOf(t1) === 'USD/INR', 'A1 USD/INR pair is not reversed', pairOf(t1));
    assert(t1.parsed.amount === 100, 'A1 amount 100 retained', String(t1.parsed.amount));

    const t2 = await c.ask('Check its forecast.');
    assert(t2.effectiveActionType === 'FX_FORECAST', 'A2 follow-up changes intent to FX_FORECAST', t2.effectiveActionType);
    assert(pairOf(t2) === 'USD/INR', 'A2 forecast retains USD/INR', pairOf(t2));
    assert(t2.parsed.amount === 100, 'A2 amount 100 retained for scenarios', String(t2.parsed.amount));
    assert(t2.context.ambiguousPairs === false, 'A2 unambiguous reference is not questioned');
  }

  // -- B: SGD/INR conversion (no amount) followed by forecast --------------
  {
    const c = makeConversation('test-b');
    const t1 = await c.ask('How much is SGD to INR?');
    assert(t1.effectiveActionType === 'CONVERT', 'B1 SGD/INR routes to CONVERT', t1.effectiveActionType);
    assert(t1.parsed.sourceCurrency === 'SGD', 'B1 source is SGD (not reversed)', String(t1.parsed.sourceCurrency));
    assert(t1.parsed.destinationCurrency === 'INR', 'B1 destination is INR', String(t1.parsed.destinationCurrency));
    assert(t1.parsed.amount == null, 'B1 no amount is invented', String(t1.parsed.amount));

    const t2 = await c.ask('OK, check its forecast.');
    assert(t2.effectiveActionType === 'FX_FORECAST', 'B2 follow-up is FX_FORECAST', t2.effectiveActionType);
    assert(pairOf(t2) === 'SGD/INR', 'B2 forecast uses the MOST RECENT SGD/INR (no stale USD/INR)', pairOf(t2));

    const forecast = await fxForecastingEngine.predictFXMovements(t2.parsed.sourceCurrency, t2.parsed.destinationCurrency);
    const validation = validateForecastPair(forecast, 'SGD', 'INR');
    assert(validation.ok, 'B2 forecasting engine answers for SGD/INR', JSON.stringify(validation));
    assert(forecast.currencyPair === 'SGD/INR', 'B2 model output pair is SGD/INR', forecast.currencyPair);
  }

  // -- C: amount retained for scenario maths -------------------------------
  {
    const c = makeConversation('test-c');
    const t1 = await c.ask('How much is 100 SGD to INR?');
    assert(t1.parsed.amount === 100 && pairOf(t1) === 'SGD/INR', 'C1 100 SGD/INR parsed', `${t1.parsed.amount} ${pairOf(t1)}`);

    const t2 = await c.ask('What about its forecast?');
    assert(t2.effectiveActionType === 'FX_FORECAST', 'C2 forecast intent', t2.effectiveActionType);
    assert(pairOf(t2) === 'SGD/INR', 'C2 pair retained', pairOf(t2));
    assert(t2.parsed.amount === 100, 'C2 amount retained for scenario calculations', String(t2.parsed.amount));
  }

  // -- D: EUR/INR conversion followed by forecast --------------------------
  {
    const c = makeConversation('test-d');
    await c.ask('How much is 100 EUR to INR?');
    const t2 = await c.ask('Check its forecast.');
    assert(pairOf(t2) === 'EUR/INR', 'D1 EUR/INR forecast (no stale pair)', pairOf(t2));
  }

  // -- E: explicit override replaces the pair ------------------------------
  {
    const c = makeConversation('test-e');
    await c.ask('How much is SGD to INR?');
    const t2 = await c.ask('Actually, check USD to INR instead.');
    assert(pairOf(t2) === 'USD/INR', 'E1 explicit replacement wins over older SGD/INR', pairOf(t2));
  }

  // -- F: latest explicit pair wins ----------------------------------------
  {
    const c = makeConversation('test-f');
    await c.ask('How much is USD to INR?');
    const t2 = await c.ask('How much is SGD to INR?');
    assert(pairOf(t2) === 'SGD/INR', 'F1 newer explicit pair replaces older', pairOf(t2));
    const t3 = await c.ask('Check its forecast.');
    assert(pairOf(t3) === 'SGD/INR', 'F2 follow-up resolves to the latest operation', pairOf(t3));
  }

  // -- G: new conversation has no context ----------------------------------
  {
    const c = makeConversation('test-g');
    const t1 = await c.ask('Check its forecast.');
    assert(t1.effectiveActionType === 'FX_FORECAST', 'G1 bare forecast classified as FX_FORECAST', t1.effectiveActionType);
    assert(t1.parsed.sourceCurrency == null && t1.parsed.destinationCurrency == null,
      'G2 no pair is reused from an older conversation', pairOf(t1));
  }

  // -- H: general question does not erase financial context ----------------
  {
    const c = makeConversation('test-h');
    await c.ask('Convert 100 USD to INR.');
    const t2 = await c.ask("What's the capital of France?");
    assert(t2.effectiveActionType === 'GENERAL_KNOWLEDGE', 'H1 general question routed away from finances', t2.effectiveActionType);
    const t3 = await c.ask('Check its forecast.');
    assert(pairOf(t3) === 'USD/INR', 'H2 financial context survives an unrelated question', pairOf(t3));
  }

  // -- I: amount correction ------------------------------------------------
  {
    const c = makeConversation('test-i');
    await c.ask('Convert 100 USD to INR.');
    const t2 = await c.ask('Make it 500.');
    assert(t2.parsed.amount === 500, 'I1 amount updated to 500', String(t2.parsed.amount));
    assert(pairOf(t2) === 'USD/INR', 'I2 pair unchanged after amount correction', pairOf(t2));
    assert(t2.effectiveActionType === 'CONVERT', 'I3 intent resumes CURRENCY_CONVERSION', t2.effectiveActionType);
  }

  // -- J: destination correction -------------------------------------------
  {
    const c = makeConversation('test-j');
    await c.ask('Convert 100 USD to INR.');
    const t2 = await c.ask('Change destination to EUR.');
    assert(t2.parsed.destinationCurrency === 'EUR', 'J1 destination updated to EUR', String(t2.parsed.destinationCurrency));
    assert(t2.parsed.sourceCurrency === 'USD', 'J2 source retained as USD', String(t2.parsed.sourceCurrency));
    assert(t2.effectiveActionType === 'CONVERT', 'J3 correction resumes the previous operation, not a transfer', t2.effectiveActionType);
  }

  // -- K: forecast followed by timing question -----------------------------
  {
    const c = makeConversation('test-k');
    const t1 = await c.ask('Check the USD/INR forecast.');
    assert(t1.effectiveActionType === 'FX_FORECAST', 'K1 forecast recognised', t1.effectiveActionType);
    const t2 = await c.ask('Should I wait?');
    assert(t2.effectiveActionType === 'FX_TIMING_ANALYSIS', 'K2 timing intent', t2.effectiveActionType);
    assert(pairOf(t2) === 'USD/INR', 'K3 pair retained for timing analysis', pairOf(t2));
  }

  // -- L: ambiguous multi-pair reference -----------------------------------
  {
    const c = makeConversation('test-l');
    await c.ask('Compare USD/INR and EUR/INR.');
    const t2 = await c.ask('Check its forecast.');
    assert(t2.effectiveActionType === 'CLARIFY', 'L1 ambiguous reference asks for clarification', t2.effectiveActionType);
    assert((t2.context.ambiguousOptions || []).length >= 2, 'L2 both candidate pairs offered');
  }

  // -- M: conversion direction / inverse handling --------------------------
  {
    const sgdInr = await fxRateEngine.getIndicativeConversion('SGD', 'INR');
    const inrSgd = await fxRateEngine.getIndicativeConversion('INR', 'SGD');
    assert(sgdInr && sgdInr.rate > 10, 'M1 SGD->INR is INR-per-SGD (not inverted)', sgdInr && String(sgdInr.rate));
    assert(inrSgd && inrSgd.rate < 0.1, 'M2 INR->SGD is SGD-per-INR (not inverted)', inrSgd && String(inrSgd.rate));
    assert(Math.abs((100 * sgdInr.rate) - (100 / inrSgd.rate)) / (100 * sgdInr.rate) < 0.01,
      'M3 inverse quote is mathematically consistent (within provider rounding)', `${100 * sgdInr.rate} vs ${100 / inrSgd.rate}`);

    const usdInr100 = 100 * (await fxRateEngine.getIndicativeConversion('USD', 'INR')).rate;
    assert(usdInr100 > 1000, 'M4 100 USD converts to thousands of INR, not ~1 SGD', String(usdInr100));
  }

  // -- N: forecast response validation ------------------------------------
  {
    const sgdForecast = await fxForecastingEngine.predictFXMovements('SGD', 'INR');
    const mismatch = validateForecastPair(
      { ...sgdForecast, sourceCurrency: 'USD', destinationCurrency: 'INR' },
      'SGD',
      'INR'
    );
    assert(mismatch.ok === false && mismatch.reason === 'FORECAST_PAIR_MISMATCH',
      'N1 stale USD/INR forecast rejected for SGD/INR request', JSON.stringify(mismatch));

    const unsupported = validateForecastPair(sgdForecast, 'CHF', 'INR');
    assert(unsupported.ok === false && unsupported.reason === 'UNSUPPORTED_PAIR',
      'N2 unsupported pair is refused instead of substituted', JSON.stringify(unsupported));

    const ok = validateForecastPair(sgdForecast, 'SGD', 'INR');
    assert(ok.ok === true, 'N3 matching forecast accepted', JSON.stringify(ok));
  }

  // -- O: USD/INR forecasting still works ---------------------------------
  {
    const forecast = await fxForecastingEngine.predictFXMovements('USD', 'INR');
    assert(forecast.currencyPair === 'USD/INR' && forecast.currentRate > 0,
      'O1 existing USD/INR forecasting unchanged', `${forecast.currencyPair} @ ${forecast.currentRate}`);
    assert(forecast.predictions && forecast.predictions.h6 > 0 && forecast.predictions.h48 > 0,
      'O2 all model horizons present');
  }

  // -- P: context versioning ----------------------------------------------
  {
    const c = makeConversation('test-p');
    const t1 = await c.ask('How much is 100 USD to INR?');
    const t2 = await c.ask('Check its forecast.');
    assert(t2.parsed.contextVersion > t1.parsed.contextVersion,
      'P1 context version increases with each financial operation',
      `${t1.parsed.contextVersion} -> ${t2.parsed.contextVersion}`);

    const ctx = buildActiveContext({ history: c.history, prompt: 'Reset the context.' });
    assert(ctx.reset === true && ctx.active === null, 'P2 reset message clears active context');
  }

  console.log('\n============================================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('============================================================\n');
  if (failed > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error('Test suite crashed:', error);
  process.exitCode = 1;
});
