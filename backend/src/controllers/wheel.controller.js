const prisma = require('../config/db');
const { AppError } = require('../utils/errors');
const { adjustPoints } = require('../services/points.service');
const { asyncHandler } = require('../utils/helpers');
const { getSettings, getOrCreateDailyUsage } = require('../services/appSettings.service');
const { buildRewardStatus } = require('./rewards.controller');

const prizes = asyncHandler(async (req, res) => {
  const [list, settings, usage] = await Promise.all([
    prisma.wheelPrize.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    getSettings(),
    getOrCreateDailyUsage(req.user.id),
  ]);

  res.json({
    success: true,
    prizes: list.map((p) => ({ ...p, points: p.points.toString() })),
    rewards: buildRewardStatus(settings, usage),
    confettiThreshold: settings.wheel.confettiThreshold,
  });
});

const spin = asyncHandler(async (req, res) => {
  const useExtraSpin = Boolean(req.body?.useExtraSpin);
  const [settings, usage, activePrizes] = await Promise.all([
    getSettings(),
    getOrCreateDailyUsage(req.user.id),
    prisma.wheelPrize.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
  ]);

  if (!activePrizes.length) throw new AppError('No prizes configured', 500);

  if (useExtraSpin) {
    const available = Number(usage.wheelExtraSpinsEarned || 0) - Number(usage.wheelExtraSpinsUsed || 0);
    if (available <= 0) {
      throw new AppError('لا توجد تدويرات إضافية متاحة حالياً.', 429, 'NO_EXTRA_SPINS');
    }
  } else if (Number(usage.wheelDailySpinsUsed || 0) >= settings.wheel.dailySpinsLimit) {
    throw new AppError('لقد استخدمت جميع تدويراتك اليومية.', 429, 'DAILY_SPIN_LIMIT');
  }

  const chosen = choosePrize(activePrizes);

  await prisma.$transaction(async (tx) => {
    const daily = await tx.dailyUsage.findUnique({
      where: { userId_dayKey: { userId: req.user.id, dayKey: usage.dayKey } },
    });
    if (!daily) throw new AppError('Daily usage not found', 500);

    if (useExtraSpin) {
      const available = Number(daily.wheelExtraSpinsEarned || 0) - Number(daily.wheelExtraSpinsUsed || 0);
      if (available <= 0) throw new AppError('لا توجد تدويرات إضافية متاحة حالياً.', 429, 'NO_EXTRA_SPINS');
    } else if (Number(daily.wheelDailySpinsUsed || 0) >= settings.wheel.dailySpinsLimit) {
      throw new AppError('لقد استخدمت جميع تدويراتك اليومية.', 429, 'DAILY_SPIN_LIMIT');
    }

    await tx.spinLog.create({
      data: {
        userId: req.user.id,
        prizeId: chosen.id,
        points: chosen.points,
        isExtraSpin: useExtraSpin,
      },
    });

    await tx.dailyUsage.update({
      where: { userId_dayKey: { userId: req.user.id, dayKey: usage.dayKey } },
      data: {
        wheelDailySpinsUsed: useExtraSpin ? undefined : { increment: 1 },
        wheelExtraSpinsUsed: useExtraSpin ? { increment: 1 } : undefined,
        wheelPointsWon: { increment: chosen.points },
      },
    });
  });

  const user = await adjustPoints(req.user.id, chosen.points, 'SPIN_REWARD', {
    refType: 'WheelPrize',
    refId: chosen.id,
    note: `Lucky wheel: ${chosen.label}`,
  });

  const latestSettings = await getSettings();
  const latestUsage = await getOrCreateDailyUsage(req.user.id);

  res.json({
    success: true,
    prize: { ...chosen, points: chosen.points.toString() },
    points: chosen.points.toString(),
    balance: user.points.toString(),
    isExtraSpin: useExtraSpin,
    confetti: Number(chosen.points) >= latestSettings.wheel.confettiThreshold,
    rewards: buildRewardStatus(latestSettings, latestUsage),
  });
});

function choosePrize(activePrizes) {
  const totalWeight = activePrizes.reduce((sum, prize) => sum + prize.weight, 0);
  let current = Math.random() * totalWeight;
  let chosen = activePrizes[0];
  for (const prize of activePrizes) {
    if (current < prize.weight) {
      chosen = prize;
      break;
    }
    current -= prize.weight;
  }
  return chosen;
}

module.exports = { prizes, spin };
