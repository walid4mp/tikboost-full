const r = require('express').Router();
const validate = require('../middleware/validate');
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/campaign.controller');

r.use(authRequired);
r.post('/',      ctrl.createValidators, validate, ctrl.create);
r.get ('/mine',  ctrl.mine);
r.post('/:id/pause',  ctrl.pause);
r.post('/:id/cancel', ctrl.cancel);

module.exports = r;
