# Transact3 AI Transfer Agent — Progress Report

## Current Git Branch
`AI_Agents` (all work below is uncommitted working-tree changes, as requested)

---

## Stage 9 — Critical fixes: reversed currency pairs & stale context (this session)

### Reported bugs
1. `"How much is SGD to INR?"` returned `"100 INR = 1.35 SGD"` (pair reversed, amount invented).
2. `"OK, check its forecast."` returned a **USD/INR** forecast from an older conversation instead of the immediately preceding **SGD/INR** request.

### Root causes (traced at runtime, not just in the prompt)
| # | Cause | Location |
|---|-------|----------|
| 1 | Currencies were collected with `currencyCodes.filter(code => prompt.includes(code))`, which returns them in **hardcoded array order** (`INR` is index 3, `SGD` index 6), not sentence order. `"SGD to INR"` therefore became base `INR`, target `SGD`. | old `aiQuery` CONVERT handler |
| 2 | The CONVERT handler defaulted `amount` to `100` when the user gave no amount. | old `aiQuery` CONVERT handler |
| 3 | The FX_FORECAST and FX_TIMING handlers **re-extracted currencies from the raw prompt** and fell back to `'USD'`/`'INR'` when none were present. `"check its forecast"` contains no codes → always USD/INR. The resolved `parsed` context was ignored. | old `aiQuery` FX handlers |
| 4 | The controller's merge **overwrote the new intent with the previous intent** whenever currencies were missing, so an intent change on the same entities (conversion → forecast) was impossible. | old merge block |
| 5 | Conversation state was reconstructed ad hoc from "the last assistant message with `parsed`", with no recency, versioning, pair validation or ambiguity handling. | old `getHistoryContext` + controller |
| 6 | Forecast output was never checked against the requested pair. | old FX handlers |
| 7 | `VALID_INTENTS` omitted `GENERAL_KNOWLEDGE`, `GENERAL_CONVERSATION`, `OUT_OF_SCOPE`, `TRANSACT3_PLATFORM_QUESTION`, `GENERAL_PLATFORM_QUESTION`, `UNSUPPORTED_OPERATION`, so a general question was downgraded to `UNKNOWN` and then absorbed the previous financial intent — a general question could return a conversion. | `aiAgentService.validateIntent` |
| 8 | The configured Groq model (`llama-3.3-70b-versatile`) has been retired by Groq (HTTP 404), so **every** request silently used keyword fallback. | `aiAgentService` / `.env` |

### The fix

**New module: `server/src/services/aiConversationContext.js`**
- `detectExplicitPairs()` — parses pairs in sentence order (`SGD to INR`, `SGD/INR`, `USD in INR`, `USD versus INR`); never uses a hardcoded currency list for ordering.
- `buildActiveContext()` — builds a **versioned active context** from the most recent *financial* operation (max 10 messages back). General chat is skipped, not treated as a topic change. Detects reset messages (`new transfer`, `reset context`, …) and multi-pair ambiguity.
- `mergeIntentWithContext()` — deterministic merge:
  - explicit pair in the newest message always wins;
  - unchanged fields are retained from the active context;
  - amount is only inherited for follow-ups/clarifications;
  - **the new intent is never replaced by the previous intent**, except for pure clarification replies or explicit edits (`make it 500`, `change destination to EUR`) which resume the previous operation;
  - returns an audit trail (`fieldsChanged`, `fieldsRetained`, `fieldsCleared`, `resolutionDecision`).
- `validateForecastPair()` / `describeForecastMismatch()` — rejects forecasts whose pair differs from the request, and refuses unsupported pairs instead of substituting another pair.
- `resolveAgentTurn()` — the exact pipeline the controller calls (context → intent → merge → operation), so tests exercise production logic.

**`server/src/services/aiAgentService.js`**
- `resolveCurrencies` now also recognises `"how many rupees will I get"` and `"… in <currency>"` role cues, and keeps sentence order.
- `detectFallbackIntent` reordered: timing → forecast/reference → correction → what-if → conversion → comparison → … → general knowledge → transfer. Conversion detection uses **currency mentions** (names + codes), not a fixed code list.
- Added `isCorrectionMessage` / `CORRECTION_PATTERN`.
- `getHistoryContext` only considers financial intents and enforces a 10-message recency window.
- `groundLlmIntent` only inherits the previous intent for `CLARIFICATION_RESPONSE`/`UNKNOWN`.
- `VALID_INTENTS` completed (fixes general-question contamination).
- Model default updated to `openai/gpt-oss-120b`, with a one-shot retry on HTTP 404 using `GROQ_FALLBACK_MODEL` / `openai/gpt-oss-20b`.

**`server/src/controllers/orchestrationController.js`**
- CONVERT, FX_FORECAST and FX_TIMING handlers now use the **resolved** `parsed.sourceCurrency` / `parsed.destinationCurrency`; there is no `USD/INR` default anywhere.
- CONVERT never invents an amount: with no amount it shows the live rate and asks for an amount.
- Conversion math: `amount × (destination per source)`. If only the inverse quote exists, it is inverted mathematically (`1 / inverse`) and the reply states this. Rate + timestamp are shown; fees are explicitly excluded.
- FX forecast output is validated before display; mismatches return an honest message instead of another pair's numbers.
- FX timing computes `now` vs `24h`/`48h` projections from the real model; a higher destination-per-source rate is always the favourable direction (previous code hardcoded USD→INR).
- Transfer routing is reachable **only** for transfer intents; conversion/forecast intents can never produce `routeAnalysis` or scheduling parameters.
- Every response now carries `conversationId` and `contextVersion`.
- Development trace (`AI_AGENT_DEBUG=true` or non-production) logs: conversation id, previous active context, message, classified intent, interpretation source, extracted entities, merged context, resolution decision, selected operation, tool input, forecast pair validation. No keys/tokens are logged.

