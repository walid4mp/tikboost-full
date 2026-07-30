const crypto = require('crypto');

const TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vt.tiktok.com',
  'vm.tiktok.com',
]);

const TIKTOK_SHORT_HOSTS = new Set(['vt.tiktok.com', 'vm.tiktok.com']);

function randomCode(len = 8) {
  return crypto
    .randomBytes(len)
    .toString('base64')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, len)
    .toUpperCase();
}

function randomToken(bytes = 40) {
  return crypto.randomBytes(bytes).toString('hex');
}

function safeBigInt(v) {
  return BigInt(typeof v === 'string' ? v : v ?? 0);
}

function truthyIp(req) {
  return (
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}

function paginate(page = 1, limit = 20, max = 100) {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(max, Math.max(1, parseInt(limit, 10) || 20));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

function normalizeTikTokUrl(input) {
  return String(input || '').trim();
}

function parseTikTokTarget(input) {
  const raw = normalizeTikTokUrl(input);
  if (!raw) {
    return { valid: false, reason: 'empty' };
  }

  try {
    const url = new URL(raw);
    if (!/^https?:$/i.test(url.protocol)) {
      return { valid: false, reason: 'protocol' };
    }

    const host = url.hostname.toLowerCase();
    if (!TIKTOK_HOSTS.has(host)) {
      return { valid: false, reason: 'host' };
    }

    const usernameMatch = url.pathname.match(/@([A-Za-z0-9._]{2,30})/);
    if (usernameMatch) {
      return {
        valid: true,
        targetUrl: raw,
        targetUsername: `@${usernameMatch[1].toLowerCase()}`,
        isShortLink: false,
      };
    }

    if (TIKTOK_SHORT_HOSTS.has(host)) {
      return {
        valid: true,
        targetUrl: raw,
        targetUsername: raw,
        isShortLink: true,
      };
    }

    return {
      valid: true,
      targetUrl: raw,
      targetUsername: raw,
      isShortLink: false,
    };
  } catch {
    return { valid: false, reason: 'parse' };
  }
}

function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  randomCode,
  randomToken,
  safeBigInt,
  truthyIp,
  paginate,
  normalizeTikTokUrl,
  parseTikTokTarget,
  asyncHandler,
};
