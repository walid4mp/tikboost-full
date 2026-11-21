const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const maintenanceGuard = require('../middleware/maintenanceGuard');
const ctrl = require('../controllers/notification.controller');

r.get   ('/',              authRequired, maintenanceGuard, ctrl.mine);
r.post  ('/read-all',      authRequired, maintenanceGuard, ctrl.markAllRead);
r.post  ('/:id/read',      authRequired, maintenanceGuard, ctrl.markRead);
r.post  ('/device-token',  authRequired, maintenanceGuard, ctrl.registerDeviceToken);
r.delete('/device-token',  authRequired, maintenanceGuard, ctrl.unregisterDeviceToken);

module.exports = r;
