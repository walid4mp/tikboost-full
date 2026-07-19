const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/referral.controller');

r.get('/', authRequired, ctrl.summary);

module.exports = r;
