/**
 * Strict rate limiters for password reset flow.
 * - forgotPasswordLimiter: prevents email flooding + user enumeration probes.
 * - resetPasswordLimiter: prevents OTP brute-force on the 6-digit code.
 *
 * Keyed by IP (Render trusts one proxy hop) AND normalised email so a single
 * attacker cannot burn through a shared IP quota to lock out unrelated users.
 */
const rateLimit = require('express-rate-limit');

function keyByIpEmail(req) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  return `${req.ip}|${email}`;
}

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 forgot attempts per email+IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIpEmail,
  skipSuccessfulRequests: false,
  message: {
    success: false,
    code: 'RATE_LIMIT_FORGOT',
    message: 'محاولات كثيرة، انتظر قليلًا ثم حاول مرة أخرى.',
  },
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 OTP submissions per email+IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIpEmail,
  message: {
    success: false,
    code: 'RATE_LIMIT_RESET',
    message: 'محاولات كثيرة، انتظر قليلًا ثم حاول مرة أخرى.',
  },
});

module.exports = { forgotPasswordLimiter, resetPasswordLimiter };
