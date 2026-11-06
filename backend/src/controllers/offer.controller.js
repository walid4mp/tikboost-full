const prisma = require('../config/db');
const { AppError } = require('../utils/errors');
const { asyncHandler } = require('../utils/helpers');
const { normalizeCountryCode } = require('../utils/audience');
const { getSettings } = require('../services/appSettings.service');

const TARGET_GENDERS = ['ALL', 'MALE', 'FEMALE'];
const AUDIENCES = ['ALL', 'SELECTED_USER', 'VIP_PRO', 'NEW_USERS', 'ACTIVE_TASKERS', 'INACTIVE'];

function activeNow(o, now = new Date()) {
  return o.isActive &&
    (!o.startsAt || o.startsAt <= now) &&
    (!o.endsAt || o.endsAt >= now);
}

function userMatchesOffer(o, user, counters = {}) {
  if (!user || !activeNow(o)) return false;
  const audience = String(o.audience || 'ALL').toUpperCase();
  if (o.targetUserId && o.targetUserId !== user.id) return false;
  if (audience === 'SELECTED_USER' && o.targetUserId !== user.id) return false;
  if (audience === 'VIP_PRO' && !(user.vipProUntil && user.vipProUntil > new Date())) return false;
  if (audience === 'NEW_USERS' && (Date.now() - new Date(user.createdAt).getTime()) > 7 * 86400000) return false;
  if (audience === 'ACTIVE_TASKERS' && Number(counters.tasksCompleted || 0) < Math.max(1, Number(o.minTasks || 1))) return false;
  if (audience === 'INACTIVE' && (Date.now() - new Date(user.lastLoginAt || user.createdAt).getTime()) < 3 * 86400000) return false;
  if (o.targetVip && !(user.vipProUntil && user.vipProUntil > new Date())) return false;
  const targetGender = String(o.targetGender || 'ALL').toUpperCase();
  if (targetGender !== 'ALL' && targetGender !== String(user.gender || '').toUpperCase()) return false;
  const targetCountry = String(o.targetCountry || 'WORLDWIDE').toUpperCase();
  if (targetCountry !== 'WORLDWIDE' && targetCountry !== String(user.countryCode || '').toUpperCase()) return false;
  const tasks = Number(counters.tasksCompleted || 0);
  if (tasks < Number(o.minTasks || 0)) return false;
  if (o.maxTasks != null && tasks > Number(o.maxTasks)) return false;
  const points = BigInt(user.points || 0);
  if (points < BigInt(o.minPoints || 0)) return false;
  if (o.maxPoints != null && points > BigInt(o.maxPoints)) return false;
  return true;
}

function serializeOffer(o) {
  return {
    id: o.id,
    title: o.title,
    description: o.description,
    oldPriceCents: o.oldPriceCents,
    newPriceCents: o.newPriceCents,
    oldPrice: (o.oldPriceCents ?? 0) / 100,
    newPrice: o.newPriceCents / 100,
    discountPct: o.discountPct,
    currency: o.currency,
    packageId: o.packageId,
    targetGender: o.targetGender,
    targetCountry: o.targetCountry,
    audience: o.audience,
    targetUserId: o.targetUserId,
    targetVip: o.targetVip,
    minTasks: o.minTasks,
    maxTasks: o.maxTasks,
    minPoints: o.minPoints?.toString?.() ?? '0',
    maxPoints: o.maxPoints?.toString?.() ?? null,
    pointsOverride: o.pointsOverride?.toString?.() ?? null,
    showNotification: o.showNotification,
    maxClaimsPerUser: o.maxClaimsPerUser,
    startsAt: o.startsAt,
    endsAt: o.endsAt,
    isActive: o.isActive,
    sortOrder: o.sortOrder,
    createdAt: o.createdAt,
  };
}

function parseBigIntValue(value, fallback = 0n) {
  if (value === undefined || value === null || value === '') return fallback;
  try { return BigInt(String(value).trim()); }
  catch { throw new AppError('Invalid integer value', 400, 'INVALID_INTEGER'); }
}

