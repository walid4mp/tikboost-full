const r = require('express').Router();
const ctrl = require('../controllers/public.controller');
const offerCtrl = require('../controllers/offer.controller');

r.get('/config/client', ctrl.clientConfig);
r.get('/offers', offerCtrl.listPublic);

module.exports = r;
