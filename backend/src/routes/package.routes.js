const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/package.controller');

r.get ('/',         ctrl.list);
r.post('/buy',      authRequired, ctrl.purchase);
r.get ('/mine',     authRequired, ctrl.mine);

module.exports = r;
