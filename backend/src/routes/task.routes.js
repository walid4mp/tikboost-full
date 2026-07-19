const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/task.controller');

r.use(authRequired);
r.get ('/feed',     ctrl.feed);
r.post('/execute',  ctrl.execute);
r.get ('/mine',     ctrl.my);

module.exports = r;
