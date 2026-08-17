const prisma = require('../config/db');
const { AppError } = require('../utils/errors');
const { adjustPoints } = require('../services/points.service');
const { asyncHandler } = require('../utils/helpers');
const {
  getSettings,
  getOrCreateDailyUsage,
  startOfUtcDay,
} = require('../services/appSettings.service');
const {
  buildGamificationProfile,
  claimDailyLogin,
  buildChestStatus,
  openDailyChest,
  buildDailyTaskStatus,
  claimDailyTask,
  markManualTask,
  buildAchievementStatus,
  claimAchievement,
  getCounters,
  applyLevelMultiplier,
  getUserState,
} = require('../services/gamification.service');

const DAILY_REWARD = 'DAILY_POINTS';
const EXTRA_WHEEL = 'EXTRA_WHEEL_SPIN';

const status = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const usage = await getOrCreateDailyUsage(req.user.id);
  const [profileData, state, dayCounters] = await Promise.all([
    buildGamificationProfile(req.user.id),
    getUserState(req.user.id),
    getCounters(req.user.id, prisma, startOfUtcDay()),
  ]);

  res.json({
    success: true,
    rewards: buildRewardStatus(settings, usage),
    level: profileData.level,
    profile: profileData.profile,
    chest: buildChestStatus(settings, state),
    dailyLogin: {
      claimedToday: state.dailyLogin.lastClaimDay === startOfUtcDay().toISOString(),
      streak: state.dailyLogin.streak,
      rewardPoints: settings.rewards.loginRewardPoints,
    },
    dailyTasks: {
      items: buildDailyTaskStatus(settings, usage, state, dayCounters),
    },
    achievements: buildAchievementStatus(settings, profileData.counters, state),
  });
});

const profile = asyncHandler(async (req, res) => {
  const data = await buildGamificationProfile(req.user.id);
  res.json({ success: true, profile: data.profile, level: data.level });
});

const startDailyReward = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const usage = await getOrCreateDailyUsage(req.user.id);
  const rewards = buildRewardStatus(settings, usage);

  if (rewards.ads.remaining <= 0) {
    throw new AppError(
      'لقد وصلت إلى الحد الأقصى للإعلانات اليومية. عد غداً للحصول على المزيد من النقاط.',
      429,
      'DAILY_AD_LIMIT_REACHED',
    );
  }

  const session = await createSession({
    userId: req.user.id,
    type: DAILY_REWARD,
    points: BigInt(settings.rewards.pointsPerRewardedAd),
    extraSpins: 0,
    expiryMinutes: settings.rewards.rewardSessionExpiryMinutes,
  });

  res.json({
    success: true,
    sessionId: session.id,
    rewardPoints: session.points.toString(),
    expiresAt: session.expiresAt,
  });
});

const claimDailyReward = asyncHandler(async (req, res) => {
  const sessionId = String(req.body.sessionId || '').trim();
  if (!sessionId) throw new AppError('sessionId required', 400);

  const reward = await prisma.$transaction(async (tx) => {
    const session = await tx.rewardSession.findUnique({ where: { id: sessionId } });
    validateSession(session, req.user.id, DAILY_REWARD);

    await tx.rewardSession.update({
      where: { id: session.id },
      data: { status: 'CLAIMED', claimedAt: new Date() },
    });

    await tx.dailyUsage.upsert({
      where: { userId_dayKey: { userId: req.user.id, dayKey: session.dayKey } },
      update: {
        rewardedAdsClaimed: { increment: 1 },
        rewardedAdPoints: { increment: session.points },
      },
      create: {
        userId: req.user.id,
        dayKey: session.dayKey,
        rewardedAdsClaimed: 1,
        rewardedAdPoints: session.points,
      },
    });

    return session;
  });

  const profileData = await buildGamificationProfile(req.user.id);
  const adjustedReward = applyLevelMultiplier(reward.points, profileData.level);
  const user = await adjustPoints(req.user.id, adjustedReward, 'ADMIN_GRANT', {
    refType: 'RewardSession',
    refId: reward.id,
    note: 'Rewarded ad daily bonus',
  });

  const settings = await getSettings();
  const usage = await getOrCreateDailyUsage(req.user.id);

  res.json({
    success: true,
    rewardPoints: adjustedReward.toString(),
    balance: user.points.toString(),
    rewards: buildRewardStatus(settings, usage),
  });
});

