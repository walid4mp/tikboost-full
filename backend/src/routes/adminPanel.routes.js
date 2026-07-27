const bcrypt = require('bcrypt');
const r = require('express').Router();
const ctrl = require('../controllers/admin.controller');
const prisma = require('../config/db');
const { AppError } = require('../utils/errors');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { truthyIp } = require('../utils/helpers');

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'FINANCE'];

async function issueAdminTokens(user) {
  const accessToken = signAccess({ sub: user.id, role: user.role });
  const refreshToken = signRefresh({ sub: user.id, role: user.role, type: 'refresh' });
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

// JWT-based admin login (full panel session)
r.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) throw new AppError('Email and password are required', 400);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (!ADMIN_ROLES.includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Not an admin' });
    }
    if (user.status === 'BANNED') throw new AppError('Account banned', 403);
    if (user.status === 'FROZEN' && user.freezeUntil && user.freezeUntil > new Date()) {
      throw new AppError('Account frozen', 403);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastIp: truthyIp(req) },
    });

    const { accessToken, refreshToken } = await issueAdminTokens(user);
    res.json({
      success: true,
      accessToken,
      refreshToken,
      admin: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (e) {
    next(e);
  }
});

module.exports = r;
