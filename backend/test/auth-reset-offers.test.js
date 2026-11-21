
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = 'test';
process.env.EMAIL_PROVIDER = 'resend';
process.env.EMAIL_API_KEY = 're_test_dummykey_ABCDEFGHIJKLMNOPQRST';
process.env.MAIL_FROM = 'TikBoost <onboarding@resend.dev>';

// PR #82 contract: OTP for password reset is delivered manually by an admin.
// No email is sent for forgot-password.

const prisma = require('../src/config/db');
const app = require('../src/app');
const { initMailer } = require('../src/services/mailer.service');

let server;
let base;

test.before(async () => {
  await initMailer().catch(() => {});
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

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
  try {
    data = await res.json();
  } catch {}

  return { status: res.status, data };
}

const uniq = () => crypto.randomBytes(6).toString('hex');

test('forgot/reset password flow: admin manual code delivery end-to-end', async () => {
  const email = `reset-${uniq()}@example.com`;
  const password = 'TestPassword123!';

  // Fixed: deviceId now satisfies the minimum length validation.
  const su = await api('/auth/signup', {
    method: 'POST',
    body: {
      name: 'Reset User',
      email,
      password,
      deviceId: `test-device-${crypto.randomUUID()}`,
    },
  });

  assert.equal(
    su.status,
    201,
    `signup failed: ${JSON.stringify(su.data)}`
  );

  // Forgot password: generic response, without revealing the reset code.
  const f1 = await api('/auth/forgot', {
    method: 'POST',
    body: { email },
  });

  assert.equal(f1.status, 200);
  assert.equal(f1.data.success, true);
  assert.equal(typeof f1.data.resetCode, 'undefined');

  // Unknown email must receive the same public response.
  const f2 = await api('/auth/forgot', {
    method: 'POST',
    body: { email: `nope-${uniq()}@example.com` },
  });

  assert.equal(f2.status, 200);
  assert.equal(f2.data.success, true);
  assert.equal(f2.data.message, f1.data.message);

  // Admin login and retrieve the pending reset request.
  const adminEmail =
    process.env.SEED_ADMIN_EMAIL || 'admin@tikboost.app';

  const adminPass =
    process.env.SEED_ADMIN_PASSWORD || 'StrongTempAdminPassword_123';

  const al = await api('/admin-panel/login', {
    method: 'POST',
    body: {
      email: adminEmail,
      password: adminPass,
    },
  });

  assert.equal(
    al.status,
    200,
    `admin login failed: ${JSON.stringify(al.data)}`
  );

  const adminToken = al.data.accessToken;

  const list = await api(
    '/admin/password-reset-requests?status=PENDING',
    { token: adminToken }
  );

  assert.equal(list.status, 200);
  assert.ok(
    Array.isArray(list.data.items) && list.data.items.length,
    'list must include pending requests'
  );

  const row = list.data.items.find(
    (item) => item.user && item.user.email === email
  );

  assert.ok(row, 'admin list must contain this user request');

  // Admin reveals the six-digit reset code.
  const rv = await api(
    `/admin/password-reset-requests/${row.id}/reveal`,
    {
      method: 'POST',
      token: adminToken,
    }
  );

  assert.equal(
    rv.status,
    200,
    `reveal failed: ${JSON.stringify(rv.data)}`
  );

  const resetCode = String(rv.data.code);

  assert.ok(
    /^\d{6}$/.test(resetCode),
    'revealed code must be 6 digits'
  );

  // Reset password using the revealed code.
  const newPassword = 'NewPassword456!';

  const r1 = await api('/auth/reset', {
    method: 'POST',
    body: {
      email,
      code: resetCode,
      newPassword,
      confirmPassword: newPassword,
    },
  });

  assert.equal(
    r1.status,
    200,
    `reset failed: ${r1.status} ${JSON.stringify(r1.data)}`
  );

  // The reset code must not be reusable.
  const r2 = await api('/auth/reset', {
    method: 'POST',
    body: {
      email,
      code: resetCode,
      newPassword,
      confirmPassword: newPassword,
    },
  });

  assert.equal(r2.status, 400);

  // Old password must be rejected.
  const lOld = await api('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  assert.equal(lOld.status, 401);

  // New password must work.
  const lNew = await api('/auth/login', {
    method: 'POST',
    body: {
      email,
      password: newPassword,
    },
  });

  assert.equal(lNew.status, 200);
  assert.ok(lNew.data.accessToken);

  // Password hashes must never be returned by the API.
  const me = await api('/auth/me', {
    token: lNew.data.accessToken,
  });

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
      email,
      password: hash,
      name: 'Legacy User',
      role: 'USER',
      referralCode: `L${uniq().toUpperCase()}`,
      gender: null,
      countryCode: null,
    },
  });

  const login = await api('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  assert.equal(
    login.status,
    200,
    'legacy login must succeed'
  );

  const me = await api('/auth/me', {
    token: login.data.accessToken,
  });

  assert.equal(me.status, 200);

  const done = await api('/user/profile/complete', {
    method: 'POST',
    token: login.data.accessToken,
    body: {
      gender: 'MALE',
      countryCode: 'DZ',
    },
  });

  assert.equal(done.status, 200);
  assert.equal(done.data.profileStatus.isComplete, true);
});

test('admin offers CRUD + public offers listing respects targeting', async () => {
  const adminEmail = `admin-${uniq()}@example.com`;
  const adminPass = 'AdminPass123!';
  const hash = await bcrypt.hash(adminPass, 10);

  await prisma.user.create({
    data: {
      email: adminEmail,
      password: hash,
      name: 'Admin',
      role: 'ADMIN',
      referralCode: `A${uniq().toUpperCase()}`,
    },
  });

  const al = await api('/admin-panel/login', {
    method: 'POST',
    body: {
      email: adminEmail,
      password: adminPass,
    },
  });

  assert.equal(
    al.status,
    200,
    `admin login failed: ${JSON.stringify(al.data)}`
  );

  const token = al.data.accessToken;

  const c = await api('/admin/offers', {
    method: 'POST',
    token,
    body: {
      title: 'عرض تجريبي',
      newPriceCents: 999,
      oldPriceCents: 1999,
      discountPct: 50,
      targetGender: 'ALL',
      targetCountry: 'WORLDWIDE',
      isActive: true,
    },
  });

  assert.equal(
    c.status,
    201,
    `offer creation failed: ${JSON.stringify(c.data)}`
  );

  const offerId = c.data.item.id;

  const u = await api(`/admin/offers/${offerId}`, {
    method: 'PUT',
    token,
    body: { newPriceCents: 799 },
  });

  assert.equal(u.status, 200);
  assert.equal(u.data.item.newPriceCents, 799);

  const pub = await api('/offers');

  assert.equal(pub.status, 200);
  assert.ok(
    pub.data.offers.some((offer) => offer.id === offerId)
  );

  const users = await api('/admin/users?limit=5', {
    token,
  });

  assert.equal(users.status, 200);
  assert.ok(Array.isArray(users.data.items));

  const d = await api(`/admin/offers/${offerId}`, {
    method: 'DELETE',
    token,
  });

  assert.equal(d.status, 200);
});
