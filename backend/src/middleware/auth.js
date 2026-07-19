const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/errors');

async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError('Missing token', 401);
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new AppError('User not found', 401);
    if (user.status === 'BANNED') throw new AppError('Account banned', 403);
    if (user.status === 'FROZEN' && user.freezeUntil && user.freezeUntil > new Date()) {
      throw new AppError('Account frozen until ' + user.freezeUntil.toISOString(), 403);
    }
    req.user = user;
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') return next(new AppError('Token expired', 401));
    if (e.name === 'JsonWebTokenError') return next(new AppError('Invalid token', 401));
    next(e);
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    if (!roles.includes(req.user.role)) return next(new AppError('Forbidden', 403));
    next();
  };
}

module.exports = { authRequired, requireRole };
