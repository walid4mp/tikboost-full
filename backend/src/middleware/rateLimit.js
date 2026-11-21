const rateLimit = require('express-rate-limit');

// Mobile carriers put thousands of phones behind a single public IP (CGNAT).
// The old limit of 120 requests/minute per IP made legitimate users receive
// HTTP 429 — including on the push-token registration call, which the app
// swallowed silently, so those devices never got notifications.
const MAX_PER_MINUTE = parseInt(process.env.API_RATE_LIMIT || '600', 10);

module.exports = rateLimit({
  windowMs: 60 * 1000,
  max: MAX_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS' || req.path.startsWith('/notifications/device-token'),
  message: { success: false, message: 'Too many requests', code: 'RATE_LIMIT' },
});