const startWheelExtraSpin = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const usage = await getOrCreateDailyUsage(req.user.id);
  const rewards = buildRewardStatus(settings, usage);

  if (rewards.wheel.extraEarnedRemaining <= 0) {
    throw new AppError(
      'لقد وصلت إلى الحد الأقصى للتدويرات الإضافية اليوم.',
      429,
      'WHEEL_EXTRA_LIMIT_REACHED',
    );
  }

  const session = await createSession({
    userId: req.user.id,
    type: EXTRA_WHEEL,
    points: 0n,
    extraSpins: 1,
    expiryMinutes: settings.rewards.rewardSessionExpiryMinutes,
  });

  res.json({
    success: true,
    sessionId: session.id,
    extraSpins: session.extraSpins,
    expiresAt: session.expiresAt,
  });
});

const claimWheelExtraSpin = asyncHandler(async (req, res) => {
  const sessionId = String(req.body.sessionId || '').trim();
  if (!sessionId) throw new AppError('sessionId required', 400);

  await prisma.$transaction(async (tx) => {
    const session = await tx.rewardSession.findUnique({ where: { id: sessionId } });
    validateSession(session, req.user.id, EXTRA_WHEEL);

    await tx.rewardSession.update({
      where: { id: session.id },
      data: { status: 'CLAIMED', claimedAt: new Date() },
    });

    await tx.dailyUsage.upsert({
      where: { userId_dayKey: { userId: req.user.id, dayKey: session.dayKey } },
      update: { wheelExtraSpinsEarned: { increment: session.extraSpins } },
      create: {
        userId: req.user.id,
        dayKey: session.dayKey,
        wheelExtraSpinsEarned: session.extraSpins,
      },
    });
  });

  const settings = await getSettings();
  const usage = await getOrCreateDailyUsage(req.user.id);

  res.json({
    success: true,
    rewards: buildRewardStatus(settings, usage),
  });
});

const claimLoginReward = asyncHandler(async (req, res) => {
  const result = await claimDailyLogin(req.user.id);
  res.json({
    success: true,
    rewardPoints: result.rewardPoints.toString(),
    streak: result.streak,
    balance: result.user.points.toString(),
  });
});

const chestStatus = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const state = await getUserState(req.user.id);
  res.json({ success: true, chest: buildChestStatus(settings, state) });
});

const openChest = asyncHandler(async (req, res) => {
  const result = await openDailyChest(req.user.id);
  res.json({
    success: true,
    type: result.type,
    rewardPoints: result.rewardPoints.toString(),
    extraSpins: result.extraSpins,
    chest: { available: false, lastReward: result },
  });
});

const dailyTasks = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const usage = await getOrCreateDailyUsage(req.user.id);
  const state = await getUserState(req.user.id);
  const dayCounters = await getCounters(req.user.id, prisma, startOfUtcDay());
  res.json({ success: true, items: buildDailyTaskStatus(settings, usage, state, dayCounters) });
});

const claimTaskReward = asyncHandler(async (req, res) => {
  const key = String(req.params.key || '').trim();
  if (!key) throw new AppError('Task key required', 400);
  const result = await claimDailyTask(req.user.id, key);
  res.json({ success: true, rewardPoints: result.rewardPoints.toString(), item: result.item, balance: result.user.points.toString() });
});

