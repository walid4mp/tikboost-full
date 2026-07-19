const prisma = require('../config/db');
const { asyncHandler } = require('../utils/helpers');

const getProfile = asyncHandler(async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({ success: true, user: { ...u, password: undefined } });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, avatarUrl } = req.body;
  const u = await prisma.user.update({
    where: { id: req.user.id },
    data: { name: name || undefined, avatarUrl: avatarUrl || undefined },
  });
  res.json({ success: true, user: { ...u, password: undefined } });
});

const pointHistory = asyncHandler(async (req, res) => {
  const list = await prisma.pointLog.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ success: true, logs: list });
});

const activityStats = asyncHandler(async (req, res) => {
  const [completed, tasksCount, campaignsCount, refsCount] = await Promise.all([
    prisma.task.count({ where: { executorId: req.user.id, status: 'VERIFIED' } }),
    prisma.task.count({ where: { executorId: req.user.id } }),
    prisma.campaign.count({ where: { ownerId: req.user.id } }),
    prisma.user.count({ where: { referredById: req.user.id } }),
  ]);
  res.json({ success: true, stats: { completed, tasksCount, campaignsCount, referralCount: refsCount } });
});

module.exports = { getProfile, updateProfile, pointHistory, activityStats };
