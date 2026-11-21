const prisma = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { asyncHandler } = require('../utils/helpers');
const { adjustPoints } = require('../services/points.service');
const fcm = require('../services/fcm.service');
const { notifyUsers, tokensForUsers, getLastBroadcast } = require('../services/notifications.service');
const { getIO } = require('../sockets/io');

const DAY = 24 * 60 * 60 * 1000;
const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'reward'];
const AUDIENCES = ['ALL', 'VIP_PRO', 'SELECTED', 'INACTIVE', 'NEW_USERS', 'COUNTRY'];

async function logAdmin(actor, action, target, details) {
  await prisma.adminLog.create({
    data: { actorId: actor.id, action, target, details, ip: actor.lastIp || '' },
  });
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Turns an audience description into a list of user ids.
 * Shared by notifications and bulk commands so both always agree on "who".
 */
async function resolveAudience(input = {}) {
  const audience = String(input.audience || '').toUpperCase() || (
    Array.isArray(input.userIds) && input.userIds.length ? 'SELECTED' : input.userId ? 'SELECTED' : 'ALL'
  );
  if (!AUDIENCES.includes(audience)) throw new AppError('نوع الجمهور غير صالح', 400, 'INVALID_AUDIENCE');

  const now = new Date();
  let where;
  switch (audience) {
    case 'ALL':
      where = { status: 'ACTIVE' };
      break;
    case 'VIP_PRO':
      where = { status: 'ACTIVE', OR: [{ role: 'DEVELOPER' }, { vipProUntil: { gt: now } }] };
      break;
    case 'INACTIVE': {
      const cutoff = new Date(now.getTime() - clampInt(input.days, 1, 365, 7) * DAY);
      where = { status: 'ACTIVE', OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: cutoff } }] };
      break;
    }
    case 'NEW_USERS': {
      const since = new Date(now.getTime() - clampInt(input.days, 1, 365, 7) * DAY);
      where = { status: 'ACTIVE', createdAt: { gte: since } };
      break;
    }
    case 'COUNTRY': {
      const code = String(input.countryCode || '').trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(code)) throw new AppError('رمز الدولة غير صالح (مثال: DZ)', 400, 'INVALID_COUNTRY');
      where = { status: 'ACTIVE', countryCode: code };
      break;
    }
    case 'SELECTED': {
      const picked = Array.isArray(input.userIds) ? input.userIds : (input.userId ? [input.userId] : []);
      const ids = [...new Set(picked.filter(Boolean).map(String))];
      if (!ids.length) return { audience, ids: [] };
      where = { id: { in: ids } };
      break;
    }
    default:
      where = { status: 'ACTIVE' };
  }

  const users = await prisma.user.findMany({ where, select: { id: true } });
  return { audience, ids: users.map((u) => u.id) };
}

// ===================== Notifications =====================

const sendNotification = asyncHandler(async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const body = String(req.body?.body || '').trim();
  if (!title || !body) throw new AppError('title & body required', 400);
  if (title.length > 120) throw new AppError('العنوان طويل جداً (الحد 120 حرفاً)', 400);
  if (body.length > 500) throw new AppError('النص طويل جداً (الحد 500 حرف)', 400);

  const type = NOTIFICATION_TYPES.includes(req.body?.type) ? req.body.type : 'info';
  const payloadData = req.body?.data && typeof req.body.data === 'object' ? req.body.data : null;

  const { audience, ids } = await resolveAudience(req.body || {});
  if (!ids.length) throw new AppError('لا يوجد مستخدمون مستهدفون', 404);

  if (req.body?.preview) {
    const devices = (await tokensForUsers(ids)).length;
    return res.json({ success: true, preview: true, audience, count: ids.length, devices });
  }

  const result = await notifyUsers(ids, title, body, type, payloadData, { audience, waitMs: 8000 });
  const push = result.push
    ? { total: result.push.total, sent: result.push.sent, failed: result.push.failed, skipped: result.push.skipped, errors: result.push.errors, purged: result.push.purged }
    : null;

  await logAdmin(req.user, `NOTIFY_${audience}`, audience === 'SELECTED' ? ids.slice(0, 20).join(',') : null, {
    title,
    count: ids.length,
    devices: result.devices,
    audience,
    push: push && { sent: push.sent, failed: push.failed, skipped: push.skipped },
  });

  res.json({
    success: true,
    audience,
    count: ids.length,
    deliveredTo: ids.length,
    devices: result.devices,
    push,
    pending: result.pending,
    firebaseConfigured: fcm.isConfigured(),
  });
});

