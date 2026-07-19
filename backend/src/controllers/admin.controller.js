const prisma = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { adjustPoints } = require('../services/points.service');
const { notify, broadcast } = require('../services/notifications.service');
const { truthyIp, paginate, asyncHandler } = require('../utils/helpers');

async function logAdmin(actor, action, target, details) {
  await prisma.adminLog.create({
    data: { actorId: actor.id, action, target, details, ip: '' },
  });
}

// ===== Users =====
const listUsers = asyncHandler(async (req, res) => {
  const { q, role, status } = req.query;
  const { skip, take, page, limit } = paginate(req.query.page, req.query.limit);
  const where = {};
  if (q) where.OR = [
    { email: { contains: q, mode: 'insensitive' } },
    { name:  { contains: q, mode: 'insensitive' } },
    { id:    { contains: q } },
    { referralCode: { contains: q, mode: 'insensitive' } },
  ];
  if (role) where.role = role;
  if (status) where.status = status;
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where, orderBy: { createdAt: 'desc' }, skip, take,
      select: { password: false, id: true, email: true, name: true, role: true, status: true, points: true, createdAt: true, freezeUntil: true, referralCode: true, lastLoginAt: true, avatarUrl: true },
    }),
    prisma.user.count({ where }),
  ]);
  res.json({ success: true, items: items.map(u => ({ ...u, points: u.points.toString() })), total, page, limit });
});

const userDetail = asyncHandler(async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!u) throw new AppError('Not found', 404);
  const logs = await prisma.pointLog.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({ success: true, user: { ...u, password: undefined, points: u.points.toString() }, logs });
});

const updateUser = asyncHandler(async (req, res) => {
  const data = {};
  const { name, role, status, banReason, avatarUrl } = req.body;
  if (name !== undefined) data.name = name;
  if (role) data.role = role;
  if (status) data.status = status;
  if (banReason !== undefined) data.banReason = banReason;
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
  if (status === 'FROZEN') data.freezeUntil = new Date(Date.now() + env.FREEZE_DURATION_MIN * 60 * 1000);
  if (status === 'ACTIVE')  data.freezeUntil = null;
  const u = await prisma.user.update({ where: { id: req.params.id }, data });
  await logAdmin(req.user, 'USER_UPDATE', u.id, { data });
  res.json({ success: true, user: { ...u, password: undefined, points: u.points.toString() } });
});

const deleteUser = asyncHandler(async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  await logAdmin(req.user, 'USER_DELETE', req.params.id, null);
  res.json({ success: true });
});

const freezeUser = asyncHandler(async (req, res) => {
  const until = new Date(Date.now() + env.FREEZE_DURATION_MIN * 60 * 1000);
  const u = await prisma.user.update({
    where: { id: req.params.id }, data: { status: 'FROZEN', freezeUntil: until },
  });
  await notify(u.id, 'تم تجميد حسابك ❄️', `تم تجميد الحساب مؤقتاً حتى ${until.toLocaleString()}`, 'warning');
  await logAdmin(req.user, 'USER_FREEZE', u.id, { until });
  res.json({ success: true });
});

const unfreezeUser = asyncHandler(async (req, res) => {
  const u = await prisma.user.update({
    where: { id: req.params.id }, data: { status: 'ACTIVE', freezeUntil: null },
  });
  await notify(u.id, 'تم فك تجميد حسابك ✅', 'يمكنك استخدام التطبيق بشكل طبيعي الآن.', 'success');
  await logAdmin(req.user, 'USER_UNFREEZE', u.id, null);
  res.json({ success: true });
});

const banUser = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const u = await prisma.user.update({
    where: { id: req.params.id }, data: { status: 'BANNED', banReason: reason || 'Violation', freezeUntil: null },
  });
  await notify(u.id, 'تم حظر حسابك ⛔', `السبب: ${reason || 'مخالفة الشروط'}`, 'warning');
  await logAdmin(req.user, 'USER_BAN', u.id, { reason });
  res.json({ success: true });
});

