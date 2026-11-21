const r = require('express').Router();
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/contact.controller');

r.post('/', authRequired, ctrl.submit);

module.exports = r;
