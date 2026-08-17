const prisma = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { adjustPoints } = require('../services/points.service');
const { notify, broadcast } = require('../services/notifications.service');
const { paginate, asyncHandler, randomCode } = require('../utils/helpers');
const { getSettings, updateSettings } = require('../services/appSettings.service');

async function logAdmin(actor, action, target, details) {
  await prisma.adminLog.create({
    data: { actorId: actor.id, action, target, details, ip: actor.lastIp || '' },
  });
}

const listUsers = asyncHandler(async (req, res) => {
  const { q, role, status } = req.query;
  const { skip, take, page, limit } = paginate(req.query.page, req.query.limit);
  const where = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { id: { contains: q } },
      { referralCode: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (role) where.role = role;
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        points: true,
        createdAt: true,
        freezeUntil: true,
        referralCode: true,
        lastLoginAt: true,
        avatarUrl: true,
        gender: true,
        countryCode: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    success: true,
    items: items.map((user) => ({ ...user, points: user.points.toString() })),
    total,
    page,
    limit,
  });
});

const userDetail = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw new AppError('Not found', 404);
  const logs = await prisma.pointLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({
    success: true,
    user: {
      ...user,
      password: undefined,
      points: user.points.toString(),
      totalEarned: user.totalEarned.toString(),
      totalSpent: user.totalSpent.toString(),
    },
    logs: logs.map((log) => ({
      ...log,
      delta: log.delta.toString(),
      balanceAfter: log.balanceAfter.toString(),
    })),
  });
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
  if (status === 'ACTIVE') data.freezeUntil = null;
  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  await logAdmin(req.user, 'USER_UPDATE', user.id, { data });
  res.json({ success: true, user: { ...user, password: undefined, points: user.points.toString() } });
});

const deleteUser = asyncHandler(async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  await logAdmin(req.user, 'USER_DELETE', req.params.id, null);
  res.json({ success: true });
});

const freezeUser = asyncHandler(async (req, res) => {
  const until = new Date(Date.now() + env.FREEZE_DURATION_MIN * 60 * 1000);
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: 'FROZEN', freezeUntil: until },
  });
  await notify(user.id, 'تم تجميد حسابك ❄️', `تم تجميد الحساب مؤقتاً حتى ${until.toLocaleString()}`, 'warning');
  await logAdmin(req.user, 'USER_FREEZE', user.id, { until });
  res.json({ success: true });
});

const unfreezeUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: 'ACTIVE', freezeUntil: null },
  });
  await notify(user.id, 'تم فك تجميد حسابك ✅', 'يمكنك استخدام التطبيق بشكل طبيعي الآن.', 'success');
  await logAdmin(req.user, 'USER_UNFREEZE', user.id, null);
  res.json({ success: true });
});

const banUser = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: 'BANNED', banReason: reason || 'Violation', freezeUntil: null },
  });
  await notify(user.id, 'تم حظر حسابك ⛔', `السبب: ${reason || 'مخالفة الشروط'}`, 'warning');
  await logAdmin(req.user, 'USER_BAN', user.id, { reason });
  res.json({ success: true });
});

const grantPoints = asyncHandler(async (req, res) => {
  const { amount, note } = req.body;
  const value = BigInt(amount);
  if (value === 0n) throw new AppError('Amount required', 400);
  const user = await adjustPoints(
    req.params.id,
    value,
    value > 0n ? 'ADMIN_GRANT' : 'ADMIN_DEDUCT',
    { note: note || `Admin adjust by ${req.user.id}` },
  );
  await notify(
    req.params.id,
    value > 0n ? '🎁 هدية من الإدارة' : '⚙️ تعديل رصيد',
    value > 0n ? `تم إضافة ${value} نقطة إلى حسابك` : `تم خصم ${-value} نقطة من حسابك`,
    'reward',
  );
  await logAdmin(req.user, 'POINTS_ADJUST', req.params.id, { amount: value.toString(), note });
  res.json({ success: true, points: user.points.toString() });
});

const updateRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['USER', 'ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'FINANCE'].includes(role)) {
    throw new AppError('Invalid role', 400);
  }
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
  await logAdmin(req.user, 'USER_ROLE', user.id, { role });
  res.json({ success: true, user: { ...user, password: undefined, points: user.points.toString() } });
});

