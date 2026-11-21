const crypto = require('crypto');
const prisma = require('../config/db');
const { getIO } = require('../sockets/io');
const fcm = require('./fcm.service');

/**
 * In-app + push notification delivery.
 *
 * What changed vs. the previous implementation:
 *  - Broadcasts no longer run one `findFirst` query per user before sending
 *    (that made large broadcasts time out before any push was sent).
 *    Notification rows get client-generated ids so the socket event can be
 *    emitted without re-reading them.
 *  - Push targets come from the multi-device `DeviceToken` table (plus the
 *    legacy `User.fcmToken` column), so every device of a user is reached.
 *  - Large audiences are delivered in the background; the caller may wait a
 *    bounded time for the stats. The latest broadcast result is stored so the
 *    admin panel can show it later.
 */

const LAST_BROADCAST_KEY = 'push:lastBroadcast';
const ID_CHUNK = 2000;
const ROW_CHUNK = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const emptyStats = () => ({ total: 0, sent: 0, failed: 0, skipped: 0, errors: {}, purged: 0 });

/** All push tokens (every device + legacy column) for the given users. */
async function tokensForUsers(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  const tokens = new Set();
  for (const part of chunk(ids, ID_CHUNK)) {
    const [devices, legacy] = await Promise.all([
      prisma.deviceToken.findMany({ where: { userId: { in: part } }, select: { token: true } }),
      prisma.user.findMany({ where: { id: { in: part }, fcmToken: { not: null } }, select: { fcmToken: true } }),
    ]);
    devices.forEach((d) => d.token && tokens.add(d.token));
    legacy.forEach((u) => u.fcmToken && tokens.add(u.fcmToken));
  }
  return [...tokens];
}

async function recordLastBroadcast(summary) {
  try {
    const valueJson = JSON.parse(JSON.stringify(summary));
    await prisma.appSetting.upsert({
      where: { key: LAST_BROADCAST_KEY },
      create: { key: LAST_BROADCAST_KEY, valueJson },
      update: { valueJson },
    });
  } catch (err) {
    console.warn(`[push] could not store last broadcast: ${err.message}`);
  }
}

async function getLastBroadcast() {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: LAST_BROADCAST_KEY } });
    return row ? row.valueJson : null;
  } catch (_) {
    return null;
  }
}

/** Sends a push to a token list, purges dead tokens and (optionally) stores the result. */
async function deliverPush(tokens, title, body, type = 'info', data = null, meta = {}) {
  const startedAt = new Date();
  const stats = await fcm.sendPushMany(tokens, title, body, type, data);
  const purged = await fcm.purgeDeadTokens(stats.deadTokens);
  const { deadTokens, ...rest } = stats;
  const summary = {
    ...rest,
    purged,
    title,
    audience: meta.audience || null,
    users: meta.users ?? null,
    firebaseConfigured: fcm.isConfigured(),
    startedAt,
    finishedAt: new Date(),
  };
  if (meta.record) await recordLastBroadcast(summary);
  return summary;
}

/**
 * Creates one inbox row per user, emits the realtime event and sends push to
 * every registered device.
 * opts: { audience, waitMs (default 8000, 0 = do not wait), record (default true) }
 */
async function notifyUsers(userIds, title, body, type = 'info', data = null, opts = {}) {
  const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
  if (!ids.length) return { count: 0, devices: 0, push: emptyStats(), pending: false };

  const createdAt = new Date();
  const rows = ids.map((userId) => ({
    id: crypto.randomUUID(),
    userId,
    title,
    body,
    type,
    data: data ?? undefined,
    createdAt,
  }));

  for (const part of chunk(rows, ROW_CHUNK)) {
    await prisma.notification.createMany({ data: part });
  }

  const io = getIO();
  if (io) {
    for (const row of rows) {
      try { io.to(`user:${row.userId}`).emit('notification', { ...row, readAt: null }); } catch (_) {}
    }
  }

  const tokens = await tokensForUsers(ids);
  const job = deliverPush(tokens, title, body, type, data, {
    audience: opts.audience,
    users: ids.length,
    record: opts.record !== false,
  }).catch((err) => {
    console.warn(`[push] delivery failed: ${err.message}`);
    return { ...emptyStats(), total: tokens.length, failed: tokens.length, errors: { INTERNAL: tokens.length } };
  });

  const waitMs = opts.waitMs === undefined ? 8000 : opts.waitMs;
  if (waitMs <= 0) return { count: ids.length, devices: tokens.length, push: null, pending: true };

  const result = await Promise.race([job, sleep(waitMs).then(() => null)]);
  return { count: ids.length, devices: tokens.length, push: result, pending: !result };
}

async function pushToUser(userId, title, body, type, data) {
  const tokens = await tokensForUsers([userId]);
  if (!tokens.length) return { sent: false, skipped: true, reason: 'no-token' };

  const stats = await fcm.sendPushMany(tokens, title, body, type, data);
  if (stats.deadTokens.length) await fcm.purgeDeadTokens(stats.deadTokens);

  if (stats.sent > 0) return { sent: true, devices: stats.sent, failedDevices: stats.failed };
  if (stats.skipped === stats.total) {
    return { sent: false, skipped: true, reason: Object.keys(stats.errors)[0] || 'firebase-not-configured' };
  }
  return { sent: false, failed: true, reason: Object.keys(stats.errors)[0] || 'UNKNOWN', errors: stats.errors };
}

/**
 * Single-user notification. When called with a transaction client the push is
 * queued in the background so it never blocks (or outlives) the transaction.
 */
async function notify(userId, title, body, type = 'info', data = null, client = prisma) {
  const n = await client.notification.create({
    data: { userId, title, body, type, data: data ?? undefined },
  });
  try { getIO()?.to(`user:${userId}`).emit('notification', n); } catch (_) {}

  const pushData = { ...(data && typeof data === 'object' ? data : {}), notificationId: n.id };
  const job = pushToUser(userId, title, body, type, pushData);

  if (client !== prisma) {
    job.catch((err) => console.warn(`[push] user notification failed: ${err.message}`));
    n.pushStatus = { sent: false, queued: true };
    return n;
  }

  try {
    n.pushStatus = await job;
  } catch (err) {
    n.pushStatus = { sent: false, failed: true, reason: err.message };
    console.warn(`[push] user notification failed: ${err.message}`);
  }
  return n;
}

async function notifyAdmins(title, body, type = 'info', data = null, client = prisma) {
  const admins = await client.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!admins.length) return 0;
  if (client !== prisma) {
    for (const admin of admins) await notify(admin.id, title, body, type, data, client);
    return admins.length;
  }
  await notifyUsers(admins.map((a) => a.id), title, body, type, data, { audience: 'ADMINS', waitMs: 0, record: false });
  return admins.length;
}

/** Notification for every ACTIVE user. opts as in notifyUsers (default: do not wait). */
async function broadcast(title, body, type = 'info', data = null, _client = prisma, opts = {}) {
  const users = await prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
  const result = await notifyUsers(
    users.map((u) => u.id),
    title,
    body,
    type,
    data,
    { audience: 'ALL', waitMs: 0, ...opts },
  );
  return { pushStats: result.push, count: result.count, devices: result.devices, pending: result.pending };
}

module.exports = {
  LAST_BROADCAST_KEY,
  notify,
  notifyUsers,
  notifyAdmins,
  broadcast,
  tokensForUsers,
  deliverPush,
  getLastBroadcast,
};
