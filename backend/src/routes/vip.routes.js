const r = require('express').Router();
const { authRequired, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/vip.controller');
r.get('/status', authRequired, ctrl.status);
r.post('/subscribe', authRequired, ctrl.subscribe);
r.get('/admin', authRequired, requireRole('ADMIN','SUPER_ADMIN','MODERATOR'), ctrl.listAdmin);
r.post('/admin/:id/action', authRequired, requireRole('ADMIN','SUPER_ADMIN'), ctrl.actionAdmin);
module.exports = r;
