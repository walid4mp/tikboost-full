const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const maintenanceGuard = require('../middleware/maintenanceGuard');
const { requireProfileCompletion } = require('../middleware/profileCompletion');
const ctrl = require('../controllers/task.controller');

r.use(authRequired, maintenanceGuard, requireProfileCompletion);
r.get ('/feed',     ctrl.feed);
r.post('/execute',  ctrl.execute);
r.get ('/mine',     ctrl.my);

module.exports = r;