const notificationHistory = asyncHandler(async (req, res) => {
  const limit = clampInt(req.query.limit, 1, 200, 50);
  const items = await prisma.adminLog.findMany({
    where: { action: { startsWith: 'NOTIFY' } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { actor: { select: { name: true, email: true } } },
  });
  res.json({
    success: true,
    items: items.map((l) => ({
      id: l.id,
      action: l.action,
      details: l.details,
      actor: l.actor,
      createdAt: l.createdAt,
    })),
  });
});

const pushStatus = asyncHandler(async (_req, res) => {
  const now = new Date();
  const [activeUsers, withDevice, legacyOnly, devices, devices7d, devices24h, platforms, last] = await Promise.all([
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'ACTIVE', deviceTokens: { some: {} } } }),
    prisma.user.count({ where: { status: 'ACTIVE', fcmToken: { not: null }, deviceTokens: { none: {} } } }),
    prisma.deviceToken.count(),
    prisma.deviceToken.count({ where: { lastSeenAt: { gte: new Date(now.getTime() - 7 * DAY) } } }),
    prisma.deviceToken.count({ where: { lastSeenAt: { gte: new Date(now.getTime() - DAY) } } }),
    prisma.deviceToken.groupBy({ by: ['platform'], _count: { _all: true } }),
    getLastBroadcast(),
  ]);

  const reachable = withDevice + legacyOnly;
  res.json({
    success: true,
    firebase: {
      configured: fcm.isConfigured(),
      projectId: fcm.getProjectId(),
      channelId: fcm.ANDROID_CHANNEL_ID,
    },
    users: {
      active: activeUsers,
      reachable,
      unreachable: Math.max(0, activeUsers - reachable),
      coverage: activeUsers ? Math.round((reachable / activeUsers) * 1000) / 10 : 0,
    },
    devices: {
      total: devices,
      seenLast7Days: devices7d,
      seenLast24Hours: devices24h,
      byPlatform: Object.fromEntries(platforms.map((p) => [p.platform, p._count._all])),
    },
    lastBroadcast: last,
  });
});

const pushTest = asyncHandler(async (req, res) => {
  if (!fcm.isConfigured()) {
    throw new AppError('Firebase غير مفعّل على الخادم: أضف FIREBASE_SERVICE_ACCOUNT_JSON في إعدادات البيئة.', 400, 'FCM_NOT_CONFIGURED');
  }
  const userId = String(req.body?.userId || req.user.id);
  const tokens = await tokensForUsers([userId]);
  if (!tokens.length) {
    throw new AppError('لا يوجد جهاز مسجّل لهذا المستخدم. يجب فتح التطبيق وتسجيل الدخول مرة واحدة على الأقل.', 404, 'NO_DEVICE');
  }

  const results = [];
  const dead = [];
  for (const token of tokens) {
    const r = await fcm.sendPush(token, 'اختبار الإشعارات ✅', 'إذا ظهر هذا الإشعار فإن نظام الإشعارات يعمل بشكل صحيح.', 'info', { event: 'PUSH_TEST' });
    if (r.deadToken) dead.push(token);
    results.push({
      device: `…${token.slice(-8)}`,
      sent: !!r.sent,
      code: r.code || null,
      message: r.sent ? null : (r.message || r.reason || null),
    });
  }
  const purged = await fcm.purgeDeadTokens(dead);
  await logAdmin(req.user, 'PUSH_TEST', userId, { devices: tokens.length, sent: results.filter((r) => r.sent).length, purged });
  res.json({ success: true, userId, devices: tokens.length, sent: results.filter((r) => r.sent).length, purged, results });
});

// ===================== System health =====================

