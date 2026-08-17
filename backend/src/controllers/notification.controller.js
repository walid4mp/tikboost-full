const prisma = require('../config/db');
const { asyncHandler } = require('../utils/helpers');

const mine = asyncHandler(async (req, res) => {
  const list = await prisma.notification.findMany({
    where: { OR: [{ userId: req.user.id }, { userId: null }] },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ success: true, notifications: list });
});

const markRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.id },
    data: { readAt: new Date() },
  });
  res.json({ success: true });
});

module.exports = { mine, markRead };
