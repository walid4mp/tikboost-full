const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/user.controller');

r.use(authRequired);
r.get   ('/profile',            ctrl.getProfile);
r.put   ('/profile',            ctrl.updateProfile);
r.get   ('/points/history',     ctrl.pointHistory);
r.get   ('/stats',              ctrl.activityStats);

module.exports = r;
