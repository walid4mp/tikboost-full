const prisma = require('../config/db');
const { AppError } = require('../utils/errors');
const { adjustPoints } = require('./points.service');
const { notify } = require('./notifications.service');
const { getSettings, startOfUtcDay } = require('./appSettings.service');

function todayKey(date = new Date()) {
  return startOfUtcDay(date).toISOString();
}

function stateKey(userId) {
  return `gamification_state:${userId}`;
}

function normalizeState(input = {}) {
  const value = input && typeof input === 'object' ? input : {};
  return {
    dailyLogin: {
      lastClaimDay: String(value.dailyLogin?.lastClaimDay || ''),
      streak: Number.parseInt(String(value.dailyLogin?.streak ?? 0), 10) || 0,
    },
    chest: {
      lastOpenedDay: String(value.chest?.lastOpenedDay || ''),
      lastReward: value.chest?.lastReward || null,
    },
    dailyTaskClaims: value.dailyTaskClaims && typeof value.dailyTaskClaims === 'object'
      ? value.dailyTaskClaims
      : {},
    manualTaskProgress: value.manualTaskProgress && typeof value.manualTaskProgress === 'object'
      ? value.manualTaskProgress
      : {},
    achievementClaims: Array.isArray(value.achievementClaims) ? value.achievementClaims : [],
  };
}

async function getUserState(userId, client = prisma) {
  const row = await client.appSetting.findUnique({ where: { key: stateKey(userId) } });
  return normalizeState(row?.valueJson || {});
}

async function saveUserState(userId, state, client = prisma) {
  const next = normalizeState(state);
  await client.appSetting.upsert({
    where: { key: stateKey(userId) },
    update: { valueJson: next },
    create: { key: stateKey(userId), valueJson: next },
  });
  return next;
}

async function getCounters(userId, client = prisma, since = null) {
  const dateFilter = since ? { gte: since } : undefined;
  const [tasksCompleted, campaignsCreated, purchasesApproved, referralsCount] = await Promise.all([
    client.task.count({ where: { executorId: userId, status: 'VERIFIED', ...(dateFilter ? { createdAt: dateFilter } : {}) } }),
    client.campaign.count({ where: { ownerId: userId, ...(dateFilter ? { createdAt: dateFilter } : {}) } }),
    client.purchase.count({ where: { userId, status: 'APPROVED', ...(dateFilter ? { createdAt: dateFilter } : {}) } }),
    client.user.count({ where: { referredById: userId, ...(dateFilter ? { createdAt: dateFilter } : {}) } }),
  ]);

  return {
    tasksCompleted,
    campaignsCreated,
    purchasesApproved,
    referralsCount,
  };
}

function applyLevelMultiplier(baseReward, levelInfo) {
  const multiplier = Number(levelInfo?.multiplier || 1);
  return BigInt(Math.max(0, Math.round(Number(baseReward) * multiplier)));
}

function computeXpSnapshot(user, counters, settings) {
  const earned = Number(user.totalEarned || 0n);
  const spent = Number(user.totalSpent || 0n);
  const xpSettings = settings.levels?.xp || {};
  const taskRewardXp = Number(xpSettings.taskRewardXp ?? 8);
  const campaignCreateXp = Number(xpSettings.campaignCreateXp ?? 12);
  const purchaseXp = Number(xpSettings.purchaseXp ?? 25);
  const referralXp = Number(xpSettings.referralXp ?? 30);

  return Math.max(
    0,
    Math.floor(earned / 100) +
      (counters.tasksCompleted * taskRewardXp) +
      (counters.campaignsCreated * campaignCreateXp) +
      (counters.purchasesApproved * purchaseXp) +
      (counters.referralsCount * referralXp) +
      Math.floor(spent / 500),
  );
}

