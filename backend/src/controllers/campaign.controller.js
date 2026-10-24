const { body } = require('express-validator');
const prisma = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { adjustPoints } = require('../services/points.service');
const { getIO } = require('../sockets/io');
const { asyncHandler, parseTikTokTarget } = require('../utils/helpers');
const { getSettings } = require('../services/appSettings.service');
const {
  TARGET_GENDERS,
  normalizeTargetGender,
  normalizeTargetCountry,
  buildProfileStatus,
} = require('../utils/audience');

const PRICE = {
  FOLLOWERS: 100n,
  LIKES: 20n,
  VIEWS: 5n,
  COMMENTS: 50n,
};

const createValidators = [
  body('type')
    .isIn(['FOLLOWERS', 'LIKES', 'VIEWS', 'COMMENTS'])
    .withMessage('Invalid type'),
  body('targetUrl')
    .isString()
    .trim()
    .isLength({ min: 10 })
    .withMessage('Valid target URL required'),
  body('quantity')
    .isInt({ min: 1, max: 1000000 })
    .withMessage('Quantity 1-1,000,000'),
  body('description')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 300 }),
  body('commentText')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Comment text must be 500 chars or less'),
  body('targetGender')
    .optional({ values: 'falsy' })
    .custom((value) => TARGET_GENDERS.includes(String(value || '').trim().toUpperCase()))
    .withMessage('Invalid target gender'),
  body('targetCountry')
    .optional({ values: 'falsy' })
    .custom((value) => !!normalizeTargetCountry(value))
    .withMessage('Invalid target country'),
];

const create = asyncHandler(async (req, res) => {
  const { type, quantity, description } = req.body;
  const targetUrl = String(req.body.targetUrl || '').trim();
  const commentText = String(req.body.commentText || '').trim();
  const targetGender = normalizeTargetGender(req.body.targetGender) || 'ALL';
  const targetCountry = normalizeTargetCountry(req.body.targetCountry);

  const parsedTarget = await parseTikTokTarget(targetUrl);
  if (!parsedTarget.valid) {
    throw new AppError(tiktokErrorMessage(parsedTarget.reason), 400, 'INVALID_TIKTOK_URL');
  }

  if (type === 'COMMENTS' && !commentText) {
    throw new AppError('Comment text is required for comment campaigns', 400);
  }

  const settings = await getSettings();
  const pricing = settings.campaignPricing || {};
  const rewardMap = settings.campaignRewards || {};
  const rules = settings.campaignRules || {};
  const minQuantity = Number(rules.minQuantity || 10);
  const maxQuantity = Number(rules.maxQuantity || 1000000);

  const normalizedQuantity = parseInt(quantity, 10);
  if (normalizedQuantity < minQuantity || normalizedQuantity > maxQuantity) {
    throw new AppError(`Quantity must be between ${minQuantity} and ${maxQuantity}`, 400, 'INVALID_QUANTITY');
  }

  const perCost = BigInt(pricing[type] ?? Number(PRICE[type] || 0n));
  const perReward = calculatePerTaskReward(type, perCost, rewardMap);

  if (perCost <= 0n || perReward <= 0n) {
    throw new AppError('Invalid campaign pricing configuration', 500, 'INVALID_PRICING');
  }

  const active = await prisma.campaign.count({
    where: {
      ownerId: req.user.id,
      status: { in: ['ACTIVE', 'PENDING', 'PAUSED'] },
    },
  });

  if (active >= env.MAX_CAMPAIGNS_PER_USER) {
    throw new AppError(`Max ${env.MAX_CAMPAIGNS_PER_USER} open campaigns`, 400, 'LIMIT_CAMPAIGNS');
  }

  const totalCost = BigInt(normalizedQuantity) * perCost;
  const vipUntil = req.user.vipProUntil ? new Date(req.user.vipProUntil) : null;
  const isVip = vipUntil && vipUntil > new Date() && settings.vipPro?.enabled !== false;
  const vipBonusPoints = isVip ? BigInt(Math.max(0, Number(settings.vipPro?.bonusPerTask || 0))) : 0n;
  const balance = BigInt(req.user.points);
  if (balance < totalCost) {
    throw new AppError('Insufficient points', 400, 'INSUFFICIENT_POINTS');
  }

  await adjustPoints(req.user.id, -totalCost, 'CAMPAIGN_SPEND', {
    note: createNote(type, normalizedQuantity),
    refType: 'Campaign',
  });

  const createData = {
    ownerId: req.user.id,
    type,
    status: 'ACTIVE',
    targetUrl: parsedTarget.targetUrl,
    targetUsername: parsedTarget.targetUsername,
    quantity: normalizedQuantity,
    pointsCost: totalCost,
    perTaskReward: perReward,
    description: description ? String(description).trim() : null,
    targetGender,
    targetCountry,
    vipPriority: Boolean(isVip),
    vipBonusPoints,
    ...(type === 'COMMENTS' ? { commentText } : {}),
  };

  const campaign = await prisma.campaign.create({ data: createData });

  if (isVip) {
    const { broadcast } = require('../services/notifications.service');
    await broadcast(
      'حملة VIP PRO جديدة 👑',
      `قام ${req.user.name} بإنشاء حملة ${type}. تابعها واحصل على ${vipBonusPoints.toString()} نقطة إضافية مع المكافأة الأساسية.`,
      'reward',
      { type: 'vip_campaign', campaignId: campaign.id, campaignType: type },
    );
  }

  res.status(201).json({
    success: true,
    campaign: serializeCampaign(campaign, {
      unitCost: perCost.toString(),
      videoId: parsedTarget.videoId,
      canonicalUrl: parsedTarget.canonicalUrl,
    }),
    profileStatus: buildProfileStatus(req.user),
  });
});

