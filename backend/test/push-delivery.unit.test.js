/* Unit tests for push delivery. They need neither a database nor network:
   Prisma, socket.io and FCM (global fetch) are replaced by in-memory fakes. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Module = require('node:module');

// ---- fake Firebase service account (real RSA key so JWT signing works) ----
const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
  project_id: 'test-project',
  client_email: 'svc@test-project.iam.gserviceaccount.com',
  // escaped newlines on purpose: Render/.env style
  private_key: privateKey.replace(/\n/g, '\\n'),
});

// ---- in-memory fake prisma ----
const db = {
  deviceTokens: [],
  legacyUsers: [],
  notifications: [],
  settings: {},
  calls: { deleteMany: [], userUpdateMany: [] },
};
const fakePrisma = {
  deviceToken: {
    findMany: async ({ where }) => db.deviceTokens.filter((d) => where.userId.in.includes(d.userId)).map((d) => ({ token: d.token })),
    deleteMany: async ({ where }) => {
      db.calls.deleteMany.push(where);
      const before = db.deviceTokens.length;
      db.deviceTokens = db.deviceTokens.filter((d) => !where.token.in.includes(d.token));
      return { count: before - db.deviceTokens.length };
    },
  },
  user: {
    findMany: async ({ where }) => db.legacyUsers.filter((u) => where.id.in.includes(u.id)).map((u) => ({ fcmToken: u.fcmToken })),
    updateMany: async (args) => { db.calls.userUpdateMany.push(args); return { count: 0 }; },
  },
  notification: {
    createMany: async ({ data }) => { db.notifications.push(...data); return { count: data.length }; },
  },
  appSetting: {
    upsert: async ({ where, create }) => { db.settings[where.key] = create.valueJson; return {}; },
    findUnique: async ({ where }) => (db.settings[where.key] ? { valueJson: db.settings[where.key] } : null),
  },
};

const emitted = [];
const realLoad = Module._load;
Module._load = function patched(request, parent, isMain) {
  if (request === 'dotenv') return { config() {} };
  if (request.endsWith('config/db')) return fakePrisma;
  if (request.endsWith('sockets/io')) {
    return { getIO: () => ({ to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) }) };
  }
  return realLoad.call(this, request, parent, isMain);
};

const fcm = require('../src/services/fcm.service');
const notifications = require('../src/services/notifications.service');

// ---- fake FCM / OAuth over global fetch ----
const fcmAttempts = {};
let sentPayloads = [];
global.fetch = async (url, init = {}) => {
  if (String(url).includes('oauth2.googleapis.com')) {
    return new Response(JSON.stringify({ access_token: 'fake-access', expires_in: 3600 }), { status: 200 });
  }
  const payload = JSON.parse(init.body);
  const token = payload.message.token;
  fcmAttempts[token] = (fcmAttempts[token] || 0) + 1;
  sentPayloads.push(payload);

  if (token.startsWith('dead')) {
    return new Response(JSON.stringify({ error: { status: 'NOT_FOUND', message: 'Requested entity was not found.', details: [{ errorCode: 'UNREGISTERED' }] } }), { status: 404 });
  }
  if (token.startsWith('payloadbad')) {
    return new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT', message: 'Invalid value at message.data' } }), { status: 400 });
  }
  if (token.startsWith('flaky') && fcmAttempts[token] === 1) {
    return new Response(JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'try later' } }), { status: 503 });
  }
  return new Response(JSON.stringify({ name: `projects/test-project/messages/${token}` }), { status: 200 });
};

const tok = (prefix, i = 0) => `${prefix}-${String(i).padStart(24, 'x')}`;

test('classifyFcmError distinguishes dead tokens from bad payloads', () => {
  const unreg = fcm.classifyFcmError(404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } });
  assert.equal(unreg.deadToken, true);

  const payload = fcm.classifyFcmError(400, { error: { status: 'INVALID_ARGUMENT', message: 'Invalid value at message.data' } });
  assert.equal(payload.deadToken, false, 'a malformed payload must NOT delete the device token');

  const badToken = fcm.classifyFcmError(400, { error: { status: 'INVALID_ARGUMENT', message: 'The registration token is not a valid FCM registration token' } });
  assert.equal(badToken.deadToken, true);

  assert.equal(fcm.classifyFcmError(429, {}).retryable, true);
  assert.equal(fcm.classifyFcmError(503, { error: { status: 'UNAVAILABLE' } }).retryable, true);
  assert.equal(fcm.classifyFcmError(401, {}).authExpired, true);
  assert.equal(fcm.classifyFcmError(403, { error: { details: [{ errorCode: 'SENDER_ID_MISMATCH' }] } }).deadToken, true);
});

test('push payload targets the channel the Android app actually creates', () => {
  const { message } = fcm.buildMessage('t', 'عنوان', 'نص', 'reward', { a: 1, nested: { x: 2 }, skip: null });
  assert.equal(message.android.notification.channel_id, 'tikboostwh_general_v2');
  assert.notEqual(message.android.notification.channel_id, 'tokaura_general_v2');
  for (const value of Object.values(message.data)) assert.equal(typeof value, 'string');
  assert.equal(message.data.nested, '{"x":2}');
  assert.equal('skip' in message.data, false);
  assert.equal(message.data.type, 'reward');
});

test('sendPushMany reports stats, retries transient errors and only flags dead tokens', async () => {
  const tokens = [tok('ok', 1), tok('ok', 2), tok('dead', 1), tok('payloadbad', 1), tok('flaky', 1)];
  const stats = await fcm.sendPushMany(tokens, 'T', 'B', 'info', null);
  assert.equal(stats.total, 5);
  assert.equal(stats.sent, 3, 'two ok + one flaky that succeeds on retry');
  assert.equal(stats.failed, 2);
  assert.deepEqual(stats.deadTokens, [tok('dead', 1)]);
  assert.equal(stats.errors.UNREGISTERED, 1);
  assert.equal(stats.errors.INVALID_ARGUMENT, 1);
  assert.equal(fcmAttempts[tok('flaky', 1)], 2);
});

test('sendPushMany handles large batches with bounded concurrency', async () => {
  const tokens = Array.from({ length: 300 }, (_, i) => tok('ok', 1000 + i));
  const stats = await fcm.sendPushMany(tokens, 'T', 'B');
  assert.equal(stats.sent, 300);
});

test('notifyUsers reaches every device (multi-device + legacy), dedupes and purges dead tokens', async () => {
  db.deviceTokens = [
    { userId: 'u1', token: tok('ok', 11) },
    { userId: 'u1', token: tok('ok', 12) }, // second device of the same user
    { userId: 'u2', token: tok('dead', 21) },
    { userId: 'u3', token: tok('ok', 31) },
  ];
  db.legacyUsers = [
    { id: 'u3', fcmToken: tok('ok', 31) }, // duplicate of a device row
    { id: 'u4', fcmToken: tok('ok', 41) }, // legacy-only user
  ];
  db.notifications = [];
  emitted.length = 0;
  sentPayloads = [];

  const result = await notifications.notifyUsers(['u1', 'u2', 'u3', 'u4', 'u5'], 'مرحبا', 'اختبار', 'info', null, { audience: 'ALL', waitMs: 5000 });

  assert.equal(result.count, 5);
  assert.equal(result.devices, 5, 'u1 has 2, u2 1, u3 1 (deduped), u4 1 legacy');
  assert.equal(db.notifications.length, 5, 'one inbox row per user, including users without devices');
  assert.ok(db.notifications.every((n) => typeof n.id === 'string' && n.id.length > 10));
  assert.equal(emitted.length, 5);
  assert.equal(result.push.sent, 4);
  assert.equal(result.push.failed, 1);
  assert.equal(result.push.purged, 1);
  assert.ok(!db.deviceTokens.some((d) => d.token === tok('dead', 21)), 'dead token removed');
  assert.ok(db.deviceTokens.some((d) => d.token === tok('ok', 12)), 'live tokens kept');
  assert.ok(db.calls.userUpdateMany.length >= 1, 'legacy column cleaned too');

  const stored = await notifications.getLastBroadcast();
  assert.equal(stored.audience, 'ALL');
  assert.equal(stored.sent, 4);
  assert.equal(stored.deadTokens, undefined, 'raw token list is not persisted');
});

test('notifyUsers with waitMs=0 returns immediately and finishes in the background', async () => {
  db.deviceTokens = [{ userId: 'u9', token: tok('ok', 91) }];
  db.legacyUsers = [];
  const result = await notifications.notifyUsers(['u9'], 'x', 'y', 'info', null, { waitMs: 0 });
  assert.equal(result.pending, true);
  assert.equal(result.push, null);
  await new Promise((r) => setTimeout(r, 50));
});

test('push payload still goes out when the service account key uses escaped newlines', async () => {
  const r = await fcm.sendPush(tok('ok', 7), 'a', 'b');
  assert.equal(r.sent, true);
});

test('admin audience resolver builds the expected filters', async () => {
  const seen = [];
  fakePrisma.user.findMany = async (args) => { seen.push(args.where); return [{ id: 'a' }, { id: 'b' }]; };
  const tools = require('../src/controllers/adminTools.controller');

  const inactive = await tools.resolveAudience({ audience: 'INACTIVE', days: 14 });
  assert.deepEqual(inactive.ids, ['a', 'b']);
  assert.equal(seen[0].status, 'ACTIVE');
  assert.ok(seen[0].OR.some((c) => c.lastLoginAt === null), 'never-logged-in users count as inactive');

  await tools.resolveAudience({ audience: 'COUNTRY', countryCode: 'dz' });
  assert.equal(seen[1].countryCode, 'DZ');

  await assert.rejects(() => tools.resolveAudience({ audience: 'COUNTRY', countryCode: 'ALGERIA' }), /رمز الدولة/);
  await assert.rejects(() => tools.resolveAudience({ audience: 'EVERYONE' }), /نوع الجمهور/);

  const none = await tools.resolveAudience({ audience: 'SELECTED', userIds: [] });
  assert.deepEqual(none.ids, []);
});