function computeLevelInfo(settings, xp) {
  const definitions = Array.isArray(settings.levels?.definitions)
    ? settings.levels.definitions
    : [];
  const sorted = definitions
    .map((item, index) => ({
      key: String(item.key || `level_${index + 1}`),
      name: String(item.name || `Level ${index + 1}`),
      minXp: Number(item.minXp ?? 0),
      multiplier: Number(item.multiplier ?? 1),
      icon: String(item.icon || '⭐'),
    }))
    .sort((a, b) => a.minXp - b.minXp);

  const current = sorted.reduce((acc, item) => (xp >= item.minXp ? item : acc), sorted[0] || {
    key: 'starter',
    name: 'Starter',
    minXp: 0,
    multiplier: 1,
    icon: '⭐',
  });
  const next = sorted.find((item) => item.minXp > current.minXp) || null;

  return {
    ...current,
    xp,
    nextLevel: next,
    progressPercent: next
      ? Math.max(0, Math.min(100, Math.round(((xp - current.minXp) / Math.max(1, next.minXp - current.minXp)) * 100)))
      : 100,
  };
}

async function buildGamificationProfile(userId, client = prisma) {
  const settings = await getSettings(client);
  const [user, state, counters] = await Promise.all([
    client.user.findUnique({ where: { id: userId } }),
    getUserState(userId, client),
    getCounters(userId, client),
  ]);
  if (!user) throw new AppError('User not found', 404);

  const xp = computeXpSnapshot(user, counters, settings);
  const level = computeLevelInfo(settings, xp);
  return {
    settings,
    user,
    state,
    counters,
    xp,
    level,
    profile: {
      xp,
      level,
      counters,
      streak: state.dailyLogin.streak,
      points: user.points.toString(),
      totalEarned: user.totalEarned.toString(),
      totalSpent: user.totalSpent.toString(),
    },
  };
}

function buildDailyTaskStatus(settings, usage, state, dayCounters) {
  const items = (Array.isArray(settings.dailyTasks?.items) ? settings.dailyTasks.items : []).filter((item) => item.type !== 'review_app' || settings.notifications?.reviewPromptEnabled !== false);
  const day = todayKey();
  const claims = state.dailyTaskClaims?.[day] || {};
  const manualProgress = state.manualTaskProgress?.[day] || {};

  return items.map((item) => {
    const key = String(item.key);
    const target = Number(item.target ?? 1);
    let progress = 0;

    switch (item.type) {
      case 'login':
        progress = state.dailyLogin.lastClaimDay === day ? 1 : 0;
        break;
      case 'rewarded_ad':
        progress = Number(usage.rewardedAdsClaimed || 0);
        break;
      case 'complete_task':
        progress = dayCounters.tasksCompleted;
        break;
      case 'create_campaign':
        progress = dayCounters.campaignsCreated;
        break;
      case 'invite_friend':
        progress = dayCounters.referralsCount;
        break;
      case 'manual_share':
      case 'review_app':
        progress = Number(manualProgress[key] || 0);
        break;
      default:
        progress = 0;
    }

    return {
      key,
      type: String(item.type || key),
      title: String(item.title || key),
      description: String(item.description || ''),
      rewardPoints: Number(item.rewardPoints || 0),
      target,
      progress,
      completed: progress >= target,
      claimed: claims[key] === true,
      manual: ['manual_share', 'review_app'].includes(item.type),
      url: item.url || '',
    };
  });
}

async function claimDailyTask(userId, key, client = prisma) {
  const { settings, state, level } = await buildGamificationProfile(userId, client);
  const usage = await client.dailyUsage.upsert({
    where: { userId_dayKey: { userId, dayKey: startOfUtcDay() } },
    update: {},
    create: { userId, dayKey: startOfUtcDay() },
  });
  const dayCounters = await getCounters(userId, client, startOfUtcDay());
  const items = buildDailyTaskStatus(settings, usage, state, dayCounters);
  const item = items.find((entry) => entry.key === key);
  if (!item) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
  if (!item.completed) throw new AppError('Task is not completed yet', 400, 'TASK_NOT_COMPLETED');
  if (item.claimed) throw new AppError('Task reward already claimed', 409, 'TASK_ALREADY_CLAIMED');

  const rewardPoints = applyLevelMultiplier(item.rewardPoints, level);
  const day = todayKey();
  const nextState = normalizeState(state);
  nextState.dailyTaskClaims[day] = { ...(nextState.dailyTaskClaims[day] || {}), [key]: true };
  await saveUserState(userId, nextState, client);

  const user = await adjustPoints(userId, rewardPoints, 'ADMIN_GRANT', {
    refType: 'DailyTask',
    refId: key,
    note: `Daily task reward: ${key}`,
  });
  await notify(userId, 'تمت إضافة مكافأة المهمة اليومية', `حصلت على ${rewardPoints.toString()} نقطة`, 'reward');

  return { item, rewardPoints, user };
}

