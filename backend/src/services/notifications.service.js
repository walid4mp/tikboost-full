const prisma = require('../config/db');
const { getIO } = require('../sockets/io');
const { sendPush, sendPushMany } = require('./fcm.service');

async function notify(userId, title, body, type = 'info', data = null, client = prisma) {
  const n = await client.notification.create({
    data: { userId, title, body, type, data },
  });
  try { getIO()?.to(`user:${userId}`).emit('notification', n); } catch (_) {}
  try {
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });
    if (user?.fcmToken) {
      n.pushStatus = await sendPush(user.fcmToken, title, body, type, data, { userId });
    } else {
      n.pushStatus = { sent: false, skipped: true, reason: 'no-token' };
    }
  } catch (err) {
    n.pushStatus = { sent: false, failed: true, reason: err.message };
    console.warn(`[fcm] user notification failed: ${err.message}`);
  }
  return n;
}

async function notifyAdmins(title, body, type = 'info', data = null, client = prisma) {
  const admins = await client.user.findMany({
    where: {
      role: { in: ['ADMIN', 'SUPER_ADMIN'] },
      status: 'ACTIVE',
    },
    select: { id: true },
  });
  for (const admin of admins) {
    await notify(admin.id, title, body, type, data, client);
  }
  return admins.length;
}

async function broadcast(title, body, type = 'info', data = null, client = prisma) {
  // Store one inbox item per user instead of a shared userId=null row.
  // This lets every user mark the broadcast as read independently, so the
  // red unread badge really disappears after opening the notification.
  const users = await client.user.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, fcmToken: true },
  });

  if (!users.length) return { pushStats: { sent: 0, failed: 0, skipped: 0 }, count: 0 };

  await client.notification.createMany({
    data: users.map((user) => ({ userId: user.id, title, body, type, data })),
  });

  try {
    for (const user of users) {
      try {
        const n = await client.notification.findFirst({
          where: { userId: user.id, title, body },
          orderBy: { createdAt: 'desc' },
        });
        if (n) {
          try { getIO()?.to(`user:${user.id}`).emit('notification', n); } catch (_) {}
        }
      } catch (_) {}
    }
  } catch (_) {}

  let pushStats = { sent: 0, failed: 0, skipped: 0 };
  try {
    const tokens = users.map((u) => u.fcmToken).filter(Boolean);
    if (tokens.length) {
      pushStats = await sendPushMany(tokens, title, body, type, data, {});
    } else {
      pushStats.skipped = users.length;
    }
  } catch (err) {
    console.warn(`[fcm] broadcast failed: ${err.message}`);
    pushStats.failed = users.filter((u) => u.fcmToken).length;
    pushStats.skipped = users.filter((u) => !u.fcmToken).length;
  }

  return { pushStats, count: users.length };
}

module.exports = { notify, broadcast, notifyAdmins };
