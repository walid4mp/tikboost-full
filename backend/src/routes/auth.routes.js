const r = require('express').Router();
const validate = require('../middleware/validate');
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/auth.controller');

r.post('/signup',        ctrl.validateSignup, validate, ctrl.signup);
r.post('/login',         ctrl.login);
r.post('/google',        ctrl.googleLogin);
r.post('/refresh',       ctrl.refresh);
r.post('/forgot',        ctrl.forgotPassword);
r.post('/logout',        ctrl.logout);
r.get ('/me',            authRequired, ctrl.me);

module.exports = r;
