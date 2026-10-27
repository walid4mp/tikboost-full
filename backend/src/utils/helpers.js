const crypto = require('crypto');

const TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vt.tiktok.com',
  'vm.tiktok.com',
]);

const TIKTOK_SHORT_HOSTS = new Set(['vt.tiktok.com', 'vm.tiktok.com']);
const TIKTOK_RESOLVE_TIMEOUT_MS = 12000;
const TIKTOK_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

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

function normalizeTikTokPath(pathname) {
  const compact = pathname.replace(/\/+/g, '/');
  if (!compact || compact === '/') return '/';
  return compact.replace(/\/+$/, '') || '/';
}

function sanitizeTikTokUrl(input) {
  const url = input instanceof URL ? new URL(input.toString()) : new URL(String(input));
  url.hash = '';
  url.search = '';
  url.hostname = url.hostname.toLowerCase() === 'tiktok.com' ? 'www.tiktok.com' : url.hostname.toLowerCase();
  url.pathname = normalizeTikTokPath(url.pathname);
  return url.toString();
}

function isSupportedTikTokHost(hostname) {
  return TIKTOK_HOSTS.has(String(hostname || '').toLowerCase());
}

function isTikTokShortLink(url) {
  const host = url.hostname.toLowerCase();
  const pathname = normalizeTikTokPath(url.pathname);
  return TIKTOK_SHORT_HOSTS.has(host) || /^\/t\/[^/]+$/i.test(pathname);
}

function extractTikTokMetadata(url) {
  const pathname = normalizeTikTokPath(url.pathname);
  const decoded = decodeURIComponent(pathname);
  const videoMatch = decoded.match(/^\/@([A-Za-z0-9._]{2,64})\/video\/(\d+)$/i);
  if (videoMatch) {
    return {
      targetUsername: `@${videoMatch[1].toLowerCase()}`,
      videoId: videoMatch[2],
    };
  }

  const profileMatch = decoded.match(/^\/@([A-Za-z0-9._]{2,64})$/i);
  if (profileMatch) {
    return {
      targetUsername: `@${profileMatch[1].toLowerCase()}`,
      videoId: null,
    };
  }

  return null;
}

async function resolveTikTokCanonicalUrl(input, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch unavailable');
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error('TikTok redirect resolution timed out')),
    options.timeoutMs || TIKTOK_RESOLVE_TIMEOUT_MS,
  );

  try {
    const response = await fetchImpl(String(input), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'user-agent': options.userAgent || TIKTOK_USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    if (!response?.url) {
      throw new Error('Missing redirect target');
    }

    try {
      await response.body?.cancel?.();
    } catch {
      // ignore body cancellation errors
    }

    return sanitizeTikTokUrl(response.url);
  } finally {
    clearTimeout(timeout);
  }
}

async function parseTikTokTarget(input, options = {}) {
  const raw = normalizeTikTokUrl(input);
  if (!raw) {
    return { valid: false, reason: 'empty' };
  }

  let initialUrl;
  try {
    initialUrl = new URL(raw);
  } catch {
    return { valid: false, reason: 'parse' };
  }

  if (!/^https?:$/i.test(initialUrl.protocol)) {
    return { valid: false, reason: 'protocol' };
  }

  if (!isSupportedTikTokHost(initialUrl.hostname)) {
    return { valid: false, reason: 'host' };
  }

  const isShortLink = isTikTokShortLink(initialUrl);
  let canonicalUrl = sanitizeTikTokUrl(initialUrl);

  if (isShortLink) {
    try {
      const resolver = options.resolveFinalUrl || ((value) => resolveTikTokCanonicalUrl(value, options));
      canonicalUrl = await resolver(canonicalUrl);
    } catch {
      return { valid: false, reason: 'redirect' };
    }
  }

  let finalUrl;
  try {
    finalUrl = new URL(canonicalUrl);
  } catch {
    return { valid: false, reason: 'parse' };
  }

  if (!/^https?:$/i.test(finalUrl.protocol)) {
    return { valid: false, reason: 'protocol' };
  }

  if (!isSupportedTikTokHost(finalUrl.hostname)) {
    return { valid: false, reason: 'host' };
  }

  const metadata = extractTikTokMetadata(finalUrl);
  if (!metadata) {
    return { valid: false, reason: 'path' };
  }

  const targetUrl = sanitizeTikTokUrl(finalUrl);
  return {
    valid: true,
    targetUrl,
    canonicalUrl: targetUrl,
    targetUsername: metadata.targetUsername,
    username: metadata.targetUsername,
    videoId: metadata.videoId,
    isShortLink,
  };
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
  sanitizeTikTokUrl,
  extractTikTokMetadata,
  resolveTikTokCanonicalUrl,
  parseTikTokTarget,
  asyncHandler,
};
