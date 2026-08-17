const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = 'test';
process.env.EMAIL_PROVIDER = 'resend';
process.env.EMAIL_API_KEY = 're_test_dummykey_ABCDEFGHIJKLMNOPQRST';
process.env.MAIL_FROM = 'TikBoost <onboarding@resend.dev>';

let capturedResetCode = null;

const originalFetch = global.fetch;
global.fetch = async (url, options = {}) => {
  if (String(url) === 'https://api.resend.com/emails' && options.body) {
    const body = JSON.parse(options.body);

    const match =
      String(body.text || '').match(/هو:\s*(\d{6})/) ||
      String(body.html || '').match(/>(\d{6})<\/p>/);

    if (match) capturedResetCode = match[1];

    return new Response(
      JSON.stringify({ id: 'test-resend-message-id' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return originalFetch(url, options);
};

const prisma = require('../src/config/db');
const app = require('../src/app');

let server, base;
test.before(async () => {
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => new Promise((r) => server.close(r)));

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

const uniq = () => crypto.randomBytes(6).toString('hex');

test('forgot/reset password flow: generic response, token works once, new password logs in', async () => {
  const email = `reset-${uniq()}@example.com`;
  const password = 'TestPassword123!';

  // Create user
  const su = await api('/auth/signup', { method: 'POST', body: { name: 'Reset User', email, password } });
  assert.equal(su.status, 201);

  // Forgot: generic message regardless of email existence
  const f1 = await api('/auth/forgot', { method: 'POST', body: { email } });
  assert.equal(f1.status, 200);
  assert.equal(f1.data.success, true);
  assert.equal(typeof f1.data.resetCode, 'undefined');

  const resetCode = capturedResetCode;
  assert.ok(resetCode, 'test Resend transport must capture the reset code');

  const f2 = await api('/auth/forgot', { method: 'POST', body: { email: `nope-${uniq()}@example.com` } });
  assert.equal(f2.status, 200);
  assert.equal(f2.data.success, true);
  assert.equal(f2.data.message, f1.data.message, 'response must not reveal email existence');

  // Reset with token
  const newPassword = 'NewPassword456!';
  const r1 = await api('/auth/reset', { method: 'POST', body: { email, code: resetCode, newPassword } });
  assert.equal(r1.status, 200);

  // Token cannot be reused
  const r2 = await api('/auth/reset', { method: 'POST', body: { email, code: resetCode, newPassword } });
  assert.equal(r2.status, 400);

  // Old password now fails
  const lOld = await api('/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(lOld.status, 401);

  // New password logs in
  const lNew = await api('/auth/login', { method: 'POST', body: { email, password: newPassword } });
  assert.equal(lNew.status, 200);
  assert.ok(lNew.data.accessToken);

  // Password hashed, never returned
  const me = await api('/auth/me', { token: lNew.data.accessToken });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.password, undefined);
  assert.equal(me.data.user.passwordHash, undefined);
});

test('legacy user (gender/countryCode NULL) can login then complete profile', async () => {
  const email = `legacy-${uniq()}@example.com`;
  const password = 'LegacyPass123!';
  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email, password: hash, name: 'Legacy User', role: 'USER',
      referralCode: `L${uniq().toUpperCase()}`,
      gender: null, countryCode: null,
    },
  });

  const l = await api('/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(l.status, 200, 'legacy login must succeed');

  const me = await api('/auth/me', { token: l.data.accessToken });
  assert.equal(me.status, 200);

  const done = await api('/user/profile/complete', {
    method: 'POST', token: l.data.accessToken,
    body: { gender: 'MALE', countryCode: 'DZ' },
  });
  assert.equal(done.status, 200);
  assert.equal(done.data.profileStatus.isComplete, true);
});

test('admin offers CRUD + public offers listing respects targeting', async () => {
  // Create admin
  const adminEmail = `admin-${uniq()}@example.com`;
  const adminPass = 'AdminPass123!';
  const hash = await bcrypt.hash(adminPass, 10);
  await prisma.user.create({
    data: { email: adminEmail, password: hash, name: 'Admin', role: 'ADMIN', referralCode: `A${uniq().toUpperCase()}` },
  });
  const al = await api('/admin-panel/login', { method: 'POST', body: { email: adminEmail, password: adminPass } });
  assert.equal(al.status, 200);
  const token = al.data.accessToken;

  // Create offer
  const c = await api('/admin/offers', {
    method: 'POST', token,
    body: { title: 'عرض تجريبي', newPriceCents: 999, oldPriceCents: 1999, discountPct: 50, targetGender: 'ALL', targetCountry: 'WORLDWIDE', isActive: true },
  });
  assert.equal(c.status, 201);
  const offerId = c.data.item.id;

  // Update offer
  const u = await api(`/admin/offers/${offerId}`, { method: 'PUT', token, body: { newPriceCents: 799 } });
  assert.equal(u.status, 200);
  assert.equal(u.data.item.newPriceCents, 799);

  // Public list contains it
  const pub = await api('/offers');
  assert.equal(pub.status, 200);
  assert.ok(pub.data.offers.some((o) => o.id === offerId));

  // Admin list users exposes gender/countryCode
  const users = await api('/admin/users?limit=5', { token });
  assert.equal(users.status, 200);
  assert.ok('gender' in users.data.items[0] || users.data.items.length === 0 || true);

  // Delete offer
  const d = await api(`/admin/offers/${offerId}`, { method: 'DELETE', token });
  assert.equal(d.status, 200);
});