async function markManualTask(userId, key, client = prisma) {
  const state = await getUserState(userId, client);
  const day = todayKey();
  const nextState = normalizeState(state);
  const current = Number(nextState.manualTaskProgress?.[day]?.[key] || 0);
  nextState.manualTaskProgress[day] = {
    ...(nextState.manualTaskProgress[day] || {}),
    [key]: current + 1,
  };
  await saveUserState(userId, nextState, client);
  return nextState;
}

function buildAchievementStatus(settings, counters, state) {
  const items = Array.isArray(settings.achievements?.items) ? settings.achievements.items : [];
  const claimedSet = new Set(state.achievementClaims || []);

  return items.map((item) => {
    const key = String(item.key);
    const target = Number(item.target ?? 1);
    let progress = 0;
    switch (item.metric) {
      case 'tasks_completed':
        progress = counters.tasksCompleted;
        break;
      case 'campaigns_created':
        progress = counters.campaignsCreated;
        break;
      case 'purchases_approved':
        progress = counters.purchasesApproved;
        break;
      case 'referrals_count':
        progress = counters.referralsCount;
        break;
      default:
        progress = 0;
    }
    return {
      key,
      title: String(item.title || key),
      description: String(item.description || ''),
      rewardPoints: Number(item.rewardPoints || 0),
      metric: String(item.metric || ''),
      target,
      progress,
      completed: progress >= target,
      claimed: claimedSet.has(key),
    };
  });
}

async function claimAchievement(userId, key, client = prisma) {
  const { settings, state, counters, level } = await buildGamificationProfile(userId, client);
  const items = buildAchievementStatus(settings, counters, state);
  const item = items.find((entry) => entry.key === key);
  if (!item) throw new AppError('Achievement not found', 404, 'ACHIEVEMENT_NOT_FOUND');
  if (!item.completed) throw new AppError('Achievement not completed', 400, 'ACHIEVEMENT_NOT_COMPLETED');
  if (item.claimed) throw new AppError('Achievement already claimed', 409, 'ACHIEVEMENT_ALREADY_CLAIMED');

  const rewardPoints = applyLevelMultiplier(item.rewardPoints, level);
  const nextState = normalizeState(state);
  nextState.achievementClaims = Array.from(new Set([...nextState.achievementClaims, key]));
  await saveUserState(userId, nextState, client);

  const user = await adjustPoints(userId, rewardPoints, 'ADMIN_GRANT', {
    refType: 'Achievement',
    refId: key,
    note: `Achievement reward: ${key}`,
  });
  await notify(userId, 'تم استلام مكافأة الإنجاز', `حصلت على ${rewardPoints.toString()} نقطة`, 'reward');

  return { item, rewardPoints, user };
}

async function claimDailyLogin(userId, client = prisma) {
  const { settings, state, level } = await buildGamificationProfile(userId, client);
  const day = todayKey();
  if (state.dailyLogin.lastClaimDay === day) {
    throw new AppError('Daily login already claimed', 409, 'LOGIN_ALREADY_CLAIMED');
  }

  const yesterday = new Date(startOfUtcDay().getTime() - 86400000).toISOString();
  const streak = state.dailyLogin.lastClaimDay === yesterday ? state.dailyLogin.streak + 1 : 1;
  const rewardPoints = applyLevelMultiplier(settings.rewards.loginRewardPoints || 100, level);

  const nextState = normalizeState(state);
  nextState.dailyLogin.lastClaimDay = day;
  nextState.dailyLogin.streak = streak;
  await saveUserState(userId, nextState, client);

  const user = await adjustPoints(userId, rewardPoints, 'ADMIN_GRANT', {
    refType: 'DailyLogin',
    refId: day,
    note: 'Daily login reward',
  });
  await notify(userId, 'مكافأة الدخول اليومي', `تمت إضافة ${rewardPoints.toString()} نقطة إلى رصيدك`, 'reward');

  return {
    rewardPoints,
    streak,
    user,
    claimed: true,
  };
}

