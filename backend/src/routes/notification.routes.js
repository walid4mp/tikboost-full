const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/notification.controller');

r.get   ('/',        authRequired, ctrl.mine);
r.post  ('/:id/read', authRequired, ctrl.markRead);

module.exports = r;