const grantPoints = asyncHandler(async (req, res) => {
  const { amount, note } = req.body;
  const amt = BigInt(amount);
  if (amt === 0n) throw new AppError('Amount required', 400);
  const u = await adjustPoints(req.params.id, amt > 0n ? amt : -amt, amt > 0n ? 'ADMIN_GRANT' : 'ADMIN_DEDUCT', {
    note: note || `Admin ${amt > 0n ? 'grant' : 'deduct'} by ${req.user.id}`,
  });
  await notify(req.params.id, amt > 0n ? '🎁 هدية من الإدارة' : '⚙️ تعديل رصيد',
    amt > 0n ? `تم إضافة ${amt} نقطة إلى حسابك` : `تم خصم ${-amt} نقطة من حسابك`, 'reward');
  await logAdmin(req.user, 'POINTS_ADJUST', req.params.id, { amount: amt.toString(), note });
  res.json({ success: true, points: u.points.toString() });
});

const updateRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['USER','ADMIN','SUPER_ADMIN','MODERATOR','FINANCE'].includes(role))
    throw new AppError('Invalid role', 400);
  const u = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
  await logAdmin(req.user, 'USER_ROLE', u.id, { role });
  res.json({ success: true, user: { ...u, password: undefined, points: u.points.toString() } });
});

// ===== Campaigns =====
const listCampaigns = asyncHandler(async (req, res) => {
  const { skip, take } = paginate(req.query.page, req.query.limit);
  const items = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' }, skip, take,
    include: { owner: { select: { id: true, name: true, email: true } } },
  });
  res.json({ success: true, items });
});

const campaignAction = asyncHandler(async (req, res) => {
  const { action } = req.body; // pause|resume|cancel|complete
  const map = { pause: 'PAUSED', resume: 'ACTIVE', cancel: 'CANCELLED', complete: 'COMPLETED' };
  if (!map[action]) throw new AppError('Invalid action', 400);
  const c = await prisma.campaign.update({ where: { id: req.params.id }, data: { status: map[action] } });
  await logAdmin(req.user, 'CAMPAIGN_' + action.toUpperCase(), c.id, null);
  res.json({ success: true, campaign: c });
});

// ===== Payments =====
const listPurchases = asyncHandler(async (req, res) => {
  const { skip, take } = paginate(req.query.page, req.query.limit);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  const items = await prisma.purchase.findMany({
    where, orderBy: { createdAt: 'desc' }, skip, take,
    include: { user: { select: { id: true, name: true, email: true } }, package: true },
  });
  res.json({ success: true, items });
});

const approvePurchase = asyncHandler(async (req, res) => {
  const p = await prisma.purchase.findUnique({ where: { id: req.params.id } });
  if (!p) throw new AppError('Not found', 404);
  if (p.status === 'APPROVED') throw new AppError('Already approved', 400);
  await prisma.purchase.update({
    where: { id: p.id },
    data: { status: 'APPROVED', approvedById: req.user.id, approvedAt: new Date() },
  });
  await adjustPoints(p.userId, p.pointsGiven, 'PURCHASE', { refType: 'Purchase', refId: p.id, note: 'Package purchase' });
  await notify(p.userId, '✅ تم اعتماد الشراء', `تم إضافة ${p.pointsGiven} نقطة إلى حسابك`, 'success');
  await logAdmin(req.user, 'PURCHASE_APPROVE', p.id, null);
  res.json({ success: true });
});

const rejectPurchase = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const p = await prisma.purchase.update({
    where: { id: req.params.id },
    data: { status: 'REJECTED', notes: reason || 'Rejected' },
  });
  await notify(p.userId, '❌ تم رفض الشراء', reason || 'تواصل مع الدعم', 'warning');
  await logAdmin(req.user, 'PURCHASE_REJECT', p.id, { reason });
  res.json({ success: true });
});

// ===== Reports =====
const listReports = asyncHandler(async (req, res) => {
  const { skip, take } = paginate(req.query.page, req.query.limit);
  const where = {}; if (req.query.status) where.status = req.query.status;
  const items = await prisma.report.findMany({
    where, orderBy: { createdAt: 'desc' }, skip, take,
    include: { reporter: { select: { id: true, name: true, email: true } }, reported: { select: { id: true, name: true, email: true } } },
  });
  res.json({ success: true, items });
});

const resolveReport = asyncHandler(async (req, res) => {
  const { decision } = req.body; // REVIEWED|DISMISSED
  if (!['REVIEWED','DISMISSED'].includes(decision)) throw new AppError('Invalid decision', 400);
  const r = await prisma.report.update({
    where: { id: req.params.id },
    data: { status: decision, resolvedById: req.user.id, resolvedAt: new Date() },
  });
  await logAdmin(req.user, 'REPORT_' + decision, r.id, null);
  res.json({ success: true });
});