const listCampaigns = asyncHandler(async (req, res) => {
  const { skip, take } = paginate(req.query.page, req.query.limit);
  const items = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    skip,
    take,
    include: { owner: { select: { id: true, name: true, email: true } } },
  });
  res.json({
    success: true,
    items: items.map((campaign) => ({
      ...campaign,
      pointsCost: campaign.pointsCost.toString(),
      perTaskReward: campaign.perTaskReward.toString(),
      targetGender: campaign.targetGender,
      targetCountry: campaign.targetCountry,
    })),
  });
});

const campaignAction = asyncHandler(async (req, res) => {
  const { action } = req.body;
  const map = { pause: 'PAUSED', resume: 'ACTIVE', cancel: 'CANCELLED', complete: 'COMPLETED' };
  if (!map[action]) throw new AppError('Invalid action', 400);
  const campaign = await prisma.campaign.update({
    where: { id: req.params.id },
    data: {
      status: map[action],
      pausedAt: action === 'pause' ? new Date() : action === 'resume' ? null : undefined,
    },
  });
  await logAdmin(req.user, `CAMPAIGN_${action.toUpperCase()}`, campaign.id, null);
  res.json({ success: true, campaign });
});

const listPurchases = asyncHandler(async (req, res) => {
  const { skip, take } = paginate(req.query.page, req.query.limit);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  const items = await prisma.purchase.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip,
    take,
    include: { user: { select: { id: true, name: true, email: true } }, package: true },
  });
  res.json({
    success: true,
    items: items.map((purchase) => ({
      ...purchase,
      pointsGiven: purchase.pointsGiven.toString(),
      package: purchase.package
        ? {
            ...purchase.package,
            points: purchase.package.points.toString(),
            bonusPoints: purchase.package.bonusPoints.toString(),
          }
        : null,
    })),
  });
});

const approvePurchase = asyncHandler(async (req, res) => {
  const purchase = await prisma.purchase.findUnique({ where: { id: req.params.id } });
  if (!purchase) throw new AppError('Not found', 404);
  if (purchase.status === 'APPROVED') throw new AppError('Already approved', 400);
  await prisma.purchase.update({
    where: { id: purchase.id },
    data: { status: 'APPROVED', approvedById: req.user.id, approvedAt: new Date() },
  });
  await adjustPoints(purchase.userId, purchase.pointsGiven, 'PURCHASE', {
    refType: 'Purchase',
    refId: purchase.id,
    note: 'Package purchase',
  });
  await notify(purchase.userId, '✅ تم اعتماد الشراء', `تم إضافة ${purchase.pointsGiven} نقطة إلى حسابك`, 'success');
  await logAdmin(req.user, 'PURCHASE_APPROVE', purchase.id, null);
  res.json({ success: true });
});

const rejectPurchase = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const purchase = await prisma.purchase.update({
    where: { id: req.params.id },
    data: { status: 'REJECTED', notes: reason || 'Rejected' },
  });
  await notify(purchase.userId, '❌ تم رفض الشراء', reason || 'تواصل مع الدعم', 'warning');
  await logAdmin(req.user, 'PURCHASE_REJECT', purchase.id, { reason });
  res.json({ success: true });
});

const listReports = asyncHandler(async (req, res) => {
  const { skip, take } = paginate(req.query.page, req.query.limit);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  const items = await prisma.report.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip,
    take,
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      reported: { select: { id: true, name: true, email: true } },
    },
  });
  res.json({ success: true, items });
});

const resolveReport = asyncHandler(async (req, res) => {
  const { decision } = req.body;
  if (!['REVIEWED', 'DISMISSED'].includes(decision)) throw new AppError('Invalid decision', 400);
  const report = await prisma.report.update({
    where: { id: req.params.id },
    data: { status: decision, resolvedById: req.user.id, resolvedAt: new Date() },
  });
  await logAdmin(req.user, `REPORT_${decision}`, report.id, null);
  res.json({ success: true });
});

