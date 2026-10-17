const prisma = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { adjustPoints } = require('../services/points.service');
const { getIO } = require('../sockets/io');
const { truthyIp, asyncHandler } = require('../utils/helpers');
const {
  buildAudienceWhere,
  campaignMatchesUser,
  ensureProfileComplete,
} = require('../utils/audience');

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
  const audienceWhere = buildAudienceWhere(req.user);

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: 'ACTIVE',
      ownerId: { not: req.user.id },
      id: { notIn: takenIds },
      ...(typeFilter ? { type: typeFilter } : {}),
      ...audienceWhere,
    },
    orderBy: [{ vipPriority: 'desc' }, { createdAt: 'desc' }],
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
      rewardPoints: (Number(campaign.perTaskReward) + Number(campaign.vipBonusPoints || 0n)),
      vip: Boolean(campaign.vipPriority),
      vipBonusPoints: Number(campaign.vipBonusPoints || 0n),
      quantity: campaign.quantity,
      completed: campaign.completed,
      status: campaign.status,
      targetGender: campaign.targetGender,
      targetCountry: campaign.targetCountry,
      vipPriority: campaign.vipPriority,
      vipBonusPoints: campaign.vipBonusPoints.toString(),
      owner: {
        id: campaign.owner.id,
        name: campaign.owner.name,
        avatar: campaign.owner.avatarUrl,
      },
    }));

  res.json({ success: true, tasks, count: tasks.length });
});

const execute = asyncHandler(async (req, res) => {
  const { campaignId, deviceFingerprint } = req.body;
  if (!campaignId) throw new AppError('campaignId required', 400);

  const profile = ensureProfileComplete(req.user);
  if (!profile.isComplete) {
    throw new AppError('Complete your profile before executing tasks', 403, 'PROFILE_INCOMPLETE', profile);
  }

  const last = await prisma.task.findFirst({
    where: { executorId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });

  if (last && Date.now() - last.createdAt.getTime() < env.TASK_COOLDOWN_SECONDS * 1000) {
    throw new AppError(`Please wait ${env.TASK_COOLDOWN_SECONDS}s between tasks`, 429, 'COOLDOWN');
  }

  let result;
  try {
    result = await prisma.$transaction(
      async (tx) => {
        const campaign = await tx.campaign.findUnique({ where: { id: campaignId } });
        if (!campaign) throw new AppError('Campaign not found', 404);
        if (campaign.status !== 'ACTIVE') throw new AppError('Campaign not active', 400);
        if (campaign.ownerId === req.user.id) {
          throw new AppError('Cannot execute own campaign', 403);
        }
        if (Number(campaign.completed) >= Number(campaign.quantity)) {
          throw new AppError('Campaign full', 400);
        }
        if (!campaignMatchesUser(campaign, req.user)) {
          throw new AppError('You are not eligible for this campaign', 403, 'AUDIENCE_MISMATCH');
        }

        const alreadyExecuted = await tx.task.findUnique({
          where: { campaignId_executorId: { campaignId, executorId: req.user.id } },
        });
        if (alreadyExecuted) {
          throw new AppError('You already executed this campaign', 409, 'ALREADY_DONE');
        }

        let task;
        try {
          task = await tx.task.create({
            data: {
              campaignId,
              executorId: req.user.id,
              rewardPoints: BigInt(campaign.perTaskReward) + BigInt(campaign.vipBonusPoints || 0n),
              status: 'VERIFIED',
              verifiedAt: new Date(),
              ip: truthyIp(req),
              deviceFingerprint: deviceFingerprint ? String(deviceFingerprint).trim().slice(0, 255) : null,
            },
          });
        } catch (error) {
          if (error.code === 'P2002') {
            throw new AppError('You already executed this campaign', 409, 'ALREADY_DONE');
          }
          throw error;
        }

        const updatedCampaign = await tx.campaign.update({
          where: { id: campaignId },
          data: { completed: { increment: 1 } },
        });

        if (Number(updatedCampaign.completed) > Number(updatedCampaign.quantity)) {
          throw new AppError('Campaign full', 400);
        }

        const finalCampaign = Number(updatedCampaign.completed) >= Number(updatedCampaign.quantity)
          ? await tx.campaign.update({
              where: { id: campaignId },
              data: { status: 'COMPLETED' },
            })
          : updatedCampaign;

        return { task, campaign: finalCampaign };
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (error?.code === 'P2034') {
      throw new AppError('Please retry task execution', 409, 'RETRY_EXECUTION');
    }
    throw error;
  }

  const user = await adjustPoints(req.user.id, result.task.rewardPoints, 'TASK_REWARD', {
    refType: 'Task',
    refId: result.task.id,
    note: 'Task reward',
  });

  const notifySvc = require('../services/notifications.service');
  await notifySvc.notify(
    result.campaign.ownerId,
    'تقدّم في حملتك 🚀',
    `الحملة ${result.campaign.type} وصلت إلى ${result.campaign.completed}/${result.campaign.quantity}${result.campaign.vipPriority ? ' • VIP PRO 👑' : ''}`,
    'info',
  );
  getIO()?.emit('campaign:progress', {
    campaignId,
    completed: result.campaign.completed,
    quantity: result.campaign.quantity,
  });

  res.json({
    success: true,
    task: result.task,
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
          targetGender: true,
          targetCountry: true,
        },
      },
    },
  });

  res.json({ success: true, tasks });
});

module.exports = { feed, execute, my };
