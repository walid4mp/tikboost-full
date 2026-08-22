const prisma = require('../config/db');
const { getIO } = require('../sockets/io');
const { sendPush, sendPushMany } = require('./fcm.service');

async function notify(userId, title, body, type = 'info', data = null, client = prisma) {
  const n = await client.notification.create({
    data: { userId, title, body, type, data },
  });
  try { getIO()?.to(`user:${userId}`).emit('notification', n); } catch (_) {}
  try {
    const user = await client.user.findUnique({ where: { id: userId }, select: { fcmToken: true } });
    if (user?.fcmToken) await sendPush(user.fcmToken, title, body, type, data);
  } catch (err) {
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
  const n = await client.notification.create({
    data: { userId: null, title, body, type, data },
  });
  try { getIO()?.emit('notification', n); } catch (_) {}
  try {
    const users = await client.user.findMany({ where: { status: 'ACTIVE', fcmToken: { not: null } }, select: { fcmToken: true } });
    const push = await sendPushMany(users.map((u) => u.fcmToken), title, body, type, data);
    n.pushStats = push;
  } catch (err) {
    console.warn(`[fcm] broadcast failed: ${err.message}`);
  }
  return n;
}

module.exports = { notify, broadcast, notifyAdmins };
