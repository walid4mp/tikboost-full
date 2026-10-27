const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccess(payload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES });
}
function signRefresh(payload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES });
}
function verifyRefresh(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

module.exports = { signAccess, signRefresh, verifyRefresh };
