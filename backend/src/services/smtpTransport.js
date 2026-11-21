/**
 * Optional SMTP fallback (only used when EMAIL_PROVIDER=smtp).
 * Kept isolated so the default HTTPS path does not even load nodemailer.
 */
const dns = require('node:dns').promises;
const net = require('node:net');
const env = require('../config/env');

let transporter = null;
let transportHost = null;

async function initSmtp() {
  transporter = null;
  transportHost = null;
  if (!env.SMTP_HOST) return { ready: false };

  let host = env.SMTP_HOST.trim();
  if (net.isIP(host) !== 4) {
    const addrs = await dns.resolve4(host);
    if (!addrs.length) throw new Error(`no A records for ${host}`);
    transportHost = addrs[0];
  } else {
    transportHost = host;
  }

  const port = Number(env.SMTP_PORT || 465);
  const secure = env.SMTP_SECURE !== ''
    ? String(env.SMTP_SECURE) === 'true'
    : port === 465;

  // eslint-disable-next-line global-require
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host: transportHost,
    port,
    secure,
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    requireTLS: !secure,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    tls: { servername: env.SMTP_HOST, family: 4, rejectUnauthorized: true },
  });

  return { ready: true, transportHost, port, secure };
}

async function verifySmtp() {
  if (!transporter) {
    const err = new Error('SMTP not configured');
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }
  await transporter.verify();
  return { ok: true, transportHost };
}

async function sendSmtp({ from, to, subject, text, html }) {
  if (!transporter) {
    const err = new Error('SMTP not configured');
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }
  const info = await transporter.sendMail({ from, to, subject, text, html });
  return { delivered: true, provider: 'smtp', id: info.messageId };
}

module.exports = { initSmtp, verifySmtp, sendSmtp };
