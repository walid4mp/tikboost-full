const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/rewards.controller');

r.use(authRequired);
r.get('/status', ctrl.status);
r.get('/profile', ctrl.profile);
r.post('/ad/start', ctrl.startDailyReward);
r.post('/ad/claim', ctrl.claimDailyReward);
r.post('/wheel-extra/start', ctrl.startWheelExtraSpin);
r.post('/wheel-extra/claim', ctrl.claimWheelExtraSpin);
r.post('/login/claim', ctrl.claimLoginReward);
r.get('/chest', ctrl.chestStatus);
r.post('/chest/open', ctrl.openChest);
r.get('/daily-tasks', ctrl.dailyTasks);
r.post('/daily-tasks/:key/claim', ctrl.claimTaskReward);
r.post('/daily-tasks/:key/complete', ctrl.completeManualTask);
r.get('/achievements', ctrl.achievements);
r.post('/achievements/:key/claim', ctrl.claimAchievementReward);

module.exports = r;
