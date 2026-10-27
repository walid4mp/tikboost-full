const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/package.controller');
const paypal = require('../controllers/paypal.controller');
const googlePlay = require('../controllers/google-play.controller');

r.post('/paypal/create-order', authRequired, paypal.createOrder);
r.post('/paypal/capture', authRequired, paypal.captureOrder);
r.post('/google-play/verify', authRequired, googlePlay.verifyProduct);
r.get ('/',         ctrl.list);
r.post('/buy',      authRequired, ctrl.purchase);
r.get ('/mine',     authRequired, ctrl.mine);

module.exports = r;
