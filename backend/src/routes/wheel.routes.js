const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/wheel.controller');

r.get ('/prizes', authRequired, ctrl.prizes);
r.post('/spin',   authRequired, ctrl.spin);

module.exports = r;
