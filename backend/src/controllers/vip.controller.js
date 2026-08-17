const prisma = require('../config/db');
const { AppError } = require('../utils/errors');
const { asyncHandler } = require('../utils/helpers');
const { getSettings } = require('../services/appSettings.service');
const { notify } = require('../services/notifications.service');

const status = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const now = new Date();
  const active = req.user.vipProUntil && req.user.vipProUntil > now;
  const latest = await prisma.vipSubscription.findFirst({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, vipPro: { enabled: settings.vipPro?.enabled !== false, active: Boolean(active), until: active ? req.user.vipProUntil : null, priceCents: settings.vipPro?.monthlyPriceCents ?? 1000, currency: settings.vipPro?.currency ?? 'USD', latest } });
});

const subscribe = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  if (settings.vipPro?.enabled === false) throw new AppError('VIP PRO غير متاح حالياً', 403);
  const row = await prisma.vipSubscription.create({ data: { userId: req.user.id, priceCents: Number(settings.vipPro?.monthlyPriceCents ?? 1000), currency: settings.vipPro?.currency || 'USD', method: String(req.body?.method || 'manual_transfer'), reference: req.body?.reference ? String(req.body.reference).slice(0, 255) : null } });
  res.status(201).json({ success: true, subscription: row, instructions: 'أرسل إثبات الدفع للدعم، وسيتم تفعيل VIP PRO لمدة 30 يوماً بعد الموافقة.' });
});

const listAdmin = asyncHandler(async (_req, res) => {
  const rows = await prisma.vipSubscription.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { id: true, name: true, email: true, vipProUntil: true } } } });
  res.json({ success: true, items: rows });
});

const actionAdmin = asyncHandler(async (req, res) => {
  const row = await prisma.vipSubscription.findUnique({ where: { id: req.params.id } });
  if (!row) throw new AppError('VIP subscription not found', 404);
  const decision = String(req.body?.decision || '').toUpperCase();
  if (!['APPROVED','REJECTED'].includes(decision)) throw new AppError('Invalid decision', 400);
  if (decision === 'REJECTED') {
    const updated = await prisma.vipSubscription.update({ where: { id: row.id }, data: { status: 'REJECTED' } });
    await notify(row.userId, 'VIP PRO', 'تم رفض طلب VIP PRO. تواصل مع الدعم إذا كان هناك خطأ.', 'warning');
    return res.json({ success: true, item: updated });
  }
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { id: row.userId }, select: { vipProUntil: true } });
  const start = user?.vipProUntil && user.vipProUntil > now ? user.vipProUntil : now;
  const expires = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [updated] = await prisma.$transaction([
    prisma.vipSubscription.update({ where: { id: row.id }, data: { status: 'ACTIVE', startsAt: start, expiresAt: expires } }),
    prisma.user.update({ where: { id: row.userId }, data: { vipProUntil: expires } }),
  ]);
  await notify(row.userId, 'تم تفعيل VIP PRO 👑', `تم تفعيل VIP PRO حتى ${expires.toISOString().slice(0, 10)}. ستظهر حملاتك في المقدمة وتحصل على مكافآت إضافية.`, 'success');
  res.json({ success: true, item: updated, expiresAt: expires });
});

module.exports = { status, subscribe, listAdmin, actionAdmin };
