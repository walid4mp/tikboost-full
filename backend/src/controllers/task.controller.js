const prisma = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { adjustPoints } = require('../services/points.service');
const { getIO } = require('../sockets/io');
const { truthyIp, asyncHandler } = require('../utils/helpers');

/**
 * Feed of tasks for the current user.
 * - excludes campaigns owned by user
 * - excludes already-executed tasks (per-campaign-per-user)
 * - returns ACTIVE campaigns with remaining quantity
 */
const feed = asyncHandler(async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit || '20', 10));

  const myTasks = await prisma.task.findMany({
    where: { executorId: req.user.id },
    select: { campaignId: true },
  });
  const takenIds = myTasks.map(t => t.campaignId);

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: 'ACTIVE',
      ownerId: { not: req.user.id },
      id: { notIn: takenIds },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { owner: { select: { id: true, name: true, avatarUrl: true } } },
  });

  const filtered = campaigns
    .filter(c => Number(c.completed) < Number(c.quantity))
    .map(c => ({
      id: c.id,
      type: c.type,
      targetUrl: c.targetUrl,
      targetUsername: c.targetUsername,
      rewardPoints: c.perTaskReward.toString(),
      quantity: c.quantity,
      completed: c.completed,
      owner: { id: c.owner.id, name: c.owner.name, avatar: c.owner.avatarUrl },
    }));
  res.json({ success: true, tasks: filtered, count: filtered.length });
});

/**
 * Anti-abuse: same user cannot execute same campaign twice (DB unique constraint).
 */
const execute = asyncHandler(async (req, res) => {
  const { campaignId } = req.body;
  if (!campaignId) throw new AppError('campaignId required', 400);

  // Cooldown between any two task executions by same user
  const last = await prisma.task.findFirst({
    where: { executorId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  if (last && (Date.now() - last.createdAt.getTime()) < env.TASK_COOLDOWN_SECONDS * 1000) {
    throw new AppError(`Please wait ${env.TASK_COOLDOWN_SECONDS}s between tasks`, 429, 'COOLDOWN');
  }

  const result = await prisma.$transaction(async (tx) => {
    const camp = await tx.campaign.findUnique({ where: { id: campaignId } });
    if (!camp) throw new AppError('Campaign not found', 404);
    if (camp.status !== 'ACTIVE') throw new AppError('Campaign not active', 400);
    if (camp.ownerId === req.user.id) throw new AppError('Cannot execute own campaign', 403);
    if (Number(camp.completed) >= Number(camp.quantity)) throw new AppError('Campaign full', 400);

    let task;
    try {
      task = await tx.task.create({
        data: {
          campaignId, executorId: req.user.id,
          rewardPoints: camp.perTaskReward,
          status: 'VERIFIED',
          verifiedAt: new Date(),
          ip: truthyIp(req),
        },
      });
    } catch (e) {
      if (e.code === 'P2002') throw new AppError('You already executed this campaign', 409, 'ALREADY_DONE');
      throw e;
    }

    const updatedCamp = await tx.campaign.update({
      where: { id: campaignId },
      data: { completed: { increment: 1 } },
    });

    if (Number(updatedCamp.completed) >= Number(updatedCamp.quantity)) {
      await tx.campaign.update({ where: { id: campaignId }, data: { status: 'COMPLETED' } });
    }
    return task;
  });

  // Pay executor
  const user = await adjustPoints(req.user.id, result.rewardPoints, 'TASK_REWARD', {
    refType: 'Task', refId: result.id, note: 'Task reward',
  });

  // Notify owner of progress
  const notifySvc = require('../services/notifications.service');
  const camp = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (camp) {
    await notifySvc.notify(
      camp.ownerId,
      'تقدّم في حملتك 🚀',
      `الحملة ${camp.type} وصلت إلى ${camp.completed}/${camp.quantity}`,
      'info',
    );
    getIO()?.emit('campaign:progress', { campaignId, completed: camp.completed, quantity: camp.quantity });
  }

  res.json({ success: true, task: result, balance: user.points.toString() });
});

const my = asyncHandler(async (req, res) => {
  const list = await prisma.task.findMany({
    where: { executorId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 100,
    include: { campaign: { select: { type: true, targetUsername: true, targetUrl: true } } },
  });
  res.json({ success: true, tasks: list });
});

module.exports = { feed, execute, my };