const sendNotification = asyncHandler(async (req, res) => {
  const { userId, userIds, title, body, type, data } = req.body;
  if (!title || !body) throw new AppError('title & body required', 400);
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean).map(String) : (userId ? [String(userId)] : []);
  if (ids.length) {
    for (const id of ids) await notify(id, title, body, type || 'info', data || null);
    await logAdmin(req.user, 'NOTIFY_USERS', ids.join(','), { title, count: ids.length });
  } else {
    await broadcast(title, body, type || 'info', data || null);
    await logAdmin(req.user, 'NOTIFY_ALL', null, { title });
  }
  res.json({ success: true, count: ids.length || 'all' });
});

const crypto = require('crypto');

function adminResetOtpKey() {
  const configured = env.RESET_OTP_ENCRYPTION_KEY || env.JWT_ACCESS_SECRET;
  return crypto.createHash('sha256').update(String(configured)).digest();
}

function decryptAdminOtp(payload) {
  const [ivRaw, tagRaw, dataRaw] = String(payload || '').split('.');
  if (!ivRaw || !tagRaw || !dataRaw) throw new Error('Invalid encrypted OTP');
  const decipher = crypto.createDecipheriv('aes-256-gcm', adminResetOtpKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
}

const listPasswordResetRequests = asyncHandler(async (req, res) => {
  const status = req.query.status;
  const where = {};
  if (status && ['PENDING', 'USED', 'LOCKED', 'EXPIRED'].includes(status)) where.status = status;

  const items = await prisma.passwordResetToken.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
      attempts: true,
      status: true,
      requestIp: true,
      revealedAt: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });

  res.json({ success: true, items });
});

const revealPasswordResetCode = asyncHandler(async (req, res) => {
  const record = await prisma.passwordResetToken.findUnique({
    where: { id: req.params.id },
    select: { id: true, status: true, expiresAt: true, encryptedCode: true },
  });

  if (!record) throw new AppError('Reset request not found', 404);
  if (record.status !== 'PENDING' || record.expiresAt <= new Date()) {
    throw new AppError('هذا الطلب لم يعد صالحًا.', 400, 'RESET_REQUEST_INVALID');
  }
  if (!record.encryptedCode) throw new AppError('لا يوجد رمز محفوظ لهذا الطلب.', 400, 'RESET_CODE_UNAVAILABLE');

  let code;
  try {
    code = decryptAdminOtp(record.encryptedCode);
  } catch {
    throw new AppError('تعذر فك رمز الاستعادة.', 500, 'RESET_CODE_DECRYPT_FAILED');
  }

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { revealedAt: new Date() },
  });
  await logAdmin(req.user, 'PASSWORD_RESET_CODE_REVEAL', record.id, {
    userId: req.params.id,
    revealed: true,
  });

  res.json({ success: true, code });
});

const cancelPasswordResetRequest = asyncHandler(async (req, res) => {
  const record = await prisma.passwordResetToken.findUnique({ where: { id: req.params.id } });
  if (!record) throw new AppError('Reset request not found', 404);
  if (record.status === 'PENDING') {
    await prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { status: 'EXPIRED', usedAt: new Date() },
    });
  }
  await logAdmin(req.user, 'PASSWORD_RESET_CANCEL', record.id, { userId: record.userId });
  res.json({ success: true });
});

const getRewardSettings = asyncHandler(async (_req, res) => {
  const settings = await getSettings();
  res.json({ success: true, settings });
});

const updateRewardSettings = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const patch = { ...body };
  if (body.notifications?.reviewRewardPoints !== undefined || body.notifications?.reviewUrl !== undefined) {
    const current = await getSettings();
    const items = Array.isArray(current.dailyTasks?.items) ? current.dailyTasks.items.map((item) =>
      item.key === 'review_app' ? { ...item, rewardPoints: Number(body.notifications?.reviewRewardPoints ?? item.rewardPoints), url: body.notifications?.reviewUrl ?? item.url ?? '' } : item
    ) : [];
    patch.dailyTasks = { items };
  }
  const settings = await updateSettings(patch);
  await logAdmin(req.user, 'SETTINGS_REWARDS_UPDATE', null, { patch });
  res.json({ success: true, settings });
});

const getAdSettings = asyncHandler(async (_req, res) => {
  const settings = await getSettings();
  res.json({ success: true, ads: settings.ads, settings });
});

