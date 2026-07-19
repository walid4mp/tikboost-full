const prisma = require('../config/db');
const { AppError } = require('../utils/errors');
const { adjustPoints } = require('../services/points.service');
const { asyncHandler } = require('../utils/helpers');

const list = asyncHandler(async (_req, res) => {
  const pkgs = await prisma.pointPackage.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ success: true, packages: pkgs.map(p => ({ ...p, points: p.points.toString(), bonusPoints: p.bonusPoints.toString() })) });
});

const purchase = asyncHandler(async (req, res) => {
  const { packageId, method, reference } = req.body;
  const pkg = await prisma.pointPackage.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.isActive) throw new AppError('Package not available', 404);
  const points = BigInt(pkg.points) + BigInt(pkg.bonusPoints);
  const purchase = await prisma.purchase.create({
    data: {
      userId: req.user.id, packageId: pkg.id,
      pointsGiven: points, priceCents: pkg.priceCents, currency: pkg.currency,
      method: method || 'manual_transfer', reference: reference || null,
      status: 'PENDING',
    },
  });
  res.status(201).json({
    success: true,
    purchase,
    instructions: 'حوّل المبلغ ثم أرسل إثبات التحويل للدعم. سيتم اعتماد طلبك خلال دقائق.',
  });
});

const mine = asyncHandler(async (req, res) => {
  const list = await prisma.purchase.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: { package: true },
  });
  res.json({ success: true, purchases: list });
});

module.exports = { list, purchase, mine };
