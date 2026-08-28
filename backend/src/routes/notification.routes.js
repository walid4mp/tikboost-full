const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/notification.controller');

r.get   ('/',        authRequired, ctrl.mine);
r.post  ('/:id/read', authRequired, ctrl.markRead);
r.post  ('/device-token', authRequired, ctrl.registerDeviceToken);
r.delete('/device-token', authRequired, ctrl.unregisterDeviceToken);

module.exports = r;
