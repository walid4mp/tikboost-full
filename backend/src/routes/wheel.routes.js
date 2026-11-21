const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const maintenanceGuard = require('../middleware/maintenanceGuard');
const ctrl = require('../controllers/wheel.controller');

r.get ('/prizes', authRequired, maintenanceGuard, ctrl.prizes);
r.post('/spin',   authRequired, maintenanceGuard, ctrl.spin);

module.exports = r;