const updateAdSettings = asyncHandler(async (req, res) => {
  const patch = { ads: req.body?.ads || req.body || {} };
  const settings = await updateSettings(patch);
  await logAdmin(req.user, 'SETTINGS_ADS_UPDATE', null, { patch });
  res.json({ success: true, ads: settings.ads, settings });
});

const getAppSettings = asyncHandler(async (_req, res) => {
  const settings = await getSettings();
  res.json({ success: true, app: settings.app, settings });
});

const updateAppSettings = asyncHandler(async (req, res) => {
  const patch = { app: req.body?.app || req.body || {} };
  const settings = await updateSettings(patch);
  await logAdmin(req.user, 'SETTINGS_APP_UPDATE', null, { patch });
  res.json({ success: true, app: settings.app, settings });
});

const getPricingSettings = asyncHandler(async (_req, res) => {
  const settings = await getSettings();
  res.json({
    success: true,
    campaignPricing: settings.campaignPricing,
    campaignRewards: settings.campaignRewards,
    campaignRules: settings.campaignRules,
    settings,
  });
});

const updatePricingSettings = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const patch = {
    campaignPricing: body.campaignPricing || body || {},
    campaignRewards: body.campaignRewards || {},
    campaignRules: body.campaignRules || {},
  };
  const settings = await updateSettings(patch);
  await logAdmin(req.user, 'SETTINGS_PRICING_UPDATE', null, { patch });
  res.json({
    success: true,
    campaignPricing: settings.campaignPricing,
    campaignRewards: settings.campaignRewards,
    campaignRules: settings.campaignRules,
    settings,
  });
});

const getPaymentSettings = asyncHandler(async (_req, res) => {
  const settings = await getSettings();
  res.json({ success: true, payments: settings.payments, settings });
});

const updatePaymentSettings = asyncHandler(async (req, res) => {
  const patch = { payments: req.body?.payments || req.body || {} };
  const settings = await updateSettings(patch);
  await logAdmin(req.user, 'SETTINGS_PAYMENTS_UPDATE', null, { patch });
  res.json({ success: true, payments: settings.payments, settings });
});

const listWheelPrizes = asyncHandler(async (_req, res) => {
  const items = await prisma.wheelPrize.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json({ success: true, items: items.map((item) => ({ ...item, points: item.points.toString() })) });
});

const updateWheelPrize = asyncHandler(async (req, res) => {
  const data = {};
  if (req.body.label !== undefined) data.label = String(req.body.label).trim();
  if (req.body.points !== undefined) data.points = BigInt(req.body.points);
  if (req.body.weight !== undefined) data.weight = parseInt(req.body.weight, 10);
  if (req.body.color !== undefined) data.color = String(req.body.color).trim();
  if (req.body.isActive !== undefined) data.isActive = !!req.body.isActive;
  if (req.body.sortOrder !== undefined) data.sortOrder = parseInt(req.body.sortOrder, 10);

  const prize = await prisma.wheelPrize.update({ where: { id: req.params.id }, data });
  await logAdmin(req.user, 'WHEEL_PRIZE_UPDATE', prize.id, { data });
  res.json({ success: true, prize: { ...prize, points: prize.points.toString() } });
});

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
    where: { status: 'APPROVED' },
    _sum: { priceCents: true },
  });
  res.json({
    success: true,
    stats: {
      users,
      campaigns,
      completedCampaigns,
      purchases: { pending: pendingPurchases, approved: approvedPurchases },
      tasksDone,
      totalReferrals,
      revenueCents: revenue._sum.priceCents || 0,
      points: {
        inCirculation: (totalPoints._sum.points || 0n).toString(),
        totalEarned: (totalPoints._sum.totalEarned || 0n).toString(),
        totalSpent: (totalPoints._sum.totalSpent || 0n).toString(),
      },
    },
  });
});

const topUsers = asyncHandler(async (_req, res) => {
  const items = await prisma.user.findMany({
    orderBy: { totalEarned: 'desc' },
    take: 10,
    select: { id: true, name: true, email: true, avatarUrl: true, points: true, totalEarned: true, createdAt: true },
  });
  res.json({
    success: true,
    items: items.map((user) => ({
      ...user,
      points: user.points.toString(),
      totalEarned: user.totalEarned.toString(),
    })),
  });
});

