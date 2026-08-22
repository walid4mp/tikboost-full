const prisma = require('../config/db');
const { AppError } = require('../utils/errors');
const { asyncHandler } = require('../utils/helpers');
const { getSettings, updateSettings } = require('../services/appSettings.service');
const { notify, notifyAdmins } = require('../services/notifications.service');

const status = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const now = new Date();
  const active = req.user.vipProUntil && req.user.vipProUntil > now;
  const latest = await prisma.vipSubscription.findFirst({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
  const plans = (settings.vipPro?.plans || []).filter(p => p.enabled !== false).map(p => ({ ...p, price: p.priceCents / 100 }));
  res.json({ success: true, vipPro: { enabled: settings.vipPro?.enabled !== false, active: Boolean(active), until: active ? req.user.vipProUntil : null, priceCents: settings.vipPro?.monthlyPriceCents ?? 1000, currency: settings.vipPro?.currency ?? 'USD', latest, plans } });
});

const subscribe = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  if (settings.vipPro?.enabled === false) throw new AppError('VIP PRO غير متاح حالياً', 403);
  const planKey = String(req.body?.planKey || '');
  const plan = (settings.vipPro?.plans || []).find(p => p.key === planKey && p.enabled !== false) || {
    key: 'vip_monthly', name: 'VIP PRO', priceCents: Number(settings.vipPro?.monthlyPriceCents ?? 1000), durationDays: 30, bonusPerTask: Number(settings.vipPro?.bonusPerTask ?? 5), enabled: true,
  };
  const row = await prisma.vipSubscription.create({ data: { userId: req.user.id, priceCents: Number(plan.priceCents), currency: settings.vipPro?.currency || 'USD', method: String(req.body?.method || 'manual_transfer'), reference: req.body?.reference ? String(req.body.reference).slice(0, 255) : null } });
  await notifyAdmins('👑 طلب VIP PRO جديد', `طلب ${plan.name} من المستخدم ${req.user.email || req.user.id}.`, 'info', { event: 'VIP_SUBSCRIPTION_CREATED', subscriptionId: row.id, userId: req.user.id, planKey: plan.key });
  res.status(201).json({ success: true, subscription: row, plan, instructions: `أرسل إثبات الدفع للدعم، وسيتم تفعيل ${plan.durationDays} يوماً بعد الموافقة.` });
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
  const settings = await getSettings();
  const plan = (settings.vipPro?.plans || []).find(p => p.priceCents === row.priceCents && p.enabled !== false) || { durationDays: 30 };
  const user = await prisma.user.findUnique({ where: { id: row.userId }, select: { vipProUntil: true } });
  const start = user?.vipProUntil && user.vipProUntil > now ? user.vipProUntil : now;
  const expires = new Date(start.getTime() + Number(plan.durationDays || 30) * 86400000);
  const [updated] = await prisma.$transaction([
    prisma.vipSubscription.update({ where: { id: row.id }, data: { status: 'ACTIVE', startsAt: start, expiresAt: expires } }),
    prisma.user.update({ where: { id: row.userId }, data: { vipProUntil: expires } }),
  ]);
  await notify(row.userId, 'تم تفعيل VIP PRO 👑', `تم تفعيل VIP PRO حتى ${expires.toISOString().slice(0, 10)}.`, 'success');
  res.json({ success: true, item: updated, expiresAt: expires });
});

const grantAdmin = asyncHandler(async (req, res) => {
  const userId = String(req.body?.userId || '');
  if (!userId) throw new AppError('userId required', 400);
  const durationDays = Math.max(1, Math.min(3650, Number(req.body?.durationDays || 30)));
  const priceCents = Math.max(0, Number(req.body?.priceCents || 0));
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id:true, name:true, email:true, vipProUntil:true } });
  if (!user) throw new AppError('User not found', 404);
  const now = new Date();
  const start = user.vipProUntil && user.vipProUntil > now ? user.vipProUntil : now;
  const expires = new Date(start.getTime() + durationDays * 86400000);
  const sub = await prisma.vipSubscription.create({ data: { userId, priceCents, currency: String(req.body?.currency || 'USD'), method: 'admin_grant', status: 'ACTIVE', startsAt: start, expiresAt: expires, reference: req.body?.note ? String(req.body.note).slice(0,255) : 'Admin grant' } });
  await prisma.user.update({ where: { id: userId }, data: { vipProUntil: expires } });
  await notify(userId, '👑 تم منحك VIP PRO', `تم تفعيل VIP PRO لمدة ${durationDays} يوماً حتى ${expires.toISOString().slice(0,10)}.`, 'success', { event:'VIP_GRANTED', durationDays });
  res.status(201).json({ success:true, item:sub, user, expiresAt:expires });
});

const savePlans = asyncHandler(async (req, res) => {
  const plans = Array.isArray(req.body?.plans) ? req.body.plans : [];
  if (!plans.length) throw new AppError('أضف باقة VIP واحدة على الأقل.', 400);
  const settings = await updateSettings({ vipPro: { plans } });
  res.json({ success:true, plans:settings.vipPro.plans });
});

module.exports = { status, subscribe, listAdmin, actionAdmin, grantAdmin, savePlans };