const systemHealth = asyncHandler(async (_req, res) => {
  const startedAt = Date.now();
  let dbOk = true;
  try { await prisma.$queryRaw`SELECT 1`; } catch (_) { dbOk = false; }
  const dbMs = Date.now() - startedAt;

  const now = new Date();
  const [pendingPurchases, openReports, pendingVip, pendingResets, notificationsTotal, deviceTotal] = await Promise.all([
    prisma.purchase.count({ where: { status: 'PENDING' } }).catch(() => null),
    prisma.report.count({ where: { status: 'OPEN' } }).catch(() => null),
    prisma.vipSubscription.count({ where: { status: 'PENDING' } }).catch(() => null),
    prisma.passwordResetToken.count({ where: { status: 'PENDING', expiresAt: { gt: now } } }).catch(() => null),
    prisma.notification.count().catch(() => null),
    prisma.deviceToken.count().catch(() => null),
  ]);

  const mem = process.memoryUsage();
  const warnings = [];
  if (!dbOk) warnings.push({ level: 'error', text: 'قاعدة البيانات لا تستجيب.' });
  if (!fcm.isConfigured()) warnings.push({ level: 'error', text: 'Firebase غير مفعّل: لن تصل إشعارات الهاتف (أضف FIREBASE_SERVICE_ACCOUNT_JSON).' });
  if (env.NODE_ENV !== 'production') warnings.push({ level: 'warn', text: 'الخادم لا يعمل بوضع production.' });
  if (env.JWT_ACCESS_SECRET === 'dev_access_secret' || env.JWT_REFRESH_SECRET === 'dev_refresh_secret') {
    warnings.push({ level: 'error', text: 'مفاتيح JWT الافتراضية قيد الاستخدام — يجب استبدالها فوراً.' });
  }
  if (env.EMAIL_PROVIDER !== 'smtp' && !env.EMAIL_API_KEY) warnings.push({ level: 'warn', text: 'مزود البريد الإلكتروني غير مضبوط (EMAIL_API_KEY).' });
  if (env.SOCKET_CORS_ORIGIN === '*') warnings.push({ level: 'warn', text: 'CORS مفتوح للجميع (SOCKET_CORS_ORIGIN=*).' });
  if (!env.PAYPAL_CLIENT_ID) warnings.push({ level: 'info', text: 'PayPal غير مضبوط.' });
  if (!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) warnings.push({ level: 'info', text: 'التحقق من مشتريات Google Play غير مضبوط.' });
  if (notificationsTotal !== null && notificationsTotal > 500000) {
    warnings.push({ level: 'warn', text: `جدول الإشعارات كبير (${notificationsTotal}). استخدم أمر "حذف الإشعارات القديمة".` });
  }

  res.json({
    success: true,
    server: {
      nodeVersion: process.version,
      environment: env.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: Math.round(mem.rss / 1048576),
      heapMb: Math.round(mem.heapUsed / 1048576),
      socketClients: getIO()?.engine?.clientsCount ?? 0,
    },
    database: { ok: dbOk, latencyMs: dbMs },
    services: {
      firebase: fcm.isConfigured(),
      email: env.EMAIL_PROVIDER === 'smtp' ? !!env.SMTP_HOST : !!env.EMAIL_API_KEY,
      paypal: !!env.PAYPAL_CLIENT_ID,
      googlePlay: !!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON,
      googleLogin: !!env.ENABLE_GOOGLE_LOGIN,
    },
    queues: { pendingPurchases, openReports, pendingVip, pendingResets },
    tables: { notifications: notificationsTotal, devices: deviceTotal },
    warnings,
  });
});

// ===================== Command center =====================

