const prisma = require('../config/db');
const { asyncHandler } = require('../utils/helpers');
const { AppError } = require('../utils/errors');

const mine = asyncHandler(async (req, res) => {
  const list = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const unreadCount = await prisma.notification.count({ where: { userId: req.user.id, readAt: null } });
  res.json({ success: true, notifications: list, unreadCount });
});

const markRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.id },
    data: { readAt: new Date() },
  });
  res.json({ success: true });
});

const registerDeviceToken = asyncHandler(async (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (token.length < 20 || token.length > 4096) throw new AppError('Invalid notification token', 400, 'INVALID_FCM_TOKEN');
  await prisma.user.updateMany({ where: { fcmToken: token, NOT: { id: req.user.id } }, data: { fcmToken: null } });
  await prisma.user.update({ where: { id: req.user.id }, data: { fcmToken: token } });
  res.json({ success: true });
});

const unregisterDeviceToken = asyncHandler(async (req, res) => {
  await prisma.user.update({ where: { id: req.user.id }, data: { fcmToken: null } });
  res.json({ success: true });
});

module.exports = { mine, markRead, registerDeviceToken, unregisterDeviceToken };
