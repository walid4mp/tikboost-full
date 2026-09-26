const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/paypal.controller');
r.post('/create', authRequired, ctrl.create);
r.post('/capture', authRequired, ctrl.capture);
r.post('/webhook', ctrl.webhook);
r.get('/return', ctrl.returnUrl);
r.get('/cancel', ctrl.cancelUrl);
module.exports = r;
