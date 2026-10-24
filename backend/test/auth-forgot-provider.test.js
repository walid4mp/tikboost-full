const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const bcrypt = require('bcrypt');

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

// Mirrors the PR #82 contract: forgot-password is admin-manual only,
// no email is sent; the value is exposed through the admin reveal endpoint.
test('forgot password: creates admin-reviewable reset request (no email sent)', async (t) => {
  // Make sure modules used below are fresh after env tweaks.
  delete require.cache[require.resolve('../src/config/env')];
  delete require.cache[require.resolve('../src/services/mailer.service')];
  delete require.cache[require.resolve('../src/controllers/auth.controller')];
  delete require.cache[require.resolve('../src/routes/auth.routes')];
  delete require.cache[require.resolve('../src/middleware/authRateLimit')];
  delete require.cache[require.resolve('../src/app')];

  process.env.EMAIL_PROVIDER = 'resend';
  process.env.EMAIL_API_KEY = 're_test_provider_key';
  process.env.MAIL_FROM = 'TikBoost <onboarding@resend.dev>';
  process.env.NODE_ENV = 'test';

  const mailer = require('../src/services/mailer.service');
  await mailer.initMailer();
  assert.equal(mailer._internals.providerReady, true);

  const prisma = require('../src/config/db');
  const email = `manual-reset-${Date.now()}@example.com`;
  const password = 'ManualPass123!';
  await prisma.user.deleteMany({ where: { email } });
  await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 4),
      name: 'Manual Reset User',
      role: 'USER',
      referralCode: 'MANUALRESET',
    },
  });

  // Intercept any outbound network call. Any call against a transactional
  // email provider is rejected with a sentinel status — that is enough to
  // fail the test loudly if someone re-introduces email-delivery of OTPs.
  const emailProviderCalls = [];
  global.fetch = async (url, init) => {
    const s = String(url);
    if (s.includes('api.resend.com/emails') || s.includes('api.brevo.com') || s.includes('api.mailgun.net')) {
      emailProviderCalls.push({ url: s, init });
      return new Response('email MUST NOT be sent for forgot-password', { status: 599 });
    }
    return originalFetch(url, init);
  };
  t.after(() => { global.fetch = originalFetch; });

  const app = require('../src/app');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  // 1) forgot endpoint must succeed but not return or send the code.
  const forgot = await callApi(server, 'POST', '/api/auth/forgot', { email });
  assert.equal(forgot.status, 200, `forgot must succeed, got ${forgot.status} ${forgot.text}`);
  assert.equal(forgot.json.success, true);
  assert.equal(typeof forgot.json.resetCode, 'undefined', 'resetCode must not leak in response');

  // 2) No transactional email provider was called.
  assert.equal(
    emailProviderCalls.length, 0,
    'transactional email provider must NOT be invoked for forgot-password under admin-manual mode',
  );

  // 3) A PENDING PasswordResetToken row exists for this user with an encryptedCode.
  const token = await prisma.passwordResetToken.findFirst({
    where: { user: { email } },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(token, 'a PasswordResetToken row must be created');
  assert.equal(token.status, 'PENDING');
  assert.ok(token.encryptedCode, 'encryptedCode must be stored for admin reveal');
  assert.tokenHash = token.tokenHash; // not used, just referenced for clarity

  // 4) Admin login + reveal returns a 6-digit code.
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@tikboost.app';
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'StrongTempAdminPassword_123';
  const al = await callApi(server, 'POST', '/api/admin-panel/login', { email: adminEmail, password: adminPass });
  assert.equal(al.status, 200, 'admin panel login must succeed');
  const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${al.json.accessToken}` };

  const listRes = await originalFetch(`http://127.0.0.1:${server.address().port}/api/admin/password-reset-requests?status=PENDING`, { method: 'GET', headers: adminHeaders });
  const listJson = JSON.parse(await listRes.text());
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listJson.items) && listJson.items.length, 'admin list must hold pending requests');
  const row = listJson.items.find((r) => r.user && r.user.email === email);
  assert.ok(row, 'admin list must include this user request');

  const rvRes = await originalFetch(
    `http://127.0.0.1:${server.address().port}/api/admin/password-reset-requests/${row.id}/reveal`,
    { method: 'POST', headers: adminHeaders },
  );
  const rvJson = JSON.parse(await rvRes.text());
  assert.equal(rvRes.status, 200);
  assert.ok(typeof rvJson.code === 'string' && /^\d{6}$/.test(rvJson.code), 'reveal must return a 6-digit code');

  // 5) Reset password via the real flow.
  const newPassword = 'NewPassword456!';
  const r1 = await callApi(server, 'POST', '/api/auth/reset', { email, code: rvJson.code, newPassword, confirmPassword: newPassword });
  assert.equal(r1.status, 200, `reset must succeed, got ${r1.status} ${r1.text}`);

  // Old password rejected, new one accepted.
  const lOld = await callApi(server, 'POST', '/api/auth/login', { email, password });
  assert.equal(lOld.status, 401);
  const lNew = await callApi(server, 'POST', '/api/auth/login', { email, password: newPassword });
  assert.equal(lNew.status, 200);
  assert.ok(lNew.json.accessToken, 'login must return an access token');

  // 6) Rate limit: sixth call within the window is throttled.
  let last = null;
  for (let i = 0; i < 6; i++) {
    // eslint-disable-next-line no-await-in-loop
    last = await callApi(server, 'POST', '/api/auth/forgot', { email });
  }
  assert.equal(last.status, 429, 'sixth forgot within window must be rate-limited');
  assert.equal(last.json.code, 'RATE_LIMIT_FORGOT');

  await prisma.user.deleteMany({ where: { email } });
});
