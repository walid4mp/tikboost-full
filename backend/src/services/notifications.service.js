const prisma = require('../config/db');
const { getIO } = require('../sockets/io');

async function notify(userId, title, body, type = 'info', data = null) {
  const n = await prisma.notification.create({
    data: { userId, title, body, type, data },
  });
  try { getIO()?.to(`user:${userId}`).emit('notification', n); } catch (_) {}
  return n;
}

async function broadcast(title, body, type = 'info', data = null) {
  const n = await prisma.notification.create({
    data: { userId: null, title, body, type, data },
  });
  try { getIO()?.emit('notification', n); } catch (_) {}
  return n;
}

module.exports = { notify, broadcast };
