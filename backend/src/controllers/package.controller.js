const prisma = require('../config/db');
const { AppError } = require('../utils/errors');
const { asyncHandler } = require('../utils/helpers');

const list = asyncHandler(async (_req, res) => {
  const pkgs = await prisma.pointPackage.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({
    success: true,
    packages: pkgs.map(serializePackage),
  });
});

const purchase = asyncHandler(async (req, res) => {
  const { packageId, method, reference } = req.body;
  const pkg = await prisma.pointPackage.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.isActive) throw new AppError('Package not available', 404);

  const points = BigInt(pkg.points) + BigInt(pkg.bonusPoints);
  const purchaseRow = await prisma.purchase.create({
    data: {
      userId: req.user.id,
      packageId: pkg.id,
      pointsGiven: points,
      priceCents: pkg.priceCents,
      currency: pkg.currency,
      method: method || 'manual_transfer',
      reference: reference || null,
      status: 'PENDING',
    },
  });

  res.status(201).json({
    success: true,
    purchase: purchaseRow,
    instructions: 'حوّل المبلغ ثم أرسل إثبات التحويل للدعم. سيتم اعتماد طلبك خلال دقائق.',
  });
});

const mine = asyncHandler(async (req, res) => {
  const rows = await prisma.purchase.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: { package: true },
  });
  res.json({ success: true, purchases: rows });
});

const listAdmin = asyncHandler(async (_req, res) => {
  const pkgs = await prisma.pointPackage.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ success: true, items: pkgs.map(serializePackage) });
});

const createAdmin = asyncHandler(async (req, res) => {
  const data = buildPackageData(req.body);
  if (!data.slug) throw new AppError('slug is required', 400);
  if (!data.name) throw new AppError('name is required', 400);

  const pkg = await prisma.pointPackage.create({ data });
  res.status(201).json({ success: true, item: serializePackage(pkg) });
});

const updateAdmin = asyncHandler(async (req, res) => {
  const existing = await prisma.pointPackage.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError('Package not found', 404);

  const data = buildPackageData(req.body, { partial: true });
  const pkg = await prisma.pointPackage.update({
    where: { id: req.params.id },
    data,
  });
  res.json({ success: true, item: serializePackage(pkg) });
});

const deleteAdmin = asyncHandler(async (req, res) => {
  const existing = await prisma.pointPackage.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError('Package not found', 404);

  // Keep purchase history intact. If a package has purchases, archive it instead
  // of deleting the row because Purchase.packageId is a required foreign key.
  const purchaseCount = await prisma.purchase.count({ where: { packageId: existing.id } });
  if (purchaseCount > 0) {
    const archived = await prisma.pointPackage.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    return res.json({ success: true, deleted: false, deactivated: true, purchaseCount, item: serializePackage(archived) });
  }

  await prisma.pointPackage.delete({ where: { id: existing.id } });
  res.json({ success: true, deleted: true, deactivated: false, purchaseCount: 0 });
});

function buildPackageData(body, options = {}) {
  const partial = options.partial === true;
  const data = {};

  if (!partial || body.name !== undefined) data.name = String(body.name || '').trim();
  if (!partial || body.slug !== undefined) data.slug = String(body.slug || '').trim().toLowerCase();
  if (!partial || body.priceCents !== undefined) data.priceCents = parseInt(body.priceCents, 10) || 0;
  if (!partial || body.currency !== undefined) data.currency = String(body.currency || 'USD').trim().toUpperCase();
  if (!partial || body.points !== undefined) data.points = BigInt(body.points || 0);
  if (!partial || body.bonusPoints !== undefined) data.bonusPoints = BigInt(body.bonusPoints || 0);
  if (!partial || body.isActive !== undefined) data.isActive = !!body.isActive;
  if (!partial || body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder, 10) || 0;

  if (!partial) {
    if (!data.name) throw new AppError('name is required', 400);
    if (!data.slug) throw new AppError('slug is required', 400);
  }

  return data;
}

function serializePackage(item) {
  return {
    ...item,
    points: item.points.toString(),
    bonusPoints: item.bonusPoints.toString(),
  };
}

module.exports = {
  list,
  purchase,
  mine,
  listAdmin,
  createAdmin,
  updateAdmin,
  deleteAdmin,
};