const chart = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days || '14', 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sinceDay = new Date(since);
  sinceDay.setHours(0, 0, 0, 0);

  const [signups, tasks] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: sinceDay } }, select: { createdAt: true } }),
    prisma.task.findMany({ where: { createdAt: { gte: sinceDay } }, select: { createdAt: true } }),
  ]);

  const buckets = {};
  for (let i = 0; i < days; i += 1) {
    const day = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    const key = day.toISOString().slice(0, 10);
    buckets[key] = { date: key, signups: 0, tasks: 0 };
  }
  for (const signup of signups) {
    const key = signup.createdAt.toISOString().slice(0, 10);
    if (buckets[key]) buckets[key].signups += 1;
  }
  for (const task of tasks) {
    const key = task.createdAt.toISOString().slice(0, 10);
    if (buckets[key]) buckets[key].tasks += 1;
  }
  res.json({ success: true, series: Object.values(buckets) });
});

const adminLogs = asyncHandler(async (req, res) => {
  const { skip, take } = paginate(req.query.page, req.query.limit);
  const items = await prisma.adminLog.findMany({
    orderBy: { createdAt: 'desc' },
    skip,
    take,
    include: { actor: { select: { id: true, name: true, email: true, role: true } } },
  });
  res.json({ success: true, items });
});


const bcrypt = require('bcrypt');
const { ALL_PERMISSIONS } = require('../middleware/adminPermissions');

const listAdAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days || '30', 10), 1), 365);
  const since = new Date(Date.now() - days * 86400000);
  const rows = await prisma.adImpression.groupBy({
    by: ['userId', 'type', 'event'],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map(r => r.userId))] } },
    select: { id: true, name: true, email: true, role: true, gender: true, countryCode: true, createdAt: true },
  });
  const byUser = new Map();
  for (const r of rows) {
    // For Rewarded, count only COMPLETED as a watched ad. Other formats count VIEW.
    if ((r.type === 'REWARDED' && r.event !== 'COMPLETED') || (r.type !== 'REWARDED' && r.event !== 'VIEW')) continue;
    const item = byUser.get(r.userId) || { banner: 0, interstitial: 0, rewarded: 0, native: 0, customBanner: 0, total: 0 };
    const key = r.type.toLowerCase().replace('_', '');
    const map = { banner: 'banner', interstitial: 'interstitial', rewarded: 'rewarded', native: 'native', custombanner: 'customBanner' };
    const field = map[key];
    if (field) item[field] += Number(r._count._all);
    item.total += Number(r._count._all);
    byUser.set(r.userId, item);
  }
  const items = users.map(u => ({ ...u, ...(byUser.get(u.id) || {banner:0,interstitial:0,rewarded:0,native:0,customBanner:0,total:0}) }));
  items.sort((a,b) => b.total - a.total);
  const totals = items.reduce((a, x) => { a.banner+=x.banner; a.interstitial+=x.interstitial; a.rewarded+=x.rewarded; a.native+=x.native; a.customBanner+=x.customBanner; a.total+=x.total; return a; }, {banner:0,interstitial:0,rewarded:0,native:0,customBanner:0,total:0});
  totals.uniqueViewers = items.filter((x) => x.total > 0).length;
  res.json({ success: true, days, totals, items });
});

const recordAdEvent = asyncHandler(async (req, res) => {
  const type = String(req.body.type || '').toUpperCase();
  const event = String(req.body.event || 'VIEW').toUpperCase();
  const allowed = ['BANNER','INTERSTITIAL','REWARDED','NATIVE','CUSTOM_BANNER'];
  if (!allowed.includes(type)) throw new AppError('Invalid ad type', 400);
  if (!['VIEW','COMPLETED'].includes(event)) throw new AppError('Invalid ad event', 400);
  await prisma.adImpression.create({ data: { userId: req.user.id, type, event } });
  res.json({ success: true });
});

const listAdmins = asyncHandler(async (_req, res) => {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN','SUPER_ADMIN','MODERATOR','FINANCE'] } },
    orderBy: { createdAt: 'asc' },
    select: { id:true, name:true, email:true, role:true, status:true, freezeUntil:true, adminPermissions:true, createdAt:true, lastLoginAt:true }
  });
  res.json({ success:true, items: admins });
});

