const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/user.controller');

r.use(authRequired);
r.get   ('/profile',            ctrl.getProfile);
r.put   ('/profile',            ctrl.updateProfileValidators, validate, ctrl.updateProfile);
r.post  ('/profile/complete',   ctrl.completeProfileValidators, validate, ctrl.completeProfile);
r.get   ('/points/history',     ctrl.pointHistory);
r.get   ('/purchases',          ctrl.purchaseHistory);
r.get   ('/stats',              ctrl.activityStats);
r.get   ('/ad-config',          ctrl.getAdConfig);
r.post  ('/ad-events',          require('./../controllers/admin.controller').recordAdEvent);

module.exports = r;
