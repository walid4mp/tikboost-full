/**
 * HTTPS-first mailer with SMTP fallback.
 *
 * Root cause of the previous EMAIL_SEND_FAILED on Render free tier:
 *   Render's free egress cannot reliably open outbound TCP to smtp.gmail.com
 *   (:465 / :587). Repeated fixes at the DNS/IPv4/family layer never solved it
 *   because the block is at the network layer, not the resolver. This module
 *   therefore sends via HTTPS to a transactional provider (Resend by default,
 *   Brevo/Mailgun optional). SMTP is kept only as an explicit fallback for
 *   environments that do allow outbound 25/465/587.
 *
 * Security invariants:
 *   - EMAIL_API_KEY / SMTP_PASSWORD are NEVER logged.
 *   - OTP code is NEVER logged. Only pass-through to the provider.
 *   - Failures throw with a machine-readable `code` — the controller maps them
 *     to a 503 response and deletes the just-created reset token so retries
 *     stay clean.
 */

const env = require('../config/env');

let providerLabel = null;
let providerReady = false;
let providerConfig = null;

function redact(value) {
  if (!value) return '(unset)';
  const s = String(value);
  if (s.length <= 6) return '***';
  return `${s.slice(0, 2)}***${s.slice(-2)} (len=${s.length})`;
}

async function httpPostJson(url, headers, body, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) { /* keep text */ }
    return { ok: res.ok, status: res.status, text, json };
  } finally {
    clearTimeout(timer);
  }
}

async function httpPostForm(url, headers, form, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(form)) body.append(k, v);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
      body: body.toString(),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) { /* keep text */ }
    return { ok: res.ok, status: res.status, text, json };
  } finally {
    clearTimeout(timer);
  }
}

async function initMailer() {
  providerLabel = null;
  providerReady = false;
  providerConfig = null;

  const provider = (env.EMAIL_PROVIDER || 'resend').toLowerCase();

  if (provider === 'resend') {
    if (!env.EMAIL_API_KEY) {
      console.warn('[mailer] provider=resend but EMAIL_API_KEY is empty — password reset will fail (503).');
      providerLabel = 'resend';
      return;
    }
    providerLabel = 'resend';
    providerReady = true;
    providerConfig = { endpoint: 'https://api.resend.com/emails' };
    console.log(`[mailer] provider=resend from=${env.MAIL_FROM} key=${redact(env.EMAIL_API_KEY)}`);
    return;
  }

  if (provider === 'brevo') {
    if (!env.EMAIL_API_KEY) {
      console.warn('[mailer] provider=brevo but EMAIL_API_KEY is empty — password reset will fail (503).');
      providerLabel = 'brevo';
      return;
    }
    providerLabel = 'brevo';
    providerReady = true;
    providerConfig = { endpoint: 'https://api.brevo.com/v3/smtp/email' };
    console.log(`[mailer] provider=brevo from=${env.MAIL_FROM} key=${redact(env.EMAIL_API_KEY)}`);
    return;
  }

  if (provider === 'mailgun') {
    if (!env.EMAIL_API_KEY || !env.MAILGUN_DOMAIN) {
      console.warn('[mailer] provider=mailgun requires EMAIL_API_KEY and MAILGUN_DOMAIN — password reset will fail (503).');
      providerLabel = 'mailgun';
      return;
    }
    providerLabel = 'mailgun';
    providerReady = true;
    providerConfig = {
      endpoint: `https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`,
      auth: 'Basic ' + Buffer.from(`api:${env.EMAIL_API_KEY}`).toString('base64'),
    };
    console.log(`[mailer] provider=mailgun domain=${env.MAILGUN_DOMAIN} from=${env.MAIL_FROM} key=${redact(env.EMAIL_API_KEY)}`);
    return;
  }

  if (provider === 'smtp') {
    // Explicit opt-in only. Kept behind a lazy require so environments without
    // nodemailer installed still work.
    try {
      // eslint-disable-next-line global-require
      const { initSmtp } = require('./smtpTransport');
      const info = await initSmtp();
      providerLabel = 'smtp';
      providerReady = !!info?.ready;
      providerConfig = info || null;
      console.log(`[mailer] provider=smtp host=${env.SMTP_HOST} port=${env.SMTP_PORT} ready=${providerReady}`);
    } catch (err) {
      console.error(`[mailer] SMTP fallback init failed: ${err.code || ''} ${err.message}`);
      providerLabel = 'smtp';
      providerReady = false;
    }
    return;
  }

  console.warn(`[mailer] unknown EMAIL_PROVIDER='${provider}' — password reset will fail (503).`);
  providerLabel = provider;
}

