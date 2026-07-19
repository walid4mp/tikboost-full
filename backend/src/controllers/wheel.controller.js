const prisma = require('../config/db');
const { AppError } = require('../utils/errors');
const { adjustPoints } = require('../services/points.service');
const { asyncHandler } = require('../utils/helpers');

const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12h

const prizes = asyncHandler(async (_req, res) => {
  const list = await prisma.wheelPrize.findMany({
    where: { isActive: true }, orderBy: { sortOrder: 'asc' },
  });
  res.json({ success: true, prizes: list.map(p => ({ ...p, points: p.points.toString() })) });
});

const spin = asyncHandler(async (req, res) => {
  const last = await prisma.spinLog.findFirst({
    where: { userId: req.user.id }, orderBy: { createdAt: 'desc' },
  });
  if (last && (Date.now() - last.createdAt.getTime()) < COOLDOWN_MS) {
    const remain = COOLDOWN_MS - (Date.now() - last.createdAt.getTime());
    throw new AppError(`Spin again in ${Math.ceil(remain/60000)} minutes`, 429, 'WHEEL_COOLDOWN');
  }

  const activePrizes = await prisma.wheelPrize.findMany({ where: { isActive: true } });
  if (!activePrizes.length) throw new AppError('No prizes configured', 500);
  const totalWeight = activePrizes.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * totalWeight;
  let chosen = activePrizes[0];
  for (const p of activePrizes) {
    if (r < p.weight) { chosen = p; break; }
    r -= p.weight;
  }

  await prisma.spinLog.create({
    data: { userId: req.user.id, prizeId: chosen.id, points: chosen.points },
  });
  await adjustPoints(req.user.id, chosen.points, 'SPIN_REWARD', {
    refType: 'WheelPrize', refId: chosen.id, note: `Lucky wheel: ${chosen.label}`,
  });
  res.json({ success: true, prize: chosen, points: chosen.points.toString() });
});

module.exports = { prizes, spin };
