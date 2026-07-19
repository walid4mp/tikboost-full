const r = require('express').Router();
const ctrl = require('../controllers/admin.controller');

// JWT-based admin login (full panel session)
r.post('/login', async (req, res) => {
  try {
    const bcrypt = require('bcrypt');
    const prisma = require('../config/db');
    const { signAccess, signRefresh } = require('../utils/jwt');
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (!['ADMIN','SUPER_ADMIN','MODERATOR','FINANCE'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Not an admin' });
    }
    const access = signAccess({ sub: user.id, role: user.role });
    const refresh = signRefresh({ sub: user.id });
    res.json({
      success: true,
      accessToken: access,
      refreshToken: refresh,
      admin: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = r;
