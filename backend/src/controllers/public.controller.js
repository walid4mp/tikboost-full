const prisma = require('../config/db');
const { asyncHandler } = require('../utils/helpers');
const { getSettings } = require('../services/appSettings.service');

const clientConfig = asyncHandler(async (_req, res) => {
  const [settings, packages] = await Promise.all([
    getSettings(),
    prisma.pointPackage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  const publicAds = { ...settings.ads };
  delete publicAds.excludedUserIds;

  res.json({
    success: true,
    config: {
      app: settings.app,
      ads: publicAds,
      rewards: settings.rewards,
      wheel: settings.wheel,
      chest: settings.chest,
      dailyTasks: settings.dailyTasks,
      achievements: settings.achievements,
      levels: settings.levels,
      notifications: settings.notifications,
      campaignPricing: settings.campaignPricing,
      campaignRewards: settings.campaignRewards,
      campaignRules: settings.campaignRules,
      payments: settings.payments,
      features: settings.features,
      packages: packages.map((item) => ({
        ...item,
        points: item.points.toString(),
        bonusPoints: item.bonusPoints.toString(),
      })),
    },
  });
});

module.exports = { clientConfig };
