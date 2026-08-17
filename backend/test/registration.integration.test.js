const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const http = require('node:http');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
let server;
let baseUrl;

async function api(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { response, body };
}

async function registerUser(prefix, overrides = {}) {
  const password = overrides.password || 'TestPassword123!';
  const email = overrides.email || `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.com`;
  const payload = {
    name: overrides.name || prefix,
    email,
    password,
    ...(overrides.referralCode ? { referralCode: overrides.referralCode } : {}),
    ...(overrides.deviceId ? { deviceId: overrides.deviceId } : {}),
  };

  const result = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return { ...result, payload };
}

test.before(async () => {
  const app = require('../src/app');
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await prisma.$disconnect();
  if (server) {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('register creates a real user with hashed password, signup bonus, point log, and incomplete profile', async () => {
  const { response, body, payload } = await registerUser('register-success');

  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.success, true);
  assert.equal(body.user.email, payload.email);
  assert.equal(body.user.gender, null);
  assert.equal(body.user.countryCode, null);
  assert.equal(body.user.points, '5000');
  assert.equal(body.user.totalEarned, '5000');
  assert.equal(body.user.totalSpent, '0');
  assert.equal(body.user.password, undefined);
  assert.ok(body.accessToken);
  assert.ok(body.refreshToken);

  const user = await prisma.user.findUnique({ where: { id: body.user.id } });
  assert.ok(user, 'user should exist in PostgreSQL');
  assert.equal(user.email, payload.email);
  assert.equal(user.gender, null);
  assert.equal(user.countryCode, null);
  assert.notEqual(user.password, payload.password);
  assert.equal(await bcrypt.compare(payload.password, user.password), true);
  assert.equal(user.points, 5000n);
  assert.equal(user.totalEarned, 5000n);
  assert.equal(user.totalSpent, 0n);

  const signupLogs = await prisma.pointLog.findMany({
    where: { userId: user.id, reason: 'SIGNUP_BONUS' },
  });
  assert.equal(signupLogs.length, 1);
  assert.equal(signupLogs[0].delta, 5000n);
  assert.equal(signupLogs[0].balanceAfter, 5000n);
});

test('register returns 409 for duplicate email instead of 500', async () => {
  const email = `duplicate-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.com`;

  const first = await registerUser('duplicate-first', { email });
  assert.equal(first.response.status, 201, JSON.stringify(first.body));

  const second = await registerUser('duplicate-second', { email });
  assert.equal(second.response.status, 409, JSON.stringify(second.body));
  assert.equal(second.body.success, false);
  assert.equal(second.body.code, 'EMAIL_USED');

  const users = await prisma.user.findMany({ where: { email } });
  assert.equal(users.length, 1);
});

test('register works without referralCode', async () => {
  const { response, body } = await registerUser('no-referral');
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.success, true);
});

test('register applies valid referral bonus exactly once', async () => {
  const inviter = await registerUser('inviter');
  assert.equal(inviter.response.status, 201, JSON.stringify(inviter.body));

  const referred = await registerUser('referred-user', {
    referralCode: inviter.body.user.referralCode,
  });
  assert.equal(referred.response.status, 201, JSON.stringify(referred.body));

  const createdUser = await prisma.user.findUnique({ where: { id: referred.body.user.id } });
  assert.equal(createdUser.referredById, inviter.body.user.id);

  const referralLogs = await prisma.pointLog.findMany({
    where: {
      userId: inviter.body.user.id,
      reason: 'REFERRAL_BONUS',
      refType: 'User',
      refId: referred.body.user.id,
    },
  });
  assert.equal(referralLogs.length, 1);
  assert.equal(referralLogs[0].delta, 2500n);

  const inviterAfter = await prisma.user.findUnique({ where: { id: inviter.body.user.id } });
  assert.equal(inviterAfter.points, 7500n);
  assert.equal(inviterAfter.totalEarned, 7500n);
});

test('register rejects invalid referralCode with business error and no user creation', async () => {
  const email = `invalid-ref-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.com`;
  const result = await registerUser('invalid-referral', {
    email,
    referralCode: 'BADCODE',
  });

  assert.equal(result.response.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
  assert.equal(result.body.code, 'INVALID_REFERRAL_CODE');

  const user = await prisma.user.findUnique({ where: { email } });
  assert.equal(user, null);
});

test('legacy user with missing gender/countryCode can login and complete profile without losing data', async () => {
  const email = `legacy-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.com`;
  const password = 'LegacyPassword123!';
  const hash = await bcrypt.hash(password, 10);

  const legacyUser = await prisma.user.create({
    data: {
      email,
      password: hash,
      name: 'Legacy User',
      role: 'USER',
      referralCode: `LEG${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      points: 1234n,
      totalEarned: 5678n,
      gender: null,
      countryCode: null,
    },
  });

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.response.status, 200, JSON.stringify(login.body));
  assert.equal(login.body.user.id, legacyUser.id);
  assert.equal(login.body.user.email, email);
  assert.equal(login.body.user.gender, null);
  assert.equal(login.body.user.countryCode, null);

  const complete = await api('/api/user/profile/complete', {
    method: 'POST',
    headers: { authorization: `Bearer ${login.body.accessToken}` },
    body: JSON.stringify({ gender: 'MALE', countryCode: 'DZ' }),
  });
  assert.equal(complete.response.status, 200, JSON.stringify(complete.body));
  assert.equal(complete.body.profileStatus.isComplete, true);

  const after = await prisma.user.findUnique({ where: { id: legacyUser.id } });
  assert.equal(after.id, legacyUser.id);
  assert.equal(after.email, email);
  assert.equal(after.points, 1234n);
  assert.equal(after.totalEarned, 5678n);
  assert.equal(after.gender, 'MALE');
  assert.equal(after.countryCode, 'DZ');
  const signupLogs = await prisma.pointLog.findMany({
    where: { userId: legacyUser.id, reason: 'SIGNUP_BONUS' },
  });
  assert.equal(signupLogs.length, 0);
});

test('new user register -> profile incomplete -> complete profile -> profile complete', async () => {
  const { response, body } = await registerUser('new-user-flow');
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.user.gender, null);
  assert.equal(body.user.countryCode, null);

  const campaigns = await api('/api/campaigns', {
    method: 'POST',
    headers: { authorization: `Bearer ${body.accessToken}` },
    body: JSON.stringify({
      type: 'LIKES',
      targetUrl: 'https://www.tiktok.com/@newuser/video/1234567890',
      quantity: 10,
    }),
  });
  assert.equal(campaigns.response.status, 403, JSON.stringify(campaigns.body));
  assert.equal(campaigns.body.code, 'PROFILE_INCOMPLETE');

  const complete = await api('/api/user/profile/complete', {
    method: 'POST',
    headers: { authorization: `Bearer ${body.accessToken}` },
    body: JSON.stringify({ gender: 'FEMALE', countryCode: 'MA' }),
  });
  assert.equal(complete.response.status, 200, JSON.stringify(complete.body));
  assert.equal(complete.body.profileStatus.isComplete, true);

  const user = await prisma.user.findUnique({ where: { id: body.user.id } });
  assert.equal(user.gender, 'FEMALE');
  assert.equal(user.countryCode, 'MA');
});
