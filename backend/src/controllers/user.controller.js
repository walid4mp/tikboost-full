const { body } = require('express-validator');

const prisma = require('../config/db');
const { asyncHandler } = require('../utils/helpers');
const {
  USER_GENDERS,
  normalizeGender,
  normalizeCountryCode,
  isValidCountryCode,
  buildProfileStatus,
} = require('../utils/audience');

const updateProfileValidators = [
  body('name')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be 2-50 chars'),
  body('avatarUrl')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('avatarUrl is too long'),
];

const completeProfileValidators = [
  body('gender')
    .custom((value) => USER_GENDERS.includes(String(value || '').trim().toUpperCase()))
    .withMessage('Invalid gender'),
  body('countryCode')
    .custom((value) => isValidCountryCode(value))
    .withMessage('Invalid country code'),
];

const getProfile = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({
    success: true,
    user: sanitizeUser(user),
    profileStatus: buildProfileStatus(user),
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, avatarUrl } = req.body;
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      name: name ? String(name).trim() : undefined,
      avatarUrl: avatarUrl ? String(avatarUrl).trim() : undefined,
    },
  });

  res.json({
    success: true,
    user: sanitizeUser(user),
    profileStatus: buildProfileStatus(user),
  });
});

const completeProfile = asyncHandler(async (req, res) => {
  const gender = normalizeGender(req.body.gender);
  const countryCode = normalizeCountryCode(req.body.countryCode);

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { gender, countryCode },
  });

  res.json({
    success: true,
    message: 'Profile completed successfully',
    user: sanitizeUser(user),
    profileStatus: buildProfileStatus(user),
  });
});

const pointHistory = asyncHandler(async (req, res) => {
  const list = await prisma.pointLog.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ success: true, logs: list });
});


const getAdConfig = asyncHandler(async (req, res) => {
  const { getSettings } = require('../services/appSettings.service');
  const settings = await getSettings();
  const excluded = new Set((settings.ads?.excludedUserIds || []).map(String));
  const ads = settings.ads || {};
  const suppressed = excluded.has(String(req.user.id));
  res.json({
    success: true,
    ads: {
      ...ads,
      excludedUserIds: undefined,
    },
    adsSuppressed: suppressed,
  });
});

const activityStats = asyncHandler(async (req, res) => {
  const [completed, tasksCount, campaignsCount, refsCount] = await Promise.all([
    prisma.task.count({ where: { executorId: req.user.id, status: 'VERIFIED' } }),
    prisma.task.count({ where: { executorId: req.user.id } }),
    prisma.campaign.count({ where: { ownerId: req.user.id } }),
    prisma.user.count({ where: { referredById: req.user.id } }),
  ]);
  res.json({
    success: true,
    stats: { completed, tasksCount, campaignsCount, referralCount: refsCount },
  });
});

function sanitizeUser(user) {
  if (!user) return null;
  const plain = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  delete plain.password;
  return JSON.parse(
    JSON.stringify(plain, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );
}

module.exports = {
  updateProfileValidators,
  completeProfileValidators,
  getProfile,
  updateProfile,
  completeProfile,
  pointHistory,
  activityStats,
  getAdConfig,
};
