const bcrypt = require('bcrypt');
const { body } = require('express-validator');
const prisma = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { randomCode, truthyIp, asyncHandler } = require('../utils/helpers');
const { adjustPoints } = require('../services/points.service');
const { notify } = require('../services/notifications.service');

const validateSignup = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password')
    .isLength({ min: 8, max: 64 })
    .withMessage('Password must be 8-64 chars'),
  body('name')
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name required'),
  body('referralCode')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ min: 4, max: 20 }),
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password')
    .isString()
    .isLength({ min: 1, max: 128 })
    .withMessage('Password required'),
];

const validateGoogleLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('name')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 }),
  body('googleId')
    .isString()
    .trim()
    .isLength({ min: 10, max: 255 })
    .withMessage('googleId required'),
];

const validateRefresh = [
  body('refreshToken')
    .isString()
    .trim()
    .isLength({ min: 20 })
    .withMessage('Missing refresh token'),
];

const validateForgotPassword = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('newPassword')
    .isString()
    .isLength({ min: 8, max: 64 })
    .withMessage('Password must be 8-64 chars'),
];

const signup = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const { password, name, referralCode, deviceId } = req.body;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw new AppError('Email already in use', 409, 'EMAIL_USED');
  }

  const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const ref = randomCode(8);

  let referredById = null;
  if (referralCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: String(referralCode).trim().toUpperCase() },
    });
    if (referrer) referredById = referrer.id;
  }

  const user = await prisma.user.create({
    data: {
      email,
      password: hash,
      name: String(name).trim(),
      role: 'USER',
      referralCode: ref,
      referredById,
      deviceId: deviceId || null,
      lastIp: truthyIp(req),
      lastLoginAt: new Date(),
    },
  });

  await adjustPoints(user.id, 5000n, 'SIGNUP_BONUS', {
    note: 'Welcome bonus',
  });

  await notify(
    user.id,
    'مرحباً بك في TikBoost 🎉',
    'حصلت على 5000 نقطة ترحيبية. ابدأ بإنشاء حملاتك!',
    'reward',
  );

  if (referredById) {
    await adjustPoints(referredById, 2500n, 'REFERRAL_BONUS', {
      refType: 'User',
      refId: user.id,
      note: 'Referral signup',
    });

    await notify(
      referredById,
      'صديق جديد انضم 💰',
      `انضم ${name} عبر رابطك وحصلت على 2500 نقطة`,
      'reward',
    );
  }

  const tokens = await issueTokens(user);

  res.status(201).json({
    success: true,
    user: sanitize(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

const login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const { password, deviceId } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CRED');
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CRED');
  }

  assertUserCanLogin(user);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      deviceId: deviceId || user.deviceId,
      lastIp: truthyIp(req),
    },
  });

  const tokens = await issueTokens(user);

  res.json({
    success: true,
    user: sanitize(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

const googleLogin = asyncHandler(async (req, res) => {
  if (!env.ENABLE_GOOGLE_LOGIN) {
    throw new AppError(
      'Google login is disabled on this server',
      503,
      'GOOGLE_DISABLED',
    );
  }

  const email = String(req.body.email || '').trim().toLowerCase();
  const { name, googleId, deviceId } = req.body;

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const hash = await bcrypt.hash(`google-${googleId}`, env.BCRYPT_ROUNDS);

    user = await prisma.user.create({
      data: {
        email,
        password: hash,
        name: (name || email.split('@')[0]).trim(),
        role: 'USER',
        referralCode: randomCode(8),
        avatarUrl: null,
        deviceId: deviceId || null,
        lastIp: truthyIp(req),
        lastLoginAt: new Date(),
      },
    });

    await adjustPoints(user.id, 5000n, 'SIGNUP_BONUS', {
      note: 'Google signup bonus',
    });
  } else {
    assertUserCanLogin(user);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        deviceId: deviceId || user.deviceId,
        lastIp: truthyIp(req),
      },
    });
  }

  const tokens = await issueTokens(user);

  res.json({
    success: true,
    user: sanitize(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  let payload;
  try {
    payload = verifyRefresh(refreshToken);
  } catch {
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (!stored || stored.revoked) {
    throw new AppError('Refresh revoked', 401, 'REFRESH_REVOKED');
  }

  if (stored.expiresAt <= new Date()) {
    await prisma.refreshToken
      .update({
        where: { token: refreshToken },
        data: { revoked: true },
      })
      .catch(() => {});
    throw new AppError('Refresh expired', 401, 'REFRESH_EXPIRED');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw new AppError('User not found', 401, 'USER_NOT_FOUND');
  }

  assertUserCanLogin(user);

  await prisma.refreshToken.update({
    where: { token: refreshToken },
    data: { revoked: true },
  });

  const tokens = await issueTokens(user);

  res.json({
    success: true,
    user: sanitize(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  if (!env.ENABLE_LEGACY_PASSWORD_RESET) {
    throw new AppError(
      'Password reset is disabled until a verified recovery flow is implemented',
      501,
      'PASSWORD_RESET_DISABLED',
    );
  }

  const email = String(req.body.email || '').trim().toLowerCase();
  const { newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const hash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hash },
  });

  await prisma.refreshToken.updateMany({
    where: { userId: user.id },
    data: { revoked: true },
  });

  await notify(
    user.id,
    'تم تغيير كلمة المرور',
    'تم تحديث كلمة المرور بنجاح. إذا لم تكن أنت، تواصل مع الدعم.',
    'warning',
  );

  res.json({ success: true, message: 'Password updated' });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};

  if (refreshToken) {
    await prisma.refreshToken
      .updateMany({
        where: { token: refreshToken },
        data: { revoked: true },
      })
      .catch(() => {});
  }

  res.json({ success: true });
});

const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      _count: {
        select: {
          campaigns: true,
          tasks: true,
          referrals: true,
        },
      },
    },
  });

  res.json({
    success: true,
    user: sanitize(user),
  });
});

function assertUserCanLogin(user) {
  if (user.status === 'BANNED') {
    throw new AppError('Account banned', 403, 'BANNED');
  }

  if (
    user.status === 'FROZEN' &&
    user.freezeUntil &&
    user.freezeUntil > new Date()
  ) {
    throw new AppError(
      `Account frozen until ${user.freezeUntil.toISOString()}`,
      403,
      'FROZEN',
    );
  }
}

async function issueTokens(user) {
  const accessToken = signAccess({ sub: user.id, role: user.role });
  const refreshToken = signRefresh({
    sub: user.id,
    role: user.role,
    type: 'refresh',
  });

  const payload = verifyRefresh(refreshToken);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(payload.exp * 1000),
    },
  });

  return { accessToken, refreshToken };
}

function sanitize(user) {
  if (!user) return null;

  const plain =
    typeof user.toJSON === 'function' ? user.toJSON() : { ...user };

  delete plain.password;

  return toSerializable(plain);
}

function toSerializable(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, current) =>
      typeof current === 'bigint' ? current.toString() : current,
    ),
  );
}

module.exports = {
  signup,
  login,
  googleLogin,
  refresh,
  forgotPassword,
  logout,
  me,
  validateSignup,
  validateLogin,
  validateGoogleLogin,
  validateRefresh,
  validateForgotPassword,
};
