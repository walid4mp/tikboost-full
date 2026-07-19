const prisma = require('../config/db');
const { asyncHandler } = require('../utils/helpers');

const summary = asyncHandler(async (req, res) => {
  const referrals = await prisma.user.findMany({
    where: { referredById: req.user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  const bonus = await prisma.pointLog.aggregate({
    where: { userId: req.user.id, reason: 'REFERRAL_BONUS' },
    _sum: { delta: true },
  });
  res.json({
    success: true,
    code: req.user.referralCode,
    link:  `${process.env.APP_URL || ''}/?ref=${req.user.referralCode}`,
    friends: referrals.length,
    earned: (bonus._sum.delta || 0n).toString(),
    referrals,
  });
});

module.exports = { summary };
