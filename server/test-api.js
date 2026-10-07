const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const { after, before, test } = require('node:test');
const { MongoMemoryServer } = require('mongodb-memory-server');

const SERVER_DIRECTORY = __dirname;
const API_PATH = '/api';
const DEMO_PASSWORD = 'Password123!';

let mongoServer;
let serverProcess;
let baseUrl;
let serverOutput = '';

async function getAvailablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function request(path, { token, ...options } = {}) {
  const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${API_PATH}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return { response, body: await response.json() };
}

async function login(email) {
  const { response, body } = await request('/user/login', {
    method: 'POST',
    body: { email, password: DEMO_PASSWORD }
  });
  assert.equal(response.status, 200, body.message || `Could not log in ${email}`);
  return body.token;
}

async function startApi() {
  const port = await getAvailablePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverOutput = '';
  serverProcess = spawn(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIRECTORY,
    env: {
      ...process.env,
      MONGO_URI: mongoServer.getUri(),
      PORT: String(port),
      JWT_SECRET: 'transact3-api-test-secret',
      FASTAPI_URL: 'http://127.0.0.1:1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProcess.stdout.setEncoding('utf8');
  serverProcess.stderr.setEncoding('utf8');
  serverProcess.stdout.on('data', chunk => { serverOutput += chunk; });
  serverProcess.stderr.on('data', chunk => { serverOutput += chunk; });

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`API server exited during startup:\n${serverOutput}`);
    }
    try {
      const token = await login('alice@transact3.com');
      if (token) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`API server did not become ready:\n${serverOutput}`);
}

async function stopApi() {
  if (!serverProcess || serverProcess.exitCode !== null) return;
  const child = serverProcess;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 5000))
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
  serverProcess = null;
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await startApi();
});

after(async () => {
  await stopApi();
  if (mongoServer) await mongoServer.stop();
});