const createAdmin = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const name = String(req.body.name || '').trim();
  const password = String(req.body.password || '');
  const role = String(req.body.role || 'ADMIN');
  if (!email || !name || password.length < 8) throw new AppError('Name, email and password (8+ chars) required', 400);
  if (!['ADMIN','MODERATOR','FINANCE'].includes(role)) throw new AppError('Invalid admin role', 400);
  const permissions = Array.isArray(req.body.permissions) ? req.body.permissions.filter(p => ALL_PERMISSIONS.includes(p) || p === '*') : [];
  const exists = await prisma.user.findUnique({ where:{ email } });
  if (exists) throw new AppError('Email already exists', 409);
  const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const admin = await prisma.user.create({ data: { email, name, password:hash, role, referralCode: `ADM${randomCode(8)}`, adminPermissions: permissions } });
  await logAdmin(req.user, 'ADMIN_CREATE', admin.id, { email, role, permissions });
  res.status(201).json({ success:true, admin: { id:admin.id,name:admin.name,email:admin.email,role:admin.role,status:admin.status,adminPermissions:admin.adminPermissions } });
});

const updateAdmin = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const target = await prisma.user.findUnique({ where:{id} });
  if (!target || !['ADMIN','SUPER_ADMIN','MODERATOR','FINANCE'].includes(target.role)) throw new AppError('Admin not found',404);
  if (target.email === 'admin1@tikboost.app') throw new AppError('Primary super admin is protected',403);
  const data = {};
  if (req.body.name !== undefined) data.name = String(req.body.name).trim();
  if (req.body.role && ['ADMIN','MODERATOR','FINANCE'].includes(req.body.role)) data.role = req.body.role;
  if (Array.isArray(req.body.permissions)) data.adminPermissions = req.body.permissions.filter(p => ALL_PERMISSIONS.includes(p) || p === '*');
  if (req.body.status === 'ACTIVE') { data.status='ACTIVE'; data.freezeUntil=null; }
  if (req.body.status === 'FROZEN') { data.status='FROZEN'; data.freezeUntil=new Date(Date.now()+env.FREEZE_DURATION_MIN*60000); }
  if (req.body.password) data.password = await bcrypt.hash(String(req.body.password), env.BCRYPT_ROUNDS);
  const admin = await prisma.user.update({ where:{id}, data });
  await logAdmin(req.user,'ADMIN_UPDATE',id,{ fields:Object.keys(data) });
  res.json({success:true,admin:{id:admin.id,name:admin.name,email:admin.email,role:admin.role,status:admin.status,freezeUntil:admin.freezeUntil,adminPermissions:admin.adminPermissions}});
});

const deleteAdmin = asyncHandler(async (req,res) => {
  const target = await prisma.user.findUnique({ where:{id:req.params.id}, select:{id:true,email:true,role:true} });
  if (!target || !['ADMIN','SUPER_ADMIN','MODERATOR','FINANCE'].includes(target.role)) throw new AppError('Admin not found',404);
  if (target.email === 'admin1@tikboost.app' || target.id === req.user.id) throw new AppError('Protected admin',403);
  await prisma.user.delete({ where:{id:target.id} });
  await logAdmin(req.user,'ADMIN_DELETE',target.id,{email:target.email});
  res.json({success:true});
});

module.exports = {
  listUsers,
  userDetail,
  updateUser,
  deleteUser,
  freezeUser,
  unfreezeUser,
  banUser,
  grantPoints,
  updateRole,
  listCampaigns,
  campaignAction,
  listPurchases,
  approvePurchase,
  rejectPurchase,
  listReports,
  resolveReport,
  sendNotification,
  listPasswordResetRequests,
  revealPasswordResetCode,
  cancelPasswordResetRequest,
  getRewardSettings,
  updateRewardSettings,
  getAdSettings,
  updateAdSettings,
  getAppSettings,
  updateAppSettings,
  getPricingSettings,
  updatePricingSettings,
  getPaymentSettings,
  updatePaymentSettings,
  listWheelPrizes,
  updateWheelPrize,
  stats,
  topUsers,
  chart,
  adminLogs,
  listAdAnalytics, recordAdEvent, listAdmins, createAdmin, updateAdmin, deleteAdmin,
};