async function verifyEmailProvider() {
  if (!providerLabel) {
    const err = new Error('Email provider not initialised');
    err.code = 'EMAIL_PROVIDER_UNINITIALISED';
    throw err;
  }
  if (!providerReady) {
    const err = new Error(`Email provider "${providerLabel}" is not ready (missing API key or bad config)`);
    err.code = 'EMAIL_PROVIDER_NOT_READY';
    throw err;
  }

  // For HTTPS providers we perform a real, side-effect-free reachability check.
  if (providerLabel === 'resend') {
    // Resend has no dedicated "ping" endpoint; use domains list (GET, cheap, requires auth).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: { Authorization: `Bearer ${env.EMAIL_API_KEY}`, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok && res.status !== 401) {
        // 401 also proves reachability; only network / 5xx counts as unreachable.
        const body = await res.text().catch(() => '');
        const err = new Error(`Resend reachability check failed: HTTP ${res.status} ${body.slice(0, 200)}`);
        err.code = 'EMAIL_PROVIDER_UNREACHABLE';
        throw err;
      }
      return { provider: 'resend', status: res.status };
    } finally {
      clearTimeout(timer);
    }
  }

  if (providerLabel === 'brevo') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch('https://api.brevo.com/v3/account', {
        method: 'GET',
        headers: { 'api-key': env.EMAIL_API_KEY, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok && res.status !== 401) {
        const body = await res.text().catch(() => '');
        const err = new Error(`Brevo reachability check failed: HTTP ${res.status} ${body.slice(0, 200)}`);
        err.code = 'EMAIL_PROVIDER_UNREACHABLE';
        throw err;
      }
      return { provider: 'brevo', status: res.status };
    } finally {
      clearTimeout(timer);
    }
  }

  if (providerLabel === 'mailgun') {
    return { provider: 'mailgun', status: 'assumed-ok' };
  }

  if (providerLabel === 'smtp') {
    // eslint-disable-next-line global-require
    const { verifySmtp } = require('./smtpTransport');
    const r = await verifySmtp();
    return { provider: 'smtp', ...r };
  }

  const err = new Error(`Unknown provider ${providerLabel}`);
  err.code = 'EMAIL_PROVIDER_UNKNOWN';
  throw err;
}

/**
 * Sends a 6-digit password reset code. The raw code is passed through
 * untouched; the caller is responsible for hashing it before storage.
 */
async function sendPasswordResetCode(toEmail, code, ttlMin) {
  if (!providerReady) {
    const err = new Error(`Email provider "${providerLabel || 'unset'}" is not ready`);
    err.code = 'EMAIL_PROVIDER_NOT_READY';
    throw err;
  }

  const subject = 'رمز إعادة تعيين كلمة المرور — TokAura';
  const textBody =
    `رمز إعادة تعيين كلمة المرور الخاص بك هو: ${code}\n` +
    `صالح لمدة ${ttlMin} دقيقة ويُستخدم مرة واحدة فقط.\n` +
    'إن لم تطلب ذلك، تجاهل هذه الرسالة.';
  const htmlBody = `<div dir="rtl" style="font-family:sans-serif">
    <h2>إعادة تعيين كلمة المرور</h2>
    <p>رمز التحقق الخاص بك:</p>
    <p style="font-size:28px;letter-spacing:6px;font-weight:bold">${code}</p>
    <p>صالح لمدة ${ttlMin} دقيقة ويُستخدم مرة واحدة فقط.</p>
    <p style="color:#888">إن لم تطلب إعادة التعيين، تجاهل هذه الرسالة.</p>
  </div>`;

  if (providerLabel === 'resend') {
    const r = await httpPostJson(
      providerConfig.endpoint,
      { Authorization: `Bearer ${env.EMAIL_API_KEY}` },
      { from: env.MAIL_FROM, to: [toEmail], subject, text: textBody, html: htmlBody },
    );
    if (!r.ok) {
      const err = new Error(`Resend send failed: HTTP ${r.status} ${(r.text || '').slice(0, 200)}`);
      err.code = 'EMAIL_SEND_HTTP_ERROR';
      err.providerStatus = r.status;
      throw err;
    }
    return { delivered: true, provider: 'resend', id: r.json?.id };
  }

  if (providerLabel === 'brevo') {
    const r = await httpPostJson(
      providerConfig.endpoint,
      { 'api-key': env.EMAIL_API_KEY },
      {
        sender: { email: env.MAIL_FROM.match(/<(.+?)>/)?.[1] || env.MAIL_FROM, name: 'TokAura' },
        to: [{ email: toEmail }],
        subject,
        textContent: textBody,
        htmlContent: htmlBody,
      },
    );
    if (!r.ok) {
      const err = new Error(`Brevo send failed: HTTP ${r.status} ${(r.text || '').slice(0, 200)}`);
      err.code = 'EMAIL_SEND_HTTP_ERROR';
      err.providerStatus = r.status;
      throw err;
    }
    return { delivered: true, provider: 'brevo', id: r.json?.messageId };
  }

  if (providerLabel === 'mailgun') {
    const r = await httpPostForm(
      providerConfig.endpoint,
      { Authorization: providerConfig.auth },
      { from: env.MAIL_FROM, to: toEmail, subject, text: textBody, html: htmlBody },
    );
    if (!r.ok) {
      const err = new Error(`Mailgun send failed: HTTP ${r.status} ${(r.text || '').slice(0, 200)}`);
      err.code = 'EMAIL_SEND_HTTP_ERROR';
      err.providerStatus = r.status;
      throw err;
    }
    return { delivered: true, provider: 'mailgun', id: r.json?.id };
  }

  if (providerLabel === 'smtp') {
    // eslint-disable-next-line global-require
    const { sendSmtp } = require('./smtpTransport');
    return sendSmtp({ to: toEmail, subject, text: textBody, html: htmlBody, from: env.MAIL_FROM });
  }

  const err = new Error(`Unsupported provider ${providerLabel}`);
  err.code = 'EMAIL_PROVIDER_UNKNOWN';
  throw err;
}

// Backwards compatibility for older token-based flow (unused by controller now).
async function sendPasswordReset(toEmail, resetUrl) {
  return sendPasswordResetCode(toEmail, resetUrl, 15);
}

// Also expose the old name so server.js keeps working during rollout.
async function verifySmtpConnection() {
  return verifyEmailProvider();
}

module.exports = {
  initMailer,
  verifyEmailProvider,
  verifySmtpConnection,
  sendPasswordResetCode,
  sendPasswordReset,
  _internals: {
    get providerLabel() { return providerLabel; },
    get providerReady() { return providerReady; },
  },
};
