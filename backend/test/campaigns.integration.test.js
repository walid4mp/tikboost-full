const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
let server;
let baseUrl;
let ownerToken;
let ownerId;

const originalFetch = global.fetch;
const redirectMap = new Map([
  ['https://vt.tiktok.com/zs4kjkbvv', 'https://www.tiktok.com/@vtcreator/video/123456789'],
  ['https://vm.tiktok.com/vmprofile1', 'https://www.tiktok.com/@vmprofile1'],
  ['https://www.tiktok.com/t/tshare123', 'https://www.tiktok.com/@tshare123/video/222333444'],
  ['https://vt.tiktok.com/followersdemo', 'https://www.tiktok.com/@followersdemo'],
  ['https://vm.tiktok.com/likesdemo', 'https://www.tiktok.com/@likesdemo/video/555666777'],
  ['https://www.tiktok.com/t/viewsdemo', 'https://www.tiktok.com/@viewsdemo/video/888999000'],
  ['https://vt.tiktok.com/commentsdemo', 'https://www.tiktok.com/@commentsdemo/video/444555666'],
]);

function normalizeKey(url) {
  const parsed = new URL(url);
  parsed.search = '';
  parsed.hash = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return parsed.toString().toLowerCase();
}

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

test.before(async () => {
  global.fetch = async (input, init) => {
    const key = normalizeKey(String(input));
    if (redirectMap.has(key)) {
      return {
        ok: true,
        status: 200,
        url: redirectMap.get(key),
        body: { cancel: async () => {} },
      };
    }
    return originalFetch(input, init);
  };

  const app = require('../src/app');
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const owner = await signupUser('owner');
  ownerToken = owner.accessToken;
  ownerId = owner.user.id;
  await signupUser('worker');

  await prisma.user.update({
    where: { id: ownerId },
    data: { points: 500000n, totalEarned: 500000n },
  });
});

test.after(async () => {
  global.fetch = originalFetch;
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
  await prisma.$disconnect();
});

test('creates all campaign types with canonical TikTok targets', async () => {
  const cases = [
    {
      type: 'FOLLOWERS',
      targetUrl: 'https://vt.tiktok.com/followersdemo/?_r=1',
      expectedUrl: 'https://www.tiktok.com/@followersdemo',
      expectedUser: '@followersdemo',
      expectedVideoId: null,
      expectedComment: null,
    },
    {
      type: 'LIKES',
      targetUrl: 'https://vm.tiktok.com/likesdemo/?share=1',
      expectedUrl: 'https://www.tiktok.com/@likesdemo/video/555666777',
      expectedUser: '@likesdemo',
      expectedVideoId: '555666777',
      expectedComment: null,
    },
    {
      type: 'VIEWS',
      targetUrl: 'https://www.tiktok.com/t/viewsdemo/?is_from_webapp=1',
      expectedUrl: 'https://www.tiktok.com/@viewsdemo/video/888999000',
      expectedUser: '@viewsdemo',
      expectedVideoId: '888999000',
      expectedComment: null,
    },
    {
      type: 'COMMENTS',
      targetUrl: 'https://vt.tiktok.com/commentsdemo/?_t=1',
      commentText: 'ممتاز 🔥',
      expectedUrl: 'https://www.tiktok.com/@commentsdemo/video/444555666',
      expectedUser: '@commentsdemo',
      expectedVideoId: '444555666',
      expectedComment: 'ممتاز 🔥',
    },
  ];

  for (const item of cases) {
    const { response, body } = await api('/api/campaigns', {
      method: 'POST',
      headers: { authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        type: item.type,
        targetUrl: item.targetUrl,
        quantity: 25,
        ...(item.commentText ? { commentText: item.commentText } : {}),
      }),
    });

    assert.equal(response.status, 201, `${item.type}: ${JSON.stringify(body)}`);
    assert.equal(body.campaign.type, item.type);
    assert.equal(body.campaign.targetUrl, item.expectedUrl);
    assert.equal(body.campaign.targetUsername, item.expectedUser);
    assert.equal(body.campaign.videoId, item.expectedVideoId);
    assert.equal(body.campaign.commentText, item.expectedComment);
  }
});

test('rejects COMMENTS campaigns without commentText', async () => {
  const { response, body } = await api('/api/campaigns', {
    method: 'POST',
    headers: { authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      type: 'COMMENTS',
      targetUrl: 'https://vt.tiktok.com/commentsdemo/',
      quantity: 10,
    }),
  });

  assert.equal(response.status, 400);
  assert.match(body.message, /Comment text is required/i);
});