const mine = asyncHandler(async (req, res) => {
  const list = await prisma.campaign.findMany({
    where: { ownerId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, campaigns: list.map((campaign) => serializeCampaign(campaign)) });
});

const pause = asyncHandler(async (req, res) => {
  const campaign = await requireOwned(req.user.id, req.params.id);
  const next = campaign.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED';
  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: next, pausedAt: next === 'PAUSED' ? new Date() : null },
  });
  getIO()?.emit('campaign:update', updated);
  res.json({ success: true, campaign: serializeCampaign(updated) });
});

const cancel = asyncHandler(async (req, res) => {
  const campaign = await requireOwned(req.user.id, req.params.id);
  if (['COMPLETED', 'CANCELLED'].includes(campaign.status)) {
    throw new AppError('Already finalized', 400);
  }

  const remaining = BigInt(campaign.quantity) - BigInt(campaign.completed);
  const unitCost = BigInt(campaign.pointsCost) / BigInt(campaign.quantity);
  const refund = remaining * unitCost;

  if (refund > 0n) {
    await adjustPoints(req.user.id, refund, 'REFUND', {
      note: 'Campaign cancelled',
      refType: 'Campaign',
      refId: campaign.id,
    });
  }

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: 'CANCELLED' },
  });

  getIO()?.emit('campaign:update', updated);
  res.json({ success: true, campaign: serializeCampaign(updated), refund: refund.toString() });
});

async function requireOwned(userId, id) {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) throw new AppError('Campaign not found', 404);
  if (campaign.ownerId !== userId) throw new AppError('Forbidden', 403);
  return campaign;
}

function calculatePerTaskReward(type, perCost, rewardMap = {}) {
  const explicit = rewardMap?.[type];
  if (explicit !== undefined && explicit !== null && `${explicit}`.trim() !== '') {
    const reward = BigInt(explicit);
    return reward > 0n ? reward : 1n;
  }
  const reward = (BigInt(perCost) * 80n) / 100n;
  return reward > 0n ? reward : 1n;
}

function createNote(type, quantity) {
  return `Created ${type} campaign ×${quantity}`;
}

function serializeCampaign(campaign, extra = {}) {
  return {
    ...campaign,
    pointsCost: campaign.pointsCost.toString(),
    perTaskReward: campaign.perTaskReward.toString(),
    vipBonusPoints: campaign.vipBonusPoints.toString(),
    ...extra,
  };
}

function tiktokErrorMessage(reason) {
  switch (reason) {
    case 'empty':
      return 'TikTok URL is required';
    case 'parse':
      return 'Please enter a valid TikTok URL';
    case 'protocol':
      return 'TikTok URL must start with http or https';
    case 'host':
      return 'Supported TikTok links only (tiktok.com, m.tiktok.com, vm.tiktok.com, vt.tiktok.com)';
    case 'redirect':
      return 'Could not resolve the TikTok short link. Please open it once and copy the final link.';
    case 'path':
      return 'Unsupported TikTok link format. Use a profile link or a direct video link.';
    default:
      return 'Invalid TikTok URL';
  }
}

module.exports = { create, createValidators, mine, pause, cancel, PRICE, calculatePerTaskReward };