const COMMANDS = [
  {
    key: 'PURGE_STALE_DEVICES',
    title: 'حذف الأجهزة غير النشطة',
    description: 'يحذف رموز الإشعارات للأجهزة التي لم تفتح التطبيق منذ مدة طويلة.',
    icon: '📱',
    danger: false,
    superOnly: false,
    params: [{ name: 'days', label: 'عدد الأيام', type: 'number', default: 60, min: 7, max: 730 }],
  },
  {
    key: 'DELETE_OLD_NOTIFICATIONS',
    title: 'حذف الإشعارات القديمة',
    description: 'يخفّف قاعدة البيانات بحذف الإشعارات الأقدم من المدة المحددة (البث ينشئ صفاً لكل مستخدم).',
    icon: '🧹',
    danger: true,
    superOnly: false,
    params: [{ name: 'days', label: 'أقدم من (يوم)', type: 'number', default: 90, min: 14, max: 730 }],
  },
  {
    key: 'CLEAN_EXPIRED_SESSIONS',
    title: 'تنظيف الجلسات المنتهية',
    description: 'يحذف رموز التحديث المنتهية/الملغاة وطلبات استعادة كلمة المرور القديمة.',
    icon: '🔐',
    danger: false,
    superOnly: false,
    params: [],
  },
  {
    key: 'REVOKE_USER_SESSIONS',
    title: 'إنهاء جلسات مستخدم',
    description: 'يسجّل خروج المستخدم من كل الأجهزة ويوقف إشعاراته (مفيد عند الاشتباه باختراق الحساب).',
    icon: '🚪',
    danger: true,
    superOnly: false,
    params: [{ name: 'email', label: 'البريد الإلكتروني للمستخدم', type: 'text', default: '' }],
  },
  {
    key: 'GRANT_POINTS_AUDIENCE',
    title: 'منح نقاط لشريحة مستخدمين',
    description: 'يمنح عدد نقاط محدداً لجمهور مختار (الجميع، VIP، غير النشطين...) مع إشعار تلقائي. للمدير الرئيسي فقط.',
    icon: '🎁',
    danger: true,
    superOnly: true,
    params: [
      { name: 'audience', label: 'الجمهور', type: 'select', default: 'ALL', options: ['ALL', 'VIP_PRO', 'INACTIVE', 'NEW_USERS', 'COUNTRY'] },
      { name: 'days', label: 'الأيام (للنشاط/الجدد)', type: 'number', default: 7, min: 1, max: 365 },
      { name: 'countryCode', label: 'رمز الدولة (للدولة)', type: 'text', default: '' },
      { name: 'amount', label: 'النقاط لكل مستخدم', type: 'number', default: 100, min: 1, max: 1000000 },
      { name: 'reason', label: 'سبب المنحة (يظهر للمستخدم)', type: 'text', default: 'هدية من الإدارة' },
    ],
  },
];

const MAX_BULK_GRANT_USERS = 5000;

