const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const http = require('node:http');
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

async function signupUser(prefix) {
  const email = `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.com`;
  const payload = {
    email,
    password: 'Passw0rd!123',
    name: prefix,
  };

  const { response, body } = await api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  assert.equal(response.status, 201, JSON.stringify(body));
  return body;
}

async function completeProfile(accessToken, profile) {
  return api('/api/user/profile/complete', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(profile),
  });
}

async function createCampaign(accessToken, data) {
  return api('/api/campaigns', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(data),
  });
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

test('POST /api/user/profile/complete stores MALE + DZ in database', async () => {
  const signup = await signupUser('profile-male');

  const { response, body } = await completeProfile(signup.accessToken, {
    gender: 'MALE',
    countryCode: 'DZ',
  });

  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.success, true);
  assert.equal(body.user.gender, 'MALE');
  assert.equal(body.user.countryCode, 'DZ');
  assert.equal(body.profileStatus.isComplete, true);

  const user = await prisma.user.findUnique({ where: { id: signup.user.id } });
  assert.equal(user.gender, 'MALE');
  assert.equal(user.countryCode, 'DZ');
});

test('POST /api/user/profile/complete stores FEMALE profile in database', async () => {
  const signup = await signupUser('profile-female');

  const { response, body } = await completeProfile(signup.accessToken, {
    gender: 'FEMALE',
    countryCode: 'MA',
  });

  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.user.gender, 'FEMALE');
  assert.equal(body.user.countryCode, 'MA');

  const user = await prisma.user.findUnique({ where: { id: signup.user.id } });
  assert.equal(user.gender, 'FEMALE');
  assert.equal(user.countryCode, 'MA');
});

test('POST /api/user/profile/complete rejects invalid gender and invalid country code', async () => {
  const signup = await signupUser('profile-invalid');

  const invalidGender = await completeProfile(signup.accessToken, {
    gender: 'INVALID',
    countryCode: 'DZ',
  });
  assert.equal(invalidGender.response.status, 400, JSON.stringify(invalidGender.body));

  const invalidCountry = await completeProfile(signup.accessToken, {
    gender: 'MALE',
    countryCode: 'ZZ',
  });
  assert.equal(invalidCountry.response.status, 400, JSON.stringify(invalidCountry.body));

  const user = await prisma.user.findUnique({ where: { id: signup.user.id } });
  assert.equal(user.gender, null);
  assert.equal(user.countryCode, null);
});

test('task feed honors gender and country audience targeting', async () => {
  const owner = await signupUser('owner-targeting');
  const worker = await signupUser('worker-targeting');

  await completeProfile(owner.accessToken, { gender: 'FEMALE', countryCode: 'MA' });
  await completeProfile(worker.accessToken, { gender: 'MALE', countryCode: 'DZ' });

  await prisma.user.update({
    where: { id: owner.user.id },
    data: { points: 500000n, totalEarned: 500000n },
  });

  const matching = await createCampaign(owner.accessToken, {
    type: 'LIKES',
    targetUrl: 'https://www.tiktok.com/@matchdz/video/1111111111',
    quantity: 10,
    targetGender: 'MALE',
    targetCountry: 'DZ',
  });
  assert.equal(matching.response.status, 201, JSON.stringify(matching.body));

  const genderMismatch = await createCampaign(owner.accessToken, {
    type: 'LIKES',
    targetUrl: 'https://www.tiktok.com/@femaledz/video/2222222222',
    quantity: 10,
    targetGender: 'FEMALE',
    targetCountry: 'DZ',
  });
  assert.equal(genderMismatch.response.status, 201, JSON.stringify(genderMismatch.body));

  const worldwide = await createCampaign(owner.accessToken, {
    type: 'LIKES',
    targetUrl: 'https://www.tiktok.com/@worldwide/video/3333333333',
    quantity: 10,
    targetGender: 'ALL',
    targetCountry: 'WORLDWIDE',
  });
  assert.equal(worldwide.response.status, 201, JSON.stringify(worldwide.body));

  const countryMismatch = await createCampaign(owner.accessToken, {
    type: 'LIKES',
    targetUrl: 'https://www.tiktok.com/@morocco/video/4444444444',
    quantity: 10,
    targetGender: 'MALE',
    targetCountry: 'MA',
  });
  assert.equal(countryMismatch.response.status, 201, JSON.stringify(countryMismatch.body));

  const { response, body } = await api('/api/tasks/feed', {
    method: 'GET',
    headers: { authorization: `Bearer ${worker.accessToken}` },
  });

  assert.equal(response.status, 200, JSON.stringify(body));
  const ids = new Set(body.tasks.map((item) => item.id));

  assert.ok(ids.has(matching.body.campaign.id), 'matching campaign should be visible');
  assert.ok(ids.has(worldwide.body.campaign.id), 'worldwide campaign should be visible');
  assert.ok(!ids.has(genderMismatch.body.campaign.id), 'female-only campaign should be hidden');
  assert.ok(!ids.has(countryMismatch.body.campaign.id), 'country-mismatched campaign should be hidden');
});
