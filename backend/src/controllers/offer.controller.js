const prisma = require('../config/db');
const { AppError } = require('../utils/errors');
const { asyncHandler } = require('../utils/helpers');
const { normalizeCountryCode } = require('../utils/audience');

const TARGET_GENDERS = ['ALL', 'MALE', 'FEMALE'];

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
    startsAt: o.startsAt,
    endsAt: o.endsAt,
    isActive: o.isActive,
    sortOrder: o.sortOrder,
    createdAt: o.createdAt,
  };
}

function buildOfferData(body, { partial = false } = {}) {
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
  if (!partial || body.startsAt !== undefined) data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (!partial || body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (!partial || body.isActive !== undefined) data.isActive = !!body.isActive;
  if (!partial || body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder, 10) || 0;

  if (!partial && !data.title) throw new AppError('title is required', 400);
  if (!partial && (data.newPriceCents === undefined)) throw new AppError('newPriceCents is required', 400);
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
    return true;
  });

  res.json({ success: true, offers: filtered.map(serializeOffer) });
});

const listAdmin = asyncHandler(async (_req, res) => {
  const offers = await prisma.offer.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  res.json({ success: true, items: offers.map(serializeOffer) });
});

const createAdmin = asyncHandler(async (req, res) => {
  const data = buildOfferData(req.body);
  const offer = await prisma.offer.create({ data });
  res.status(201).json({ success: true, item: serializeOffer(offer) });
});

const updateAdmin = asyncHandler(async (req, res) => {
  const existing = await prisma.offer.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError('Offer not found', 404);
  const data = buildOfferData(req.body, { partial: true });
  const offer = await prisma.offer.update({ where: { id: req.params.id }, data });
  res.json({ success: true, item: serializeOffer(offer) });
});

const deleteAdmin = asyncHandler(async (req, res) => {
  const existing = await prisma.offer.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError('Offer not found', 404);
  await prisma.offer.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

module.exports = { listPublic, listAdmin, createAdmin, updateAdmin, deleteAdmin };