**`server/src/services/fxRateEngine.js`**
- Added `getIndicativeConversion()` (additive; existing quote/footer logic untouched) returning the destination-per-source rate with inverse fallback and timestamp.

**Frontend**
- `client/src/pages/AIAgent.jsx`: stable `conversationId` per conversation (`crypto.randomUUID`), reset by **New Conversation**, persisted with the last 20 turns + messages in `sessionStorage` (survives refresh), homepage handoff starts a fresh conversation. Every turn — including clarification replies — is recorded. `currentParams` is cleared on conversion/forecast/comparison so a stale transfer cannot open the scheduling modal.
- `client/src/services/api.js`: `aiQuery(prompt, history, conversationId)`.

### Response actions
The backend returns explicit action types and the frontend switches on them:
`CONVERT` (display only), `FX_FORECAST`, `FX_TIMING_ANALYSIS`, `COMPETITOR_COMPARISON`, `TRANSFER` (only then can "Schedule Transfer" appear), `BALANCE`, `HISTORY`, `CLARIFY`, plus the non-financial ones. `currentParams` is only ever set for `TRANSFER`.

---

## Tests executed

### Automated (deterministic, no network)
`cd server && node test-ai-context.js` → **49/49 passed**
Covers: conversion → forecast (USD, SGD, EUR), amount retention, latest-pair-wins, explicit override, fresh conversation, general question between financial turns, amount/destination corrections, forecast → timing, multi-pair ambiguity, inverse-rate consistency, forecast pair validation (mismatch + unsupported + valid), USD/INR regression, context versioning/reset.

### Live against the running backend
`cd server && AI_TOKEN=<jwt> BASE_URL=http://127.0.0.1:5055 node test-ai-context-live.js` → **32/32 passed**
Same personas plus: no transaction is created (transaction history count unchanged), no `routeAnalysis` / scheduling payload is produced by conversion or timing queries.

### Existing suites
- `npm test` (test-api.js): **1/1 passed**
- `node test-comprehensive.js`: **22 passed, 2 failed** — both failures are in rail-policy selection (`Cheapest/Fastest policy picked… SWIFT`), unrelated to the AI agent and present without these changes (`orchestrationEngine` / `railPricingService` untouched).
- Frontend production build: **passed**
- Backend `node -c` syntax checks: **passed**

### Verified runtime behaviour
| User | Agent |
|------|-------|
| `How much is SGD to INR?` | `1 SGD = 64.8327 INR` + asks for an amount (no invented 100, no reversal) |
| `OK, check its forecast.` | `FX Forecast for SGD → INR`, model pair `SGD/INR` |
| `How much is 100 USD to INR?` | `100 USD = ₹9,493.40 INR` + rate + timestamp |
| `Check its forecast.` | `FX Forecast for USD → INR` |
| `How much is 100 EUR to INR?` → `Check its forecast.` | `EUR/INR` forecast |
| `How much is USD to INR?` → `How much is SGD to INR?` → `Check its forecast.` | `SGD/INR` forecast (latest operation) |
| Fresh conversation → `Check its forecast.` | asks which pair; no reuse |
| `Compare USD/INR and EUR/INR.` → `Check its forecast.` | asks "Which currency pair do you mean: USD/INR or EUR/INR?" |
| `Convert 100 USD to INR.` → `Make it 500.` | 500 USD/INR conversion, no transfer |
| `…` → `Change destination to EUR.` | USD→EUR conversion, no transfer |
| `Convert 100 USD to INR.` → `What's the capital of France?` → `Check its forecast.` | Paris, then USD/INR forecast |
| `Should I convert 100 USD to INR now or wait?` | timing analysis with real model projections |

---

## Files changed in this session
- `server/src/services/aiConversationContext.js` **(new)**
- `server/src/services/aiAgentService.js`
- `server/src/services/fxRateEngine.js` (additive helper)
- `server/src/controllers/orchestrationController.js`
- `client/src/pages/AIAgent.jsx`
- `client/src/services/api.js`
- `server/test-ai-context.js` **(new)**
- `server/test-ai-context-live.js` **(new)**
- `server/.env.example` (Groq model default)
- `server/.env` (local Groq model default — not committed)

## Notes / limitations
- Groq's free tier rate-limits quickly (HTTP 429). When that happens the deterministic classifier takes over (`interpretationSource: "FALLBACK"`) and produces the same routing; the trace logs expose this explicitly rather than pretending the LLM answered.
- `"Use GBP instead."` (a bare single-currency replacement) is resolved to the **source** side, matching the common phrasing; ambiguous multi-pair references do ask for clarification.
- No conversation documents are stored in MongoDB — the structured context travels with the authenticated request (`conversationId` + bounded history) and is persisted client-side in `sessionStorage`. This keeps user isolation inherent (a request can only carry its own history) and avoids adding a schema.