// ===== Notifications =====
const sendNotification = asyncHandler(async (req, res) => {
  const { userId, title, body, type, data } = req.body;
  if (!title || !body) throw new AppError('title & body required', 400);
  if (userId) {
    await notify(userId, title, body, type || 'info', data || null);
    await logAdmin(req.user, 'NOTIFY_USER', userId, { title });
  } else {
    await broadcast(title, body, type || 'info', data || null);
    await logAdmin(req.user, 'NOTIFY_ALL', null, { title });
  }
  res.json({ success: true });
});

// ===== Stats =====
const stats = asyncHandler(async (_req, res) => {
  const [users, campaigns, completedCampaigns, pendingPurchases, approvedPurchases, tasksDone, totalPoints, totalReferrals] = await Promise.all([
    prisma.user.count(),
    prisma.campaign.count(),
    prisma.campaign.count({ where: { status: 'COMPLETED' } }),
    prisma.purchase.count({ where: { status: 'PENDING' } }),
    prisma.purchase.count({ where: { status: 'APPROVED' } }),
    prisma.task.count({ where: { status: 'VERIFIED' } }),
    prisma.user.aggregate({ _sum: { points: true, totalEarned: true, totalSpent: true } }),
    prisma.user.count({ where: { referredById: { not: null } } }),
  ]);
  const revenue = await prisma.purchase.aggregate({
    where: { status: 'APPROVED' }, _sum: { priceCents: true },
  });
  res.json({
    success: true,
    stats: {
      users, campaigns, completedCampaigns,
      purchases: { pending: pendingPurchases, approved: approvedPurchases },
      tasksDone, totalReferrals,
      revenueCents: revenue._sum.priceCents || 0,
      points: {
        inCirculation: (totalPoints._sum.points || 0n).toString(),
        totalEarned:   (totalPoints._sum.totalEarned || 0n).toString(),
        totalSpent:    (totalPoints._sum.totalSpent || 0n).toString(),
      },
    },
  });
});

const topUsers = asyncHandler(async (_req, res) => {
  const items = await prisma.user.findMany({
    orderBy: { totalEarned: 'desc' }, take: 10,
    select: { id: true, name: true, email: true, avatarUrl: true, points: true, totalEarned: true, createdAt: true },
  });
  res.json({ success: true, items: items.map(u => ({ ...u, points: u.points.toString(), totalEarned: u.totalEarned.toString() })) });
});

const chart = asyncHandler(async (_req, res) => {
  const days = parseInt(_req.query.days || '14', 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sinceDay = new Date(since);
  sinceDay.setHours(0, 0, 0, 0);

  const signups = await prisma.user.findMany({
    where: { createdAt: { gte: sinceDay } }, select: { createdAt: true },
  });
  const tasks = await prisma.task.findMany({
    where: { createdAt: { gte: sinceDay } }, select: { createdAt: true },
  });

  const buckets = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    const k = d.toISOString().slice(0, 10);
    buckets[k] = { date: k, signups: 0, tasks: 0 };
  }
  for (const s of signups) {
    const k = s.createdAt.toISOString().slice(0, 10);
    if (buckets[k]) buckets[k].signups++;
  }
  for (const t of tasks) {
    const k = t.createdAt.toISOString().slice(0, 10);
    if (buckets[k]) buckets[k].tasks++;
  }
  res.json({ success: true, series: Object.values(buckets) });
});

// ===== Admin Logs =====
const adminLogs = asyncHandler(async (req, res) => {
  const { skip, take } = paginate(req.query.page, req.query.limit);
  const items = await prisma.adminLog.findMany({
    orderBy: { createdAt: 'desc' }, skip, take,
    include: { actor: { select: { id: true, name: true, email: true, role: true } } },
  });
  res.json({ success: true, items });
});

module.exports = {
  listUsers, userDetail, updateUser, deleteUser, freezeUser, unfreezeUser, banUser,
  grantPoints, updateRole,
  listCampaigns, campaignAction,
  listPurchases, approvePurchase, rejectPurchase,
  listReports, resolveReport,
  sendNotification,
  stats, topUsers, chart, adminLogs,
};
