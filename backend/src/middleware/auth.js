const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { readAccessToken } = require('../utils/authCookies');

const authRequired = async (req, _res, next) => {
  try {
    const token = readAccessToken(req);
    if (!token) throw new AppError('Missing token', 401, 'MISSING_TOKEN');

    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new AppError('User not found', 401, 'USER_NOT_FOUND');
    if (user.status === 'BANNED') throw new AppError('Account banned', 403, 'BANNED');
    if (user.freezeUntil && user.freezeUntil > new Date()) {
      throw new AppError(`Account frozen until ${user.freezeUntil.toISOString()}`, 403, 'FROZEN');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    if (error?.name === 'TokenExpiredError') return next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
    return next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
  }
};

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
  if (!roles.includes(req.user.role)) return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
  return next();
};

module.exports = { authRequired, requireRole };