test('authenticated payment settles once to the quoted recipient and survives restart', async () => {
  const unauthenticated = await request('/user/recipients');
  assert.equal(unauthenticated.response.status, 401);

  const railsStatus = await request('/orchestration/rails');
  assert.equal(railsStatus.response.status, 200);
  assert.equal(railsStatus.body.data.length, 3);

  const aliceToken = await login('alice@transact3.com');
  const bobToken = await login('bob@transact3.com');
  const adminToken = await login('treasury@transact3.io');
  const deniedAdminAccess = await request('/admin/metrics', { token: aliceToken });
  assert.equal(deniedAdminAccess.response.status, 403);
  const allowedAdminAccess = await request('/admin/metrics', { token: adminToken });
  assert.equal(allowedAdminAccess.response.status, 200);
  const aliceBefore = await request('/portfolio', { token: aliceToken });
  const bobBefore = await request('/portfolio', { token: bobToken });
  assert.equal(aliceBefore.body.success, true);
  assert.equal(bobBefore.body.success, true);

  const quoteResult = await request('/transaction/quote', {
    method: 'POST',
    token: aliceToken,
    body: {
      sourceCurrency: 'USD',
      destinationCurrency: 'INR',
      amount: 100,
      paymentMode: 'SEND_AMOUNT',
      priority: 'BALANCED',
      receiverEmail: 'bob@transact3.com'
    }
  });
  assert.equal(quoteResult.response.status, 200, quoteResult.body.message);
  const quote = quoteResult.body.data.quote;
  const cardRail = quote.evaluatedRails.find(rail => rail.id === 'CARD_PAYOUT' && rail.is_eligible);
  assert.ok(cardRail, 'Card payout should be eligible for this test quote');

  const unauthorizedConfirmation = await request('/transaction/confirm', {
    method: 'POST',
    token: bobToken,
    body: { quoteId: quote.quoteId, selectedRail: cardRail.id, idempotencyKey: 'wrong-owner-key' }
  });
  assert.equal(unauthorizedConfirmation.response.status, 403);

  const paymentRequest = {
    quoteId: quote.quoteId,
    selectedRail: cardRail.id,
    idempotencyKey: `TEST-${quote.quoteId}`
  };
  const confirmation = await request('/transaction/confirm', {
    method: 'POST',
    token: aliceToken,
    body: paymentRequest
  });
  assert.equal(confirmation.response.status, 201, confirmation.body.message);
  assert.equal(String(confirmation.body.data.transaction.recipient), String(quote.recipientId));
  assert.equal(confirmation.body.data.transaction.receiverEmail, 'bob@transact3.com');

  const aliceAfter = await request('/portfolio', { token: aliceToken });
  const bobAfter = await request('/portfolio', { token: bobToken });
  const aliceUsdBefore = aliceBefore.body.data.holdings.find(holding => holding.currency === 'USD').amount;
  const aliceUsdAfter = aliceAfter.body.data.holdings.find(holding => holding.currency === 'USD').amount;
  const bobInrBefore = bobBefore.body.data.holdings.find(holding => holding.currency === 'INR').amount;
  const bobInrAfter = bobAfter.body.data.holdings.find(holding => holding.currency === 'INR').amount;
  assert.equal(Number((aliceUsdBefore - aliceUsdAfter).toFixed(2)), Number((quote.sourceAmount + confirmation.body.data.transaction.railFeeUSD).toFixed(2)));
  assert.ok(bobInrAfter > bobInrBefore, 'Bob should receive the destination-currency credit');

  const replay = await request('/transaction/confirm', {
    method: 'POST',
    token: aliceToken,
    body: paymentRequest
  });
  assert.equal(replay.response.status, 201);
  assert.equal(String(replay.body.data.transaction._id), String(confirmation.body.data.transaction._id));

  const conflictingReplay = await request('/transaction/confirm', {
    method: 'POST',
    token: aliceToken,
    body: { ...paymentRequest, selectedRail: 'SWIFT_CORRESPONDENT' }
  });
  assert.equal(conflictingReplay.response.status, 409);

  const feeBoundQuote = await request('/transaction/quote', {
    method: 'POST',
    token: aliceToken,
    body: {
      sourceCurrency: 'USD',
      destinationCurrency: 'INR',
      amount: Number((aliceUsdAfter - 2).toFixed(2)),
      paymentMode: 'SEND_AMOUNT',
      priority: 'BALANCED',
      receiverEmail: 'bob@transact3.com'
    }
  });
  assert.equal(feeBoundQuote.response.status, 200, feeBoundQuote.body.message);
  const feeQuote = feeBoundQuote.body.data.quote;
  const feeFailure = await request('/transaction/confirm', {
    method: 'POST',
    token: aliceToken,
    body: { quoteId: feeQuote.quoteId, selectedRail: 'CARD_PAYOUT', idempotencyKey: `FEE-${feeQuote.quoteId}` }
  });
  assert.equal(feeFailure.response.status, 400);
  assert.match(feeFailure.body.message, /Insufficient USD balance/);

  await stopApi();
  await startApi();
  const aliceAfterRestart = await login('alice@transact3.com');
  const persistedPortfolio = await request('/portfolio', { token: aliceAfterRestart });
  assert.equal(persistedPortfolio.response.status, 200);
  assert.equal(
    Number(persistedPortfolio.body.data.holdings.find(holding => holding.currency === 'USD').amount.toFixed(2)),
    Number(aliceUsdAfter.toFixed(2))
  );

  const postRestartQuote = await request('/transaction/quote', {
    method: 'POST',
    token: aliceAfterRestart,
    body: {
      sourceCurrency: 'USD',
      destinationCurrency: 'INR',
      amount: 1,
      paymentMode: 'SEND_AMOUNT',
      priority: 'BALANCED',
      receiverEmail: 'bob@transact3.com'
    }
  });
  assert.equal(postRestartQuote.response.status, 200, postRestartQuote.body.message);
  const postRestartPayment = await request('/transaction/confirm', {
    method: 'POST',
    token: aliceAfterRestart,
    body: {
      quoteId: postRestartQuote.body.data.quote.quoteId,
      selectedRail: 'INSTANT_PAYMENT_LINK',
      idempotencyKey: `RESTART-${postRestartQuote.body.data.quote.quoteId}`
    }
  });
  assert.equal(postRestartPayment.response.status, 201, postRestartPayment.body.message);

  const adminAfterRestart = await login('treasury@transact3.io');
  const audit = await request('/admin/verify-audit-chain', { token: adminAfterRestart });
  assert.equal(audit.response.status, 200);
  assert.equal(audit.body.data.chainStatus.isValid, true);

  const reconciliation = await request('/admin/reconcile-ledger', { token: adminAfterRestart });
  assert.equal(reconciliation.response.status, 200);
  assert.equal(reconciliation.body.data.reconciliation.isBalanced, true);
});