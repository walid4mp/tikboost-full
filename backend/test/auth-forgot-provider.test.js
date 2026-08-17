const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const originalFetch = global.fetch;

async function callApi(server, method, path, body) {
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}${path}`;
  const res = await originalFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { /* keep text */ }
  return { status: res.status, text, json };
}

test('forgot password: uses HTTPS provider (resend) end-to-end', async (t) => {
  process.env.EMAIL_PROVIDER = 'resend';
  process.env.EMAIL_API_KEY = 're_test_provider_key';
  process.env.MAIL_FROM = 'TikBoost <onboarding@resend.dev>';
  process.env.NODE_ENV = 'development';

  delete require.cache[require.resolve('../src/config/env')];
  delete require.cache[require.resolve('../src/services/mailer.service')];
  delete require.cache[require.resolve('../src/controllers/auth.controller')];
  delete require.cache[require.resolve('../src/routes/auth.routes')];
  delete require.cache[require.resolve('../src/middleware/authRateLimit')];
  delete require.cache[require.resolve('../src/app')];

  const mailer = require('../src/services/mailer.service');
  await mailer.initMailer();
  assert.equal(mailer._internals.providerReady, true);

  const prisma = require('../src/config/db');
  const bcrypt = require('bcrypt');
  const email = `provider-test-${Date.now()}@example.com`;
  const password = 'ProviderPass123!';
  await prisma.user.deleteMany({ where: { email } });
  await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 4),
      name: 'Provider Test',
      role: 'USER',
      referralCode: 'PROVIDERTEST',
    },
  });

  // Intercept fetch so we can prove the HTTPS provider was called with the
  // right shape without hitting the network.
  const providerCalls = [];
  global.fetch = async (url, init) => {
    providerCalls.push({ url: String(url), init });
    if (String(url).includes('api.resend.com/emails')) {
      return new Response(JSON.stringify({ id: 'msg_stub_123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Any accidental Gmail/SMTP call would fail the test.
    return new Response('unexpected', { status: 599 });
  };
  t.after(() => { global.fetch = originalFetch; });

  const app = require('../src/app');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const forgot = await callApi(server, 'POST', '/api/auth/forgot', { email });
  assert.equal(forgot.status, 200, `forgot must succeed, got ${forgot.status} ${forgot.text}`);
  assert.equal(forgot.json.success, true);

  const call = providerCalls.find((c) => c.url.includes('api.resend.com/emails'));
  assert.ok(call, 'Resend HTTPS endpoint must be called');
  assert.ok(String(call.init.headers.Authorization || '').startsWith('Bearer re_test_provider_key'), 'must send bearer token');
  const payload = JSON.parse(call.init.body);
  assert.equal(payload.to[0], email);
  assert.ok(payload.subject.includes('TikBoost'));
  // The raw OTP is not exposed by the endpoint in non-test envs; here we only
  // check the request payload contained SOME 6-digit code.
  assert.ok(/\b\d{6}\b/.test(payload.text || payload.html || ''), 'payload must contain a 6-digit OTP');

  // Rate limit sanity: fifth request within window still allowed, sixth blocked
  let last = null;
  for (let i = 0; i < 6; i++) {
    // eslint-disable-next-line no-await-in-loop
    last = await callApi(server, 'POST', '/api/auth/forgot', { email });
  }
  assert.equal(last.status, 429, 'sixth forgot within window must be rate-limited');
  assert.equal(last.json.code, 'RATE_LIMIT_FORGOT');

  await prisma.user.deleteMany({ where: { email } });
});
