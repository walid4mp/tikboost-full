const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const maintenanceGuard = require('../middleware/maintenanceGuard');
const ctrl = require('../controllers/package.controller');
const paypal = require('../controllers/paypal.controller');
const googlePlay = require('../controllers/google-play.controller');

r.post('/paypal/create-order', authRequired, maintenanceGuard, paypal.createOrder);
r.post('/paypal/capture', authRequired, maintenanceGuard, paypal.captureOrder);
r.post('/google-play/verify', authRequired, maintenanceGuard, googlePlay.verifyProduct);
r.get ('/',         ctrl.list);
r.post('/buy',      authRequired, maintenanceGuard, ctrl.purchase);
r.get ('/mine',     authRequired, maintenanceGuard, ctrl.mine);

module.exports = r;
