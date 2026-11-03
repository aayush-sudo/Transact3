/* eslint-disable no-console */
/**
 * Live multi-turn verification against a RUNNING Transact3 backend.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:5055 AI_TOKEN=<jwt> node test-ai-context-live.js
 *
 * It replays the exact follow-up conversations from the bug report and checks
 * the response pair/action, proving the running app no longer reverses pairs or
 * reuses a stale pair. No transaction is created and no scheduling modal is
 * involved.
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5055';
const TOKEN = process.env.AI_TOKEN;

if (!TOKEN) {
  console.error('AI_TOKEN is required');
  process.exit(1);
}

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

const post = async (prompt, history, conversationId) => {
  const res = await fetch(`${BASE_URL}/api/orchestration/ai-query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`
    },
    body: JSON.stringify({ prompt, history, conversationId })
  });
  const data = await res.json();
  return { status: res.status, data };
};

const makeConversation = (conversationId) => {
  const history = [];
  const ask = async (prompt) => {
    const { status, data } = await post(prompt, history, conversationId);
    history.push({ role: 'user', content: prompt });
    history.push({
      role: 'assistant',
      content: data.assistantMessage || data.clarificationMessage || '',
      parsed: data.parsed,
      actionType: data.actionType || null
    });
    return { status, data };
  };
  return { history, ask };
};

const pairOf = (data) => `${data.parsed?.sourceCurrency}/${data.parsed?.destinationCurrency}`;

async function run() {
  console.log('============================================================');
  console.log('🌐 LIVE AI AGENT MULTI-TURN VERIFICATION');
  console.log(`Target: ${BASE_URL}`);
  console.log('============================================================\n');

  // 1. SGD -> INR, then forecast
  {
    const c = makeConversation(`live-sgd-${Date.now()}`);
    const t1 = await c.ask('How much is SGD to INR?');
    assert(t1.status === 200, '1.1 conversion request succeeds', String(t1.status));
    assert(t1.data.actionType === 'CONVERT', '1.2 SGD/INR is CONVERT (not TRANSFER)', t1.data.actionType);
    assert(pairOf(t1.data) === 'SGD/INR', '1.3 conversion direction is SGD -> INR', pairOf(t1.data));
    assert(t1.data.parsed?.amount == null, '1.4 no amount is invented', String(t1.data.parsed?.amount));
    assert(/1 SGD = [\d.]+ INR/.test(t1.data.assistantMessage || ''), '1.5 reply quotes SGD -> INR', t1.data.assistantMessage);

    const t2 = await c.ask('OK, check its forecast.');
    assert(t2.data.actionType === 'FX_FORECAST', '1.6 follow-up is FX_FORECAST', t2.data.actionType);
    assert(pairOf(t2.data) === 'SGD/INR', '1.7 forecast uses most recent SGD/INR (no stale USD/INR)', pairOf(t2.data));
    assert(/FX Forecast for SGD → INR/.test(t2.data.assistantMessage || ''), '1.8 forecast text names SGD -> INR', t2.data.assistantMessage);
    assert(t2.data.data && t2.data.data.currencyPair === 'SGD/INR', '1.9 model output is SGD/INR', t2.data.data?.currencyPair);
  }

  // 2. USD -> INR, then forecast
  {
    const c = makeConversation(`live-usd-${Date.now()}`);
    const t1 = await c.ask('How much is 100 USD to INR?');
    assert(pairOf(t1.data) === 'USD/INR', '2.1 USD -> INR conversion', pairOf(t1.data));
    assert(/100 USD = ₹[\d,]+\.\d{2} INR/.test(t1.data.assistantMessage || ''), '2.2 conversion shows 100 USD in INR', t1.data.assistantMessage);

    const t2 = await c.ask('Check its forecast.');
    assert(pairOf(t2.data) === 'USD/INR', '2.3 USD/INR forecast retained', pairOf(t2.data));
    assert(t2.data.data?.currencyPair === 'USD/INR', '2.4 model output USD/INR', t2.data.data?.currencyPair);
  }

  // 3. EUR -> INR, then forecast
  {
    const c = makeConversation(`live-eur-${Date.now()}`);
    await c.ask('How much is 100 EUR to INR?');
    const t2 = await c.ask('Check its forecast.');
    assert(pairOf(t2.data) === 'EUR/INR', '3.1 EUR/INR forecast (no USD/INR substitution)', pairOf(t2.data));
  }

  // 4. Latest explicit pair wins
  {
    const c = makeConversation(`live-latest-${Date.now()}`);
    await c.ask('How much is USD to INR?');
    const t2 = await c.ask('How much is SGD to INR?');
    assert(pairOf(t2.data) === 'SGD/INR', '4.1 newer explicit pair overrides older', pairOf(t2.data));
    const t3 = await c.ask('Check its forecast.');
    assert(pairOf(t3.data) === 'SGD/INR', '4.2 follow-up uses the latest operation', pairOf(t3.data));
  }

  // 5. Fresh conversation has no pair
  {
    const c = makeConversation(`live-fresh-${Date.now()}`);
    const t1 = await c.ask('Check its forecast.');
    assert(t1.data.requiresClarification === true || !t1.data.parsed?.sourceCurrency,
      '5.1 fresh conversation asks for a pair instead of reusing one',
      JSON.stringify({ action: t1.data.actionType, pair: pairOf(t1.data), clarification: t1.data.clarificationMessage }));
  }

  // 6. Corrections
  {
    const c = makeConversation(`live-correct-${Date.now()}`);
    await c.ask('Convert 100 USD to INR.');
    const t2 = await c.ask('Make it 500.');
    assert(t2.data.parsed?.amount === 500, '6.1 amount corrected to 500', String(t2.data.parsed?.amount));
    assert(pairOf(t2.data) === 'USD/INR', '6.2 pair unchanged after amount correction', pairOf(t2.data));
    assert(t2.data.actionType === 'CONVERT', '6.3 amount correction resumes conversion (no transfer)', t2.data.actionType);

    const t3 = await c.ask('Change destination to EUR.');
    assert(t3.data.parsed?.destinationCurrency === 'EUR', '6.4 destination corrected to EUR', String(t3.data.parsed?.destinationCurrency));
    assert(t3.data.parsed?.sourceCurrency === 'USD', '6.5 source retained as USD', String(t3.data.parsed?.sourceCurrency));
    assert(t3.data.actionType === 'CONVERT', '6.6 destination correction resumes conversion (no transfer)', t3.data.actionType);
    assert(!t3.data.routeAnalysis, '6.7 correction did not build a transfer route');
  }

  // 7. General question between financial turns
  {
    const c = makeConversation(`live-general-${Date.now()}`);
    await c.ask('Convert 100 USD to INR.');
    const t2 = await c.ask("What's the capital of France?");
    assert(t2.data.actionType === 'GENERAL_KNOWLEDGE', '7.1 general question answered as general knowledge', t2.data.actionType);
    const t3 = await c.ask('Check its forecast.');
    assert(pairOf(t3.data) === 'USD/INR', '7.2 financial context survives the general question', pairOf(t3.data));
  }

  // 8. Ambiguous multi-pair reference
  {
    const c = makeConversation(`live-ambiguous-${Date.now()}`);
    await c.ask('Compare USD/INR and EUR/INR.');
    const t2 = await c.ask('Check its forecast.');
    const asked = t2.data.requiresClarification === true
      || (t2.data.clarificationMessage || '').toLowerCase().includes('which currency pair');
    assert(asked, '8.1 ambiguous reference asks which pair', JSON.stringify({
      action: t2.data.actionType,
      clarification: t2.data.clarificationMessage
    }));
  }

  // 9. No financial side effects for conversion / forecast queries
  {
    const historyBefore = await fetch(`${BASE_URL}/api/transaction/history`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    }).then((res) => res.json());
    const countBefore = historyBefore.count || 0;

    const c = makeConversation(`live-sideeffects-${Date.now()}`);
    const t1 = await c.ask('How much is 100 EUR in INR?');
    const t2 = await c.ask('Should I convert 100 USD to INR now or wait?');
    for (const [label, turn] of [['9.1 conversion', t1], ['9.2 timing', t2]]) {
      const payload = JSON.stringify(turn.data);
      assert(!turn.data.routeAnalysis && !/OPEN_SCHEDULING_MODAL|REQUEST_TRANSFER_CONFIRMATION/.test(payload),
        `${label} has no transfer/scheduling side effects`, turn.data.actionType);
      assert(turn.data.actionType === 'CONVERT' || turn.data.actionType === 'FX_TIMING_ANALYSIS',
        `${label} uses a display-only action`, turn.data.actionType);
    }

    const historyAfter = await fetch(`${BASE_URL}/api/transaction/history`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    }).then((res) => res.json());
    assert((historyAfter.count || 0) === countBefore,
      '9.3 no transaction was created by conversion or forecast queries',
      `${countBefore} -> ${historyAfter.count}`);
  }

  console.log('\n============================================================');
  console.log(`LIVE RESULTS: ${passed} passed, ${failed} failed`);
  console.log('============================================================\n');
  if (failed > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error('Live suite crashed:', error);
  process.exitCode = 1;
});
