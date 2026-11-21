const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const maintenanceGuard = require('../middleware/maintenanceGuard');
const ctrl = require('../controllers/referral.controller');

r.get('/', authRequired, maintenanceGuard, ctrl.summary);

module.exports = r;
