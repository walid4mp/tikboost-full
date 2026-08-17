const bcrypt = require('bcrypt');
const { body } = require('express-validator');
const prisma = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const {
  randomCode,
  randomToken,
  truthyIp,
  asyncHandler,
} = require('../utils/helpers');
const { adjustPoints } = require('../services/points.service');

const { notify } = require('../services/notifications.service');
const { getSettings } = require('../services/appSettings.service');
const {
  setAuthCookies,
  clearAuthCookies,
  readRefreshToken,
} = require('../utils/authCookies');

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
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ min: 20 })
    .withMessage('Invalid refresh token'),
  body().custom((_value, { req }) => {
    if (readRefreshToken(req)) return true;
    throw new Error('Missing refresh token');
  }),
];

const validateForgotPassword = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
];

const validateResetPassword = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('code')
    .isString()
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Invalid reset code'),
  body('newPassword')
    .isString()
    .isLength({ min: 8, max: 64 })
    .withMessage('Password must be 8-64 chars'),
  body('confirmPassword')
    .isString()
    .custom((value, { req }) => String(value) === String(req.body.newPassword))
    .withMessage('Passwords do not match'),
];

const signup = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const { password, name, referralCode, deviceId } = req.body;

  const settings = await getSettings();
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const normalizedReferralCode = referralCode
    ? String(referralCode).trim().toUpperCase()
    : null;

  const result = await prisma.$transaction(async (tx) => {
    const exists = await tx.user.findUnique({ where: { email } });
    if (exists) {
      throw new AppError('Email already in use', 409, 'EMAIL_USED');
    }

    let referredById = null;
    if (normalizedReferralCode) {
      const referrer = await tx.user.findUnique({
        where: { referralCode: normalizedReferralCode },
      });
      if (!referrer) {
        throw new AppError('Referral code is invalid', 400, 'INVALID_REFERRAL_CODE');
      }
      referredById = referrer.id;
    }

    const createdUser = await tx.user.create({
      data: {
        email,
        password: passwordHash,
        name: String(name).trim(),
        role: 'USER',
        referralCode: randomCode(8),
        referredById,
        deviceId: deviceId || null,
        lastIp: truthyIp(req),
        lastLoginAt: new Date(),
      },
    });

    const signupBonus = BigInt(settings.rewards.signupBonusPoints || 5000);
    await adjustPoints(createdUser.id, signupBonus, 'SIGNUP_BONUS', {
      note: 'Welcome bonus',
    }, tx);

    await notify(
      createdUser.id,
      'مرحباً بك في TikBoost 🎉',
      `حصلت على ${signupBonus.toString()} نقطة ترحيبية. ابدأ بإنشاء حملاتك!`,
      'reward',
      null,
      tx,
    );

    if (referredById) {
      const referralBonusExists = await tx.pointLog.findFirst({
        where: {
          userId: referredById,
          reason: 'REFERRAL_BONUS',
          refType: 'User',
          refId: createdUser.id,
        },
      });

      if (!referralBonusExists) {
        await adjustPoints(referredById, BigInt(settings.rewards.referralBonusPoints || 0), 'REFERRAL_BONUS', {
          refType: 'User',
          refId: createdUser.id,
          note: 'Referral signup',
        }, tx);
      }

      await notify(
        referredById,
        'صديق جديد انضم 💰',
        `انضم ${name} عبر رابطك وحصلت على ${settings.rewards.referralBonusPoints || 0} نقطة`,
        'reward',
        null,
        tx,
      );

      const newUserReferralBonus = BigInt(settings.rewards.referralNewUserBonusPoints || 0);
      if (newUserReferralBonus > 0n) {
        await adjustPoints(createdUser.id, newUserReferralBonus, 'REFERRAL_BONUS', {
          refType: 'Referrer',
          refId: referredById,
          note: 'Referral welcome bonus',
        }, tx);
      }
    }

    const user = await tx.user.findUnique({ where: { id: createdUser.id } });
    const tokens = await issueTokens(user, tx);

    return { user, tokens };
  });

  setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);

  res.status(201).json({
    success: true,
    user: sanitize(result.user),
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
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

  const freshUser = await prisma.user.findUnique({ where: { id: user.id } });
  const tokens = await issueTokens(freshUser);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

  res.json({
    success: true,
    user: sanitize(freshUser),
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

  const settings = await getSettings();
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const hash = await bcrypt.hash(`google-${googleId}`, env.BCRYPT_ROUNDS);

    const createdUser = await prisma.user.create({
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

    await adjustPoints(createdUser.id, BigInt(settings.rewards.signupBonusPoints || 5000), 'SIGNUP_BONUS', {
      note: 'Google signup bonus',
    });

    user = await prisma.user.findUnique({ where: { id: createdUser.id } });
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

    user = await prisma.user.findUnique({ where: { id: user.id } });
  }

  const tokens = await issueTokens(user);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

  res.json({
    success: true,
    user: sanitize(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = readRefreshToken(req);

  let payload;
  try {
    payload = verifyRefresh(refreshToken);
  } catch {
    clearAuthCookies(res);
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (!stored || stored.revoked) {
    clearAuthCookies(res);
    throw new AppError('Refresh revoked', 401, 'REFRESH_REVOKED');
  }

  if (stored.expiresAt <= new Date()) {
    await prisma.refreshToken
      .update({
        where: { token: refreshToken },
        data: { revoked: true },
      })
      .catch(() => {});
    clearAuthCookies(res);
    throw new AppError('Refresh expired', 401, 'REFRESH_EXPIRED');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    clearAuthCookies(res);
    throw new AppError('User not found', 401, 'USER_NOT_FOUND');
  }

  assertUserCanLogin(user);

  await prisma.refreshToken.update({
    where: { token: refreshToken },
    data: { revoked: true },
  });

  const freshUser = await prisma.user.findUnique({ where: { id: user.id } });
  const tokens = await issueTokens(freshUser);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

  res.json({
    success: true,
    user: sanitize(freshUser),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
});

const crypto = require('crypto');

function resetOtpKey() {
  const configured = env.RESET_OTP_ENCRYPTION_KEY || env.JWT_ACCESS_SECRET;
  return crypto.createHash('sha256').update(String(configured)).digest();
}

function encryptResetOtp(otp) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', resetOtpKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(otp, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function hashResetOtp(userId, otp) {
  return crypto.createHmac('sha256', resetOtpKey()).update(`${userId}:${otp}`).digest('hex');
}

function decryptResetOtp(payload) {
  const [ivRaw, tagRaw, dataRaw] = String(payload || '').split('.');
  if (!ivRaw || !tagRaw || !dataRaw) throw new Error('Invalid encrypted OTP');
  const decipher = crypto.createDecipheriv('aes-256-gcm', resetOtpKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
}

const genericResetMessage = 'إذا كان البريد مسجلًا لدينا، تم إنشاء طلب استعادة. تواصل مع الدعم لإرسال الرمز يدويًا.';

const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const ip = truthyIp(req) || req.ip || '';
  const now = new Date();

  // Generic response prevents email enumeration.
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json({ success: true, message: genericResetMessage });

  // One request per 60 seconds for the same email OR IP.
  const recent = await prisma.passwordResetToken.findFirst({
    where: {
      createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      OR: [{ userId: user.id }, ...(ip ? [{ requestIp: ip }] : [])],
    },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) return res.json({ success: true, message: genericResetMessage });

  // A new request invalidates every previous pending request for this user.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, status: 'PENDING' },
    data: { status: 'EXPIRED', usedAt: now },
  });

  const rawCode = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const tokenHash = hashResetOtp(user.id, rawCode);
  const ttlMin = 10;

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      encryptedCode: encryptResetOtp(rawCode),
      expiresAt: new Date(Date.now() + ttlMin * 60 * 1000),
      attempts: 0,
      status: 'PENDING',
      requestIp: ip || null,
    },
  });

  // لا يتم إرسال رمز الاستعادة عبر البريد.
  // يظهر الطلب لدى الإدارة، ويقوم Admin بكشف الرمز وإرساله للمستخدم يدويًا.


  res.json({ success: true, message: genericResetMessage });
});

const resetPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const rawCode = String(req.body.code || req.body.token || '').trim();
  const { newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('رمز إعادة التعيين غير صالح أو منتهي الصلاحية', 400, 'RESET_TOKEN_INVALID');

  const record = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    throw new AppError('رمز إعادة التعيين غير صالح أو منتهي الصلاحية', 400, 'RESET_TOKEN_INVALID');
  }

  if (record.attempts >= 5) {
    await prisma.passwordResetToken.update({ where: { id: record.id }, data: { status: 'LOCKED' } }).catch(() => {});
    throw new AppError('تم قفل طلب الاستعادة بعد 5 محاولات.', 429, 'RESET_LOCKED');
  }

  const tokenHash = hashResetOtp(user.id, rawCode);
  if (tokenHash !== record.tokenHash) {
    const attempts = record.attempts + 1;
    await prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { attempts, status: attempts >= 5 ? 'LOCKED' : 'PENDING' },
    });
    throw new AppError(
      attempts >= 5 ? 'تم قفل طلب الاستعادة بعد 5 محاولات.' : 'رمز إعادة التعيين غير صحيح.',
      400,
      attempts >= 5 ? 'RESET_LOCKED' : 'RESET_CODE_INVALID',
    );
  }

  const hash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { password: hash } }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date(), status: 'USED' },
    }),
    prisma.refreshToken.updateMany({ where: { userId: record.userId }, data: { revoked: true } }),
  ]);

  res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن.' });
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = readRefreshToken(req);

  if (refreshToken) {
    await prisma.refreshToken
      .updateMany({
        where: { token: refreshToken },
        data: { revoked: true },
      })
      .catch(() => {});
  }

  clearAuthCookies(res);
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

async function issueTokens(user, client = prisma) {
  const accessToken = signAccess({ sub: user.id, role: user.role });
  const refreshToken = signRefresh({
    sub: user.id,
    role: user.role,
    type: 'refresh',
    jti: randomToken(16),
  });

  const payload = verifyRefresh(refreshToken);

  await client.refreshToken.create({
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

  const plain = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
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
  validateSignup,
  validateLogin,
  validateGoogleLogin,
  validateRefresh,
  validateForgotPassword,
  validateResetPassword,
  signup,
  login,
  googleLogin,
  refresh,
  forgotPassword,
  resetPassword,
  logout,
  me,
};
