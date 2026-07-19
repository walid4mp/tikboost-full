const crypto = require('crypto');

function randomCode(len = 8) {
  return crypto.randomBytes(len).toString('base64').replace(/[^A-Z0-9]/gi, '').slice(0, len).toUpperCase();
}

function randomToken(bytes = 40) {
  return crypto.randomBytes(bytes).toString('hex');
}

function safeBigInt(v) {
  return BigInt(typeof v === 'string' ? v : v ?? 0);
}

function truthyIp(req) {
  return (req.headers['x-forwarded-for']?.toString().split(',')[0].trim())
    || req.ip
    || req.socket?.remoteAddress
    || '';
}

function paginate(page = 1, limit = 20, max = 100) {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(max, Math.max(1, parseInt(limit, 10) || 20));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { randomCode, randomToken, safeBigInt, truthyIp, paginate, asyncHandler };
