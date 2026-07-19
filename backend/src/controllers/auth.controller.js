const bcrypt = require('bcrypt');
const { body } = require('express-validator');
const prisma = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { randomCode, randomToken, truthyIp, asyncHandler } = require('../utils/helpers');
const { adjustPoints } = require('../services/points.service');
const { notify } = require('../services/notifications.service');

const validateSignup = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6, max: 64 }).withMessage('Password must be 6-64 chars'),
  body('name').isString().trim().isLength({ min: 2, max: 50 }).withMessage('Name required'),
];

const signup = asyncHandler(async (req, res) => {
  const { email, password, name, referralCode, deviceId } = req.body;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new AppError('Email already in use', 409, 'EMAIL_USED');
  const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const ref = randomCode(8);

  let referredById = null;
  if (referralCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode } });
    if (referrer) referredById = referrer.id;
  }

  const user = await prisma.user.create({
    data: {
      email, password: hash, name, role: 'USER', referralCode: ref,
      referredById, deviceId: deviceId || null,
      lastIp: truthyIp(req), lastLoginAt: new Date(),
    },
  });

  // Signup bonus = 5000 points
  await adjustPoints(user.id, 5000n, 'SIGNUP_BONUS', { note: 'Welcome bonus' });
  await notify(user.id, 'مرحباً بك في TikBoost 🎉', 'حصلت على 5000 نقطة ترحيبية. ابدأ بإنشاء حملاتك!', 'reward');

  if (referredById) {
    await adjustPoints(referredById, 2500n, 'REFERRAL_BONUS', { refType: 'User', refId: user.id, note: 'Referral signup' });
    await notify(referredById, 'صديق جديد انضم 💰', `انضم ${name} عبر رابطك وحصلت على 2500 نقطة`, 'reward');
  }

  const { accessToken, refreshToken } = await issueTokens(user);
  res.status(201).json({ success: true, user: sanitize(user), accessToken, refreshToken });
});

const login = asyncHandler(async (req, res) => {
  const { email, password, deviceId } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('Invalid credentials', 401, 'INVALID_CRED');
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new AppError('Invalid credentials', 401, 'INVALID_CRED');
  if (user.status === 'BANNED') throw new AppError('Account banned', 403, 'BANNED');
  if (user.status === 'FROZEN' && user.freezeUntil && user.freezeUntil > new Date())
    throw new AppError('Account frozen until ' + user.freezeUntil.toISOString(), 403, 'FROZEN');

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), deviceId: deviceId || user.deviceId, lastIp: truthyIp(req) },
  });

  const tokens = await issueTokens(user);
  res.json({ success: true, user: sanitize(user), ...tokens });
});

const googleLogin = asyncHandler(async (req, res) => {
  const { email, name, googleId, deviceId } = req.body;
  if (!email) throw new AppError('Email required', 400);
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const hash = await bcrypt.hash('google-' + googleId, env.BCRYPT_ROUNDS);
    user = await prisma.user.create({
      data: {
        email, password: hash, name: name || email.split('@')[0],
        role: 'USER', referralCode: randomCode(8),
        avatarUrl: null, deviceId: deviceId || null,
        lastIp: truthyIp(req), lastLoginAt: new Date(),
      },
    });
    await adjustPoints(user.id, 5000n, 'SIGNUP_BONUS', { note: 'Google signup bonus' });
  } else if (user.status === 'BANNED') {
    throw new AppError('Account banned', 403, 'BANNED');
  }
  const tokens = await issueTokens(user);
  res.json({ success: true, user: sanitize(user), ...tokens });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('Missing refresh token', 400);
  let payload;
  try { payload = verifyRefresh(refreshToken); } catch { throw new AppError('Invalid refresh token', 401); }
  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.revoked) throw new AppError('Refresh revoked', 401);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new AppError('User not found', 401);
  await prisma.refreshToken.update({ where: { token: refreshToken }, data: { revoked: true } });
  const tokens = await issueTokens(user);
  res.json({ success: true, user: sanitize(user), ...tokens });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('User not found', 404);
  const hash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
  await prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { revoked: true } });
  await notify(user.id, 'تم تغيير كلمة المرور', 'تم تحديث كلمة المرور بنجاح. إذا لم تكن أنت، تواصل مع الدعم.', 'warning');
  res.json({ success: true, message: 'Password updated' });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.updateMany({ where: { token: refreshToken }, data: { revoked: true } }).catch(() => {});
  }
  res.json({ success: true });
});

const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { _count: { select: { campaigns: true, tasks: true, referrals: true } } },
  });
  res.json({ success: true, user: sanitize(user) });
});

async function issueTokens(user) {
  const accessToken = signAccess({ sub: user.id, role: user.role });
  const refreshToken = randomToken(40);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } });
  return { accessToken, refreshToken };
}

function sanitize(u) {
  if (!u) return null;
  const o = { ...u };
  delete o.password;
  return o;
}

module.exports = { signup, login, googleLogin, refresh, forgotPassword, logout, me, validateSignup };