const completeManualTask = asyncHandler(async (req, res) => {
  const key = String(req.params.key || '').trim();
  if (!key) throw new AppError('Task key required', 400);
  const settings = await getSettings();
  const configured = Array.isArray(settings.dailyTasks?.items) && settings.dailyTasks.items.some((item) => item.key === key && ['manual_share', 'review_app'].includes(item.type));
  if (!configured) throw new AppError('Manual task not found', 404, 'MANUAL_TASK_NOT_FOUND');
  await markManualTask(req.user.id, key);
  const usage = await getOrCreateDailyUsage(req.user.id);
  const state = await getUserState(req.user.id);
  const dayCounters = await getCounters(req.user.id, prisma, startOfUtcDay());
  res.json({ success: true, items: buildDailyTaskStatus(settings, usage, state, dayCounters) });
});

const achievements = asyncHandler(async (req, res) => {
  const data = await buildGamificationProfile(req.user.id);
  const state = await getUserState(req.user.id);
  res.json({ success: true, items: buildAchievementStatus(data.settings, data.counters, state) });
});

const claimAchievementReward = asyncHandler(async (req, res) => {
  const key = String(req.params.key || '').trim();
  if (!key) throw new AppError('Achievement key required', 400);
  const result = await claimAchievement(req.user.id, key);
  res.json({ success: true, rewardPoints: result.rewardPoints.toString(), item: result.item, balance: result.user.points.toString() });
});

async function createSession({ userId, type, points, extraSpins, expiryMinutes }) {
  const dayKey = startOfUtcDay();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);

  await prisma.rewardSession.updateMany({
    where: {
      userId,
      type,
      status: 'STARTED',
      expiresAt: { lt: now },
    },
    data: { status: 'EXPIRED' },
  });

  const existing = await prisma.rewardSession.findFirst({
    where: {
      userId,
      type,
      status: 'STARTED',
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) return existing;

  return prisma.rewardSession.create({
    data: {
      userId,
      type,
      points,
      extraSpins,
      dayKey,
      expiresAt,
    },
  });
}

function validateSession(session, userId, expectedType) {
  if (!session) throw new AppError('Reward session not found', 404);
  if (session.userId !== userId) throw new AppError('Forbidden', 403);
  if (session.type !== expectedType) throw new AppError('Invalid reward session', 400);
  if (session.status !== 'STARTED') throw new AppError('Reward session already used', 409);
  if (session.expiresAt <= new Date()) throw new AppError('Reward session expired', 410);
}

function buildRewardStatus(settings, usage) {
  const adsLimit = settings.rewards.dailyRewardAdsLimit;
  const adsUsed = Number(usage.rewardedAdsClaimed || 0);
  const extraLimit = settings.wheel.maxExtraSpinsPerDay;
  const extraEarned = Number(usage.wheelExtraSpinsEarned || 0);
  const extraUsed = Number(usage.wheelExtraSpinsUsed || 0);
  const dailySpinsLimit = settings.wheel.dailySpinsLimit;
  const dailySpinsUsed = Number(usage.wheelDailySpinsUsed || 0);

  return {
    ads: {
      limit: adsLimit,
      used: adsUsed,
      remaining: Math.max(0, adsLimit - adsUsed),
      rewardPoints: settings.rewards.pointsPerRewardedAd,
      distributedPoints: (usage.rewardedAdPoints || 0n).toString(),
    },
    wheel: {
      dailyLimit: dailySpinsLimit,
      dailyUsed: dailySpinsUsed,
      dailyRemaining: Math.max(0, dailySpinsLimit - dailySpinsUsed),
      extraLimit,
      extraEarned,
      extraUsed,
      extraEarnedRemaining: Math.max(0, extraLimit - extraEarned),
      extraAvailableToUse: Math.max(0, extraEarned - extraUsed),
      extraRemainingToUseToday: Math.max(0, extraLimit - extraUsed),
    },
  };
}

module.exports = {
  status,
  profile,
  startDailyReward,
  claimDailyReward,
  startWheelExtraSpin,
  claimWheelExtraSpin,
  claimLoginReward,
  chestStatus,
  openChest,
  dailyTasks,
  claimTaskReward,
  completeManualTask,
  achievements,
  claimAchievementReward,
  buildRewardStatus,
};
