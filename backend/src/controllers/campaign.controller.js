const { body, param } = require('express-validator');
const prisma = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { adjustPoints } = require('../services/points.service');
const { getIO } = require('../sockets/io');
const { asyncHandler } = require('../utils/helpers');

const PRICE = {
  FOLLOWERS: 100n,   // 100 points per follower requested
  LIKES:     20n,
  VIEWS:      5n,
  COMMENTS: 50n,
};
const REWARD = {
  FOLLOWERS: 80n,
  LIKES:     16n,
  VIEWS:      4n,
  COMMENTS: 40n,
};

const createValidators = [
  body('type').isIn(['FOLLOWERS','LIKES','VIEWS','COMMENTS']).withMessage('Invalid type'),
  body('targetUrl').isString().trim().isLength({ min: 10 }).withMessage('Valid target URL required'),
  body('quantity').isInt({ min: 1, max: 1000000 }).withMessage('Quantity 1-1,000,000'),
];

const create = asyncHandler(async (req, res) => {
  const { type, targetUrl, quantity, description } = req.body;
  const username = extractUsername(targetUrl);
  if (!username) throw new AppError('Invalid TikTok URL', 400);

  const active = await prisma.campaign.count({
    where: { ownerId: req.user.id, status: { in: ['ACTIVE','PENDING','PAUSED'] } },
  });
  if (active >= env.MAX_CAMPAIGNS_PER_USER) {
    throw new AppError(`Max ${env.MAX_CAMPAIGNS_PER_USER} open campaigns`, 400, 'LIMIT_CAMPAIGNS');
  }

  const perCost = PRICE[type];
  const perReward = REWARD[type];
  const totalCost = BigInt(quantity) * perCost;
  const balance = BigInt(req.user.points);
  if (balance < totalCost) throw new AppError('Insufficient points', 400, 'INSUFFICIENT_POINTS');

  // Deduct full cost on creation
  await adjustPoints(req.user.id, -totalCost, 'CAMPAIGN_SPEND', {
    note: createNote(type, quantity), refType: 'Campaign',
  });

  const camp = await prisma.campaign.create({
    data: {
      ownerId: req.user.id, type, status: 'ACTIVE',
      targetUrl, targetUsername: username, quantity: parseInt(quantity, 10),
      pointsCost: totalCost, perTaskReward: perReward,
      description: description || null,
    },
  });

  res.status(201).json({ success: true, campaign: camp });
});

const mine = asyncHandler(async (req, res) => {
  const list = await prisma.campaign.findMany({
    where: { ownerId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, campaigns: list });
});

const pause = asyncHandler(async (req, res) => {
  const c = await requireOwned(req.user.id, req.params.id);
  const next = c.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED';
  const updated = await prisma.campaign.update({
    where: { id: c.id },
    data: { status: next, pausedAt: next === 'PAUSED' ? new Date() : null },
  });
  getIO()?.emit('campaign:update', updated);
  res.json({ success: true, campaign: updated });
});

const cancel = asyncHandler(async (req, res) => {
  const c = await requireOwned(req.user.id, req.params.id);
  if (['COMPLETED','CANCELLED'].includes(c.status)) throw new AppError('Already finalized', 400);
  const remaining = BigInt(c.quantity) - BigInt(c.completed);
  const refund = remaining * BigInt(c.perTaskReward);
  if (refund > 0n) {
    await adjustPoints(req.user.id, refund, 'REFUND', { note: 'Campaign cancelled', refType: 'Campaign', refId: c.id });
  }
  const updated = await prisma.campaign.update({
    where: { id: c.id }, data: { status: 'CANCELLED' },
  });
  getIO()?.emit('campaign:update', updated);
  res.json({ success: true, campaign: updated });
});

async function requireOwned(userId, id) {
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c) throw new AppError('Campaign not found', 404);
  if (c.ownerId !== userId) throw new AppError('Forbidden', 403);
  return c;
}

function createNote(type, qty) { return `Created ${type} campaign ×${qty}`; }
function extractUsername(url) {
  try {
    const m = String(url).match(/@?([A-Za-z0-9._]{2,30})/);
    return m ? m[1].toLowerCase() : null;
  } catch { return null; }
}

module.exports = { create, createValidators, mine, pause, cancel, PRICE, REWARD };
