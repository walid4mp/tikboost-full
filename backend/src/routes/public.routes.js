const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/public.controller');
const offerCtrl = require('../controllers/offer.controller');

r.get('/config/client', ctrl.clientConfig);
r.get('/offers', offerCtrl.listPublic);
r.get('/offers/personalized', authRequired, offerCtrl.listPersonalized);
r.post('/offers/:id/buy', authRequired, offerCtrl.purchase);

module.exports = r;