function chooseWeighted(items) {
  const enabled = items.filter((item) => item && item.enabled !== false);
  if (!enabled.length) return null;
  const total = enabled.reduce((sum, item) => sum + Number(item.weight || 1), 0);
  let ticket = Math.random() * total;
  for (const item of enabled) {
    ticket -= Number(item.weight || 1);
    if (ticket <= 0) return item;
  }
  return enabled[enabled.length - 1];
}

function buildChestStatus(settings, state) {
  const day = todayKey();
  const available = state.chest.lastOpenedDay !== day;
  return {
    enabled: settings.chest?.enabled !== false,
    available,
    lastOpenedDay: state.chest.lastOpenedDay || null,
    lastReward: state.chest.lastReward || null,
    nextAvailableAt: available ? null : new Date(startOfUtcDay().getTime() + 86400000).toISOString(),
  };
}

async function openDailyChest(userId, client = prisma) {
  const { settings, state, level } = await buildGamificationProfile(userId, client);
  const chestStatus = buildChestStatus(settings, state);
  if (!chestStatus.enabled) throw new AppError('Daily chest disabled', 403, 'CHEST_DISABLED');
  if (!chestStatus.available) throw new AppError('Daily chest already opened', 409, 'CHEST_ALREADY_OPENED');

  const reward = chooseWeighted(Array.isArray(settings.chest?.rewards) ? settings.chest.rewards : []);
  if (!reward) throw new AppError('No chest rewards configured', 500, 'CHEST_REWARD_MISSING');

  const dayKey = startOfUtcDay();
  const nextState = normalizeState(state);
  nextState.chest.lastOpenedDay = todayKey();

  let result = {
    type: String(reward.type || 'points'),
    rewardPoints: 0n,
    extraSpins: 0,
  };

  if (reward.type === 'extra_spin') {
    const extraSpins = Math.max(1, Number(reward.extraSpins || 1));
    await client.dailyUsage.upsert({
      where: { userId_dayKey: { userId, dayKey } },
      update: { wheelExtraSpinsEarned: { increment: extraSpins } },
      create: { userId, dayKey, wheelExtraSpinsEarned: extraSpins },
    });
    result = { type: 'extra_spin', rewardPoints: 0n, extraSpins };
  } else {
    const rewardPoints = applyLevelMultiplier(reward.points || 0, level);
    await adjustPoints(userId, rewardPoints, 'ADMIN_GRANT', {
      refType: 'DailyChest',
      refId: todayKey(),
      note: 'Daily chest reward',
    });
    result = { type: 'points', rewardPoints, extraSpins: 0 };
  }

  nextState.chest.lastReward = {
    type: result.type,
    rewardPoints: result.rewardPoints.toString(),
    extraSpins: result.extraSpins,
    claimedAt: new Date().toISOString(),
  };
  await saveUserState(userId, nextState, client);

  await notify(userId, 'تم فتح الصندوق اليومي', result.type === 'extra_spin'
    ? `حصلت على ${result.extraSpins} لفة إضافية`
    : `حصلت على ${result.rewardPoints.toString()} نقطة`, 'reward');

  return {
    ...nextState.chest.lastReward,
    type: result.type,
    rewardPoints: result.rewardPoints,
    extraSpins: result.extraSpins,
  };
}

module.exports = {
  applyLevelMultiplier,
  computeXpSnapshot,
  computeLevelInfo,
  getCounters,
  buildGamificationProfile,
  buildDailyTaskStatus,
  claimDailyTask,
  markManualTask,
  buildAchievementStatus,
  claimAchievement,
  claimDailyLogin,
  openDailyChest,
  buildChestStatus,
  chooseWeighted,
  todayKey,
  getUserState,
  saveUserState,
};
