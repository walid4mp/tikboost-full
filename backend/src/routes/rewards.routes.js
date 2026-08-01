const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/rewards.controller');

r.use(authRequired);
r.get('/status', ctrl.status);
r.post('/ad/start', ctrl.startDailyReward);
r.post('/ad/claim', ctrl.claimDailyReward);
r.post('/wheel-extra/start', ctrl.startWheelExtraSpin);
r.post('/wheel-extra/claim', ctrl.claimWheelExtraSpin);

module.exports = r;
