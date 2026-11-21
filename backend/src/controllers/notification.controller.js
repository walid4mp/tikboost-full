const prisma = require('../config/db');
const { asyncHandler } = require('../utils/helpers');
const { AppError } = require('../utils/errors');

// A user may be signed in on a few devices; keep the most recently seen ones.
const MAX_DEVICES_PER_USER = 5;

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

const markAllRead = asyncHandler(async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ success: true, updated: result.count });
});

async function saveDevice(userId, token, platform, appVersion) {
  await prisma.$transaction(async (tx) => {
    // upsert moves the device to the account that is signed in now.
    await tx.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform, appVersion },
      update: { userId, platform, appVersion, lastSeenAt: new Date() },
    });

    const surplus = await tx.deviceToken.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      skip: MAX_DEVICES_PER_USER,
      select: { id: true },
    });
    if (surplus.length) {
      await tx.deviceToken.deleteMany({ where: { id: { in: surplus.map((d) => d.id) } } });
    }

    // Keep the legacy single-token column in sync for older code paths.
    await tx.user.updateMany({ where: { fcmToken: token, NOT: { id: userId } }, data: { fcmToken: null } });
    await tx.user.update({ where: { id: userId }, data: { fcmToken: token } });
  });
}

const registerDeviceToken = asyncHandler(async (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (token.length < 20 || token.length > 4096) {
    throw new AppError('Invalid notification token', 400, 'INVALID_FCM_TOKEN');
  }
  const platform = String(req.body?.platform || 'android').slice(0, 20);
  const appVersion = req.body?.appVersion ? String(req.body.appVersion).slice(0, 32) : null;

  try {
    await saveDevice(req.user.id, token, platform, appVersion);
  } catch (err) {
    // Two concurrent registrations of the same token race on the unique index.
    if (err?.code !== 'P2002') throw err;
    await saveDevice(req.user.id, token, platform, appVersion);
  }
  res.json({ success: true });
});

const unregisterDeviceToken = asyncHandler(async (req, res) => {
  const token = String(req.body?.token || req.query?.token || '').trim();
  if (token) {
    // Logout on one device must not silence the user's other devices.
    await prisma.deviceToken.deleteMany({ where: { userId: req.user.id, token } });
    await prisma.user.updateMany({ where: { id: req.user.id, fcmToken: token }, data: { fcmToken: null } });
  } else {
    // Older app versions send no token: clear everything for the user.
    await prisma.deviceToken.deleteMany({ where: { userId: req.user.id } });
    await prisma.user.update({ where: { id: req.user.id }, data: { fcmToken: null } });
  }
  res.json({ success: true });
});

module.exports = { mine, markRead, markAllRead, registerDeviceToken, unregisterDeviceToken };
