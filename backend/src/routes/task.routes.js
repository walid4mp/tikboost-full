const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const { requireProfileCompletion } = require('../middleware/profileCompletion');
const ctrl = require('../controllers/task.controller');

r.use(authRequired, requireProfileCompletion);
r.get ('/feed',     ctrl.feed);
r.post('/execute',  ctrl.execute);
r.get ('/mine',     ctrl.my);

module.exports = r;