async function runCommandImpl(command, params, actor, dryRun) {
  const now = new Date();
  switch (command) {
    case 'PURGE_STALE_DEVICES': {
      const days = clampInt(params.days, 7, 730, 60);
      const where = { lastSeenAt: { lt: new Date(now.getTime() - days * DAY) } };
      if (dryRun) return { affected: await prisma.deviceToken.count({ where }), message: `أجهزة لم تُرَ منذ ${days} يوماً` };
      const r = await prisma.deviceToken.deleteMany({ where });
      return { affected: r.count, message: `تم حذف ${r.count} جهاز غير نشط` };
    }
    case 'DELETE_OLD_NOTIFICATIONS': {
      const days = clampInt(params.days, 14, 730, 90);
      const where = { createdAt: { lt: new Date(now.getTime() - days * DAY) } };
      if (dryRun) return { affected: await prisma.notification.count({ where }), message: `إشعارات أقدم من ${days} يوماً` };
      const r = await prisma.notification.deleteMany({ where });
      return { affected: r.count, message: `تم حذف ${r.count} إشعار قديم` };
    }
    case 'CLEAN_EXPIRED_SESSIONS': {
      const refreshWhere = { OR: [{ expiresAt: { lt: now } }, { revoked: true, createdAt: { lt: new Date(now.getTime() - 7 * DAY) } }] };
      const resetWhere = { expiresAt: { lt: new Date(now.getTime() - DAY) } };
      if (dryRun) {
        const [a, b] = await Promise.all([prisma.refreshToken.count({ where: refreshWhere }), prisma.passwordResetToken.count({ where: resetWhere })]);
        return { affected: a + b, message: `${a} جلسة منتهية و${b} طلب استعادة قديم` };
      }
      const [a, b] = await Promise.all([prisma.refreshToken.deleteMany({ where: refreshWhere }), prisma.passwordResetToken.deleteMany({ where: resetWhere })]);
      return { affected: a.count + b.count, message: `تم حذف ${a.count} جلسة و${b.count} طلب استعادة` };
    }
    case 'REVOKE_USER_SESSIONS': {
      const email = String(params.email || '').trim().toLowerCase();
      if (!email) throw new AppError('أدخل بريد المستخدم', 400);
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, name: true } });
      if (!user) throw new AppError('المستخدم غير موجود', 404);
      if (user.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') throw new AppError('غير مسموح', 403);
      const [sessions, devices] = await Promise.all([
        prisma.refreshToken.count({ where: { userId: user.id, revoked: false } }),
        prisma.deviceToken.count({ where: { userId: user.id } }),
      ]);
      if (dryRun) return { affected: sessions + devices, message: `${sessions} جلسة نشطة و${devices} جهاز للمستخدم ${user.name}` };
      await prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { revoked: true } });
      await prisma.deviceToken.deleteMany({ where: { userId: user.id } });
      await prisma.user.update({ where: { id: user.id }, data: { fcmToken: null } });
      return { affected: sessions + devices, message: `تم إنهاء ${sessions} جلسة وإزالة ${devices} جهاز للمستخدم ${user.name}`, target: user.id };
    }
    case 'GRANT_POINTS_AUDIENCE': {
      if (actor.role !== 'SUPER_ADMIN') throw new AppError('هذا الأمر للمدير الرئيسي فقط', 403, 'SUPER_ADMIN_REQUIRED');
      const amount = clampInt(params.amount, 1, 1000000, 0);
      if (!amount) throw new AppError('أدخل عدد نقاط صالحاً', 400);
      const reason = String(params.reason || 'هدية من الإدارة').trim().slice(0, 120);
      const { audience, ids } = await resolveAudience({
        audience: params.audience === 'SELECTED' ? 'ALL' : params.audience,
        days: params.days,
        countryCode: params.countryCode,
      });
      if (!ids.length) throw new AppError('لا يوجد مستخدمون ضمن هذا الجمهور', 404);
      if (ids.length > MAX_BULK_GRANT_USERS) {
        throw new AppError(`الجمهور كبير (${ids.length}). الحد الأقصى ${MAX_BULK_GRANT_USERS} مستخدم لكل أمر — اختر شريحة أضيق.`, 400);
      }
      if (dryRun) return { affected: ids.length, message: `سيحصل ${ids.length} مستخدم على ${amount} نقطة لكل منهم (الإجمالي ${ids.length * amount})` };

      const granted = [];
      let failed = 0;
      for (const id of ids) {
        try {
          await adjustPoints(id, BigInt(amount), 'ADMIN_GRANT', { note: `${reason} (bulk by ${actor.id})` });
          granted.push(id);
        } catch (_) { failed += 1; }
      }
      if (granted.length) {
        await notifyUsers(granted, '🎁 هدية من الإدارة', `${reason}: حصلت على ${amount} نقطة.`, 'reward', { event: 'BULK_GRANT', amount }, { audience: `GRANT_${audience}`, waitMs: 0, record: false });
      }
      return { affected: granted.length, message: `تم منح ${amount} نقطة لـ ${granted.length} مستخدم${failed ? ` (تعذّر ${failed})` : ''}`, failed };
    }
    default:
      throw new AppError('أمر غير معروف', 400, 'UNKNOWN_COMMAND');
  }
}

const listCommands = asyncHandler(async (req, res) => {
  const isSuper = req.user.role === 'SUPER_ADMIN';
  res.json({ success: true, commands: COMMANDS.filter((c) => isSuper || !c.superOnly) });
});

const runCommand = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    throw new AppError('مركز الأوامر متاح للمدراء فقط', 403, 'ADMIN_REQUIRED');
  }
  const command = String(req.body?.command || '').toUpperCase();
  const def = COMMANDS.find((c) => c.key === command);
  if (!def) throw new AppError('أمر غير معروف', 400, 'UNKNOWN_COMMAND');
  if (def.superOnly && req.user.role !== 'SUPER_ADMIN') throw new AppError('هذا الأمر للمدير الرئيسي فقط', 403, 'SUPER_ADMIN_REQUIRED');

  const dryRun = req.body?.dryRun !== false; // safe by default: preview unless explicitly executed
  const params = req.body?.params && typeof req.body.params === 'object' ? req.body.params : {};

  const result = await runCommandImpl(command, params, req.user, dryRun);
  if (!dryRun) {
    await logAdmin(req.user, `COMMAND_${command}`, result.target || null, { params, affected: result.affected, message: result.message });
  }
  res.json({ success: true, command, dryRun, ...result });
});

module.exports = {
  AUDIENCES,
  resolveAudience,
  sendNotification,
  notificationHistory,
  pushStatus,
  pushTest,
  systemHealth,
  listCommands,
  runCommand,
};