function buildOfferData(body = {}, { partial = false } = {}) {
  const data = {};
  if (!partial || body.title !== undefined) data.title = String(body.title || '').trim();
  if (!partial || body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
  if (!partial || body.newPriceCents !== undefined) data.newPriceCents = Math.max(0, parseInt(body.newPriceCents, 10) || 0);
  if (!partial || body.oldPriceCents !== undefined) data.oldPriceCents = body.oldPriceCents === null || body.oldPriceCents === '' ? null : Math.max(0, parseInt(body.oldPriceCents, 10) || 0);
  if (!partial || body.discountPct !== undefined) data.discountPct = body.discountPct === null || body.discountPct === '' ? null : Math.min(100, Math.max(0, parseInt(body.discountPct, 10) || 0));
  if (!partial || body.currency !== undefined) data.currency = String(body.currency || 'USD').trim().toUpperCase();
  if (!partial || body.packageId !== undefined) data.packageId = body.packageId || null;
  if (!partial || body.targetGender !== undefined) {
    const g = String(body.targetGender || 'ALL').trim().toUpperCase();
    if (!TARGET_GENDERS.includes(g)) throw new AppError('Invalid targetGender', 400);
    data.targetGender = g;
  }
  if (!partial || body.targetCountry !== undefined) {
    const c = normalizeCountryCode(body.targetCountry, { allowWorldwide: true });
    if (!c) throw new AppError('Invalid targetCountry', 400);
    data.targetCountry = c;
  }
  if (!partial || body.audience !== undefined) {
    const a = String(body.audience || 'ALL').trim().toUpperCase();
    if (!AUDIENCES.includes(a)) throw new AppError('Invalid audience', 400);
    data.audience = a;
  }
  if (!partial || body.targetUserId !== undefined) data.targetUserId = body.targetUserId ? String(body.targetUserId) : null;
  if (!partial || body.targetVip !== undefined) data.targetVip = !!body.targetVip;
  if (!partial || body.minTasks !== undefined) data.minTasks = Math.max(0, parseInt(body.minTasks, 10) || 0);
  if (!partial || body.maxTasks !== undefined) data.maxTasks = body.maxTasks === null || body.maxTasks === '' ? null : Math.max(0, parseInt(body.maxTasks, 10) || 0);
  if (!partial || body.minPoints !== undefined) data.minPoints = parseBigIntValue(body.minPoints, 0n);
  if (!partial || body.maxPoints !== undefined) data.maxPoints = body.maxPoints === null || body.maxPoints === '' ? null : parseBigIntValue(body.maxPoints, null);
  if (!partial || body.pointsOverride !== undefined) data.pointsOverride = body.pointsOverride === null || body.pointsOverride === '' ? null : parseBigIntValue(body.pointsOverride, null);
  if (!partial || body.showNotification !== undefined) data.showNotification = body.showNotification !== false;
  if (!partial || body.maxClaimsPerUser !== undefined) data.maxClaimsPerUser = body.maxClaimsPerUser === null || body.maxClaimsPerUser === '' ? null : Math.max(1, parseInt(body.maxClaimsPerUser, 10) || 1);
  if (!partial || body.startsAt !== undefined) data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (!partial || body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (!partial || body.isActive !== undefined) data.isActive = !!body.isActive;
  if (!partial || body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder, 10) || 0;

  if (!partial && !data.title) throw new AppError('title is required', 400);
  if (!partial && data.newPriceCents === undefined) throw new AppError('newPriceCents is required', 400);
  if (data.startsAt && data.endsAt && data.endsAt < data.startsAt) throw new AppError('endsAt must be after startsAt', 400);
  return data;
}

const listPublic = asyncHandler(async (req, res) => {
  const now = new Date();
  const offers = await prisma.offer.findMany({
    where: {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  const gender = req.query.gender ? String(req.query.gender).toUpperCase() : null;
  const country = req.query.country ? normalizeCountryCode(req.query.country, { allowWorldwide: true }) : null;
  const filtered = offers.filter((o) => {
    if (o.targetGender !== 'ALL' && gender && o.targetGender !== gender) return false;
    if (o.targetCountry !== 'WORLDWIDE' && country && o.targetCountry !== country) return false;
    return o.audience === 'ALL' && !o.targetUserId;
  });
  res.json({ success: true, offers: filtered.map(serializeOffer) });
});

const listPersonalized = asyncHandler(async (req, res) => {
  const now = new Date();
  const [user, counters, offers] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.user.id } }),
    prisma.task.count({ where: { executorId: req.user.id, status: 'VERIFIED' } }).then(tasksCompleted => ({ tasksCompleted })),
    prisma.offer.findMany({ where: { isActive: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }),
  ]);
  if (!user) throw new AppError('User not found', 404);
  const eligible = offers.filter((o) => userMatchesOffer(o, user, counters));
  const withClaims = [];
  for (const offer of eligible) {
    if (offer.maxClaimsPerUser != null) {
      const count = await prisma.purchase.count({ where: { userId: user.id, offerId: offer.id } });
      if (count >= offer.maxClaimsPerUser) continue;
    }
    const rawTitle = offer.title.includes('{name}') ? offer.title.replaceAll('{name}', user.name) : offer.title;
    const title = rawTitle.startsWith('عرض خاص لك') ? rawTitle : `عرض خاص لك يا ${user.name} — ${rawTitle}`;
    withClaims.push({ ...serializeOffer(offer), title, points: offer.pointsOverride?.toString() || null });
  }
  res.json({ success: true, offers: withClaims.slice(0, 5) });
});

const purchase = asyncHandler(async (req, res) => {
  const offer = await prisma.offer.findUnique({ where: { id: req.params.id } });
  if (!offer) throw new AppError('Offer not found', 404);
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const tasksCompleted = await prisma.task.count({ where: { executorId: req.user.id, status: 'VERIFIED' } });
  if (!userMatchesOffer(offer, user, { tasksCompleted })) throw new AppError('هذا العرض غير متاح لحسابك حالياً.', 403, 'OFFER_NOT_ELIGIBLE');
  if (!offer.packageId) throw new AppError('هذا العرض غير مرتبط بباقة شراء.', 400);
  if (offer.maxClaimsPerUser != null) {
    const count = await prisma.purchase.count({ where: { userId: req.user.id, offerId: offer.id } });
    if (count >= offer.maxClaimsPerUser) throw new AppError('لقد استخدمت هذا العرض مسبقاً.', 409, 'OFFER_LIMIT_REACHED');
  }
  const pkg = await prisma.pointPackage.findUnique({ where: { id: offer.packageId } });
  if (!pkg || !pkg.isActive) throw new AppError('الباقة المرتبطة بالعرض غير متاحة.', 404);
  const points = offer.pointsOverride != null ? BigInt(offer.pointsOverride) : BigInt(pkg.points) + BigInt(pkg.bonusPoints);
  const selectedMethod = String(req.body?.method || '').trim().toLowerCase();
  const settings = await getSettings();
  const paymentMethod = (settings.payments?.methods || []).find((item) => item.key === selectedMethod && item.enabled !== false);
  if (!paymentMethod) throw new AppError('طريقة الدفع غير متاحة حالياً. اختر طريقة دفع مفعلة.', 400, 'PAYMENT_METHOD_DISABLED');
  const receipt = typeof req.body?.receiptImageData === 'string' ? req.body.receiptImageData.trim() : '';
  if (receipt && receipt.length > 1900000) throw new AppError('صورة الإثبات كبيرة جداً.', 400);
  const reference = req.body?.transactionId || req.body?.reference || '';
  const tx = String(reference).trim().slice(0, 255);
  if (!tx || !receipt) throw new AppError('رقم المعاملة وصورة إثبات الدفع مطلوبان.', 400, 'PAYMENT_PROOF_REQUIRED');
  const duplicate = await prisma.purchase.findFirst({ where: { reference: tx, status: { in: ['PENDING', 'APPROVED'] } }, select: { id: true } });
  if (duplicate) throw new AppError('رقم المعاملة مستخدم مسبقاً.', 409);
  const row = await prisma.purchase.create({ data: {
    userId: req.user.id, packageId: pkg.id, offerId: offer.id, pointsGiven: points,
    priceCents: offer.newPriceCents, currency: offer.currency, method: selectedMethod, reference: tx,
    status: 'PENDING', notes: JSON.stringify({
      offerTitle: offer.title, receiptImageData: receipt,
      paymentMethod: { key: paymentMethod.key, label: paymentMethod.label, currency: paymentMethod.currency, walletAddress: paymentMethod.walletAddress || '', accountName: paymentMethod.accountName || '', network: paymentMethod.network || '', externalUrl: paymentMethod.externalUrl || '', feePercent: paymentMethod.feePercent || 0 },
    }),
  } });
  res.status(201).json({ success: true, purchase: row, offer: serializeOffer(offer), instructions: 'تم إرسال طلب العرض وإثبات الدفع. سيظهر في لوحة الإدارة بانتظار المراجعة.' });
});

const listAdmin = asyncHandler(async (_req, res) => {
  const offers = await prisma.offer.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  res.json({ success: true, items: offers.map(serializeOffer) });
});
const createAdmin = asyncHandler(async (req, res) => { const offer = await prisma.offer.create({ data: buildOfferData(req.body) }); res.status(201).json({ success: true, item: serializeOffer(offer) }); });
const updateAdmin = asyncHandler(async (req, res) => { const existing = await prisma.offer.findUnique({ where: { id: req.params.id } }); if (!existing) throw new AppError('Offer not found',404); const offer = await prisma.offer.update({ where: { id: req.params.id }, data: buildOfferData(req.body,{partial:true}) }); res.json({ success:true,item:serializeOffer(offer) }); });
const deleteAdmin = asyncHandler(async (req, res) => { const existing = await prisma.offer.findUnique({ where: { id: req.params.id } }); if (!existing) throw new AppError('Offer not found',404); await prisma.offer.delete({ where: { id:req.params.id } }); res.json({success:true}); });

module.exports = { listPublic, listPersonalized, purchase, listAdmin, createAdmin, updateAdmin, deleteAdmin, userMatchesOffer };
