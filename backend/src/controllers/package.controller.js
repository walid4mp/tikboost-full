const prisma = require('../config/db');
const { AppError } = require('../utils/errors');
const { asyncHandler } = require('../utils/helpers');
const { getSettings } = require('../services/appSettings.service');

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
  const { packageId, method, reference, transactionId, receiptImageData } = req.body;
  const selectedMethod = String(method || '').trim().toLowerCase();
  const settings = await getSettings();
  const paymentMethod = (settings.payments?.methods || []).find((item) => item.key === selectedMethod && item.enabled !== false);
  if (!paymentMethod) throw new AppError('طريقة الدفع غير متاحة حالياً. اختر طريقة دفع مفعلة.', 400, 'PAYMENT_METHOD_DISABLED');
  const pkg = await prisma.pointPackage.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.isActive) throw new AppError('Package not available', 404);

  const points = BigInt(pkg.points) + BigInt(pkg.bonusPoints);
  const tx = String(transactionId || reference || '').trim().slice(0, 255);
  const receipt = typeof receiptImageData === 'string' ? receiptImageData.trim() : '';
  if (receipt && receipt.length > 1900000) throw new AppError('صورة الإثبات كبيرة جداً. اختر صورة أصغر.', 400);
  if (tx) {
    const duplicate = await prisma.purchase.findFirst({
      where: { reference: tx, status: { in: ['PENDING', 'APPROVED'] } },
      select: { id: true, status: true },
    });
    if (duplicate) throw new AppError('رقم المعاملة مستخدم مسبقاً.', 409);
  }
  const purchaseRow = await prisma.purchase.create({
    data: {
      userId: req.user.id,
      packageId: pkg.id,
      pointsGiven: points,
      priceCents: pkg.priceCents,
      currency: pkg.currency,
      method: selectedMethod,
      reference: tx || null,
      notes: JSON.stringify({
        receiptImageData: receipt || null,
        paymentMethod: {
          key: paymentMethod.key, label: paymentMethod.label, currency: paymentMethod.currency,
          walletAddress: paymentMethod.walletAddress || '', accountName: paymentMethod.accountName || '',
          network: paymentMethod.network || '', externalUrl: paymentMethod.externalUrl || '',
          feePercent: paymentMethod.feePercent || 0,
        },
      }),
      status: 'PENDING',
    },
  });

  res.status(201).json({
    success: true,
    purchase: { id: purchaseRow.id, status: purchaseRow.status, reference: purchaseRow.reference, createdAt: purchaseRow.createdAt },
    instructions: 'تم إنشاء الطلب. بعد التحويل، أرسل رقم المعاملة وصورة إثبات الدفع من شاشة الإيداع. سيتم اعتماد الطلب بعد المراجعة.',
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
