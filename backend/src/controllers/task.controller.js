const prisma = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { adjustPoints } = require('../services/points.service');
const { getIO } = require('../sockets/io');
const { truthyIp, asyncHandler } = require('../utils/helpers');

const VALID_TYPES = ['FOLLOWERS', 'LIKES', 'VIEWS', 'COMMENTS'];

const feed = asyncHandler(async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
  const requestedType = String(req.query.type || '').trim().toUpperCase();
  const typeFilter = VALID_TYPES.includes(requestedType) ? requestedType : null;

  const myTasks = await prisma.task.findMany({
    where: { executorId: req.user.id },
    select: { campaignId: true },
  });

  const takenIds = myTasks.map((task) => task.campaignId);

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: 'ACTIVE',
      ownerId: { not: req.user.id },
      id: { notIn: takenIds },
      ...(typeFilter ? { type: typeFilter } : {}),
    },
    orderBy: [
      { type: 'asc' },
      { createdAt: 'desc' },
    ],
    take: limit,
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  const tasks = campaigns
    .filter((campaign) => Number(campaign.completed) < Number(campaign.quantity))
    .map((campaign) => ({
      id: campaign.id,
      type: campaign.type,
      targetUrl: campaign.targetUrl,
      targetUsername: campaign.targetUsername,
      commentText: campaign.commentText,
      rewardPoints: Number(campaign.perTaskReward),
      quantity: campaign.quantity,
      completed: campaign.completed,
      status: campaign.status,
      owner: {
        id: campaign.owner.id,
        name: campaign.owner.name,
        avatar: campaign.owner.avatarUrl,
      },
    }));

  res.json({ success: true, tasks, count: tasks.length });
});

const execute = asyncHandler(async (req, res) => {
  const { campaignId } = req.body;
  if (!campaignId) throw new AppError('campaignId required', 400);

  const last = await prisma.task.findFirst({
    where: { executorId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });

  if (
    last &&
    Date.now() - last.createdAt.getTime() < env.TASK_COOLDOWN_SECONDS * 1000
  ) {
    throw new AppError(
      `Please wait ${env.TASK_COOLDOWN_SECONDS}s between tasks`,
      429,
      'COOLDOWN',
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (campaign.status !== 'ACTIVE') throw new AppError('Campaign not active', 400);
    if (campaign.ownerId === req.user.id) {
      throw new AppError('Cannot execute own campaign', 403);
    }
    if (Number(campaign.completed) >= Number(campaign.quantity)) {
      throw new AppError('Campaign full', 400);
    }

    let task;
    try {
      task = await tx.task.create({
        data: {
          campaignId,
          executorId: req.user.id,
          rewardPoints: campaign.perTaskReward,
          status: 'VERIFIED',
          verifiedAt: new Date(),
          ip: truthyIp(req),
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new AppError(
          'You already executed this campaign',
          409,
          'ALREADY_DONE',
        );
      }
      throw error;
    }

    const updatedCampaign = await tx.campaign.update({
      where: { id: campaignId },
      data: { completed: { increment: 1 } },
    });

    if (Number(updatedCampaign.completed) >= Number(updatedCampaign.quantity)) {
      await tx.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED' },
      });
    }

    return task;
  });

  const user = await adjustPoints(req.user.id, result.rewardPoints, 'TASK_REWARD', {
    refType: 'Task',
    refId: result.id,
    note: 'Task reward',
  });

  const notifySvc = require('../services/notifications.service');
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });

  if (campaign) {
    await notifySvc.notify(
      campaign.ownerId,
      'تقدّم في حملتك 🚀',
      `الحملة ${campaign.type} وصلت إلى ${campaign.completed}/${campaign.quantity}`,
      'info',
    );
    getIO()?.emit('campaign:progress', {
      campaignId,
      completed: campaign.completed,
      quantity: campaign.quantity,
    });
  }

  res.json({
    success: true,
    task: result,
    balance: user.points.toString(),
  });
});

const my = asyncHandler(async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { executorId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      campaign: {
        select: {
          type: true,
          targetUsername: true,
          targetUrl: true,
          commentText: true,
        },
      },
    },
  });

  res.json({ success: true, tasks });
});

module.exports = { feed, execute, my };
