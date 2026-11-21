const crypto = require('crypto');
const env = require('../config/env');

/**
 * Firebase Cloud Messaging (HTTP v1) sender.
 *
 * Fixes over the previous version:
 *  - The Android channel id now matches the channel the app really creates
 *    (`tikboostwh_general_v2`). The old `tokaura_general_v2` id did not exist
 *    on devices, so Android silently dropped the sound / heads-up behaviour.
 *  - Only tokens FCM reports as unregistered are deleted. `INVALID_ARGUMENT`
 *    used to wipe valid tokens whenever the *payload* was malformed.
 *  - Transient errors (429 / 5xx) are retried with back-off and an expired
 *    OAuth token is refreshed once automatically.
 *  - Bulk sends run with bounded concurrency and report per-error-code stats
 *    so the admin panel can show exactly why a device was not reached.
 */

const ANDROID_CHANNEL_ID = process.env.FCM_ANDROID_CHANNEL_ID || 'tikboostwh_general_v2';
const SEND_CONCURRENCY = Math.max(1, parseInt(process.env.FCM_CONCURRENCY || '40', 10));
const MAX_ATTEMPTS = 3;

let cachedAccessToken = null;
let cachedExpiresAt = 0;
let cachedAccount = null;
let cachedRaw = null;

function normalizePrivateKey(key) {
  // Render / .env often store the key with literal "\n" sequences.
  return String(key || '').replace(/\\n/g, '\n');
}

function getServiceAccount() {
  const raw = String(env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;
  if (cachedAccount && cachedRaw === raw) return cachedAccount;
  try {
    // Accept plain JSON as well as base64-encoded JSON (easier to paste in dashboards).
    const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const account = JSON.parse(text);
    if (!account.client_email || !account.private_key) throw new Error('Missing client_email/private_key');
    account.private_key = normalizePrivateKey(account.private_key);
    cachedAccount = account;
    cachedRaw = raw;
    return account;
  } catch (err) {
    console.error(`[fcm] invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${err.message}`);
    return null;
  }
}

function isConfigured() {
  return !!getServiceAccount();
}

function getProjectId() {
  const account = getServiceAccount();
  return (account && account.project_id) || env.FIREBASE_PROJECT_ID || null;
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

async function getAccessToken(force = false) {
  const account = getServiceAccount();
  if (!account) return null;
  if (!force && cachedAccessToken && Date.now() < cachedExpiresAt - 60_000) return cachedAccessToken;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  signer.end();
  const assertion = `${header}.${claim}.${signer.sign(account.private_key, 'base64url')}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  if (!response.ok || !json?.access_token) {
    const detail = json?.error_description || json?.error || `HTTP ${response.status}`;
    throw new Error(`Firebase OAuth failed: ${detail}`);
  }
  cachedAccessToken = json.access_token;
  cachedExpiresAt = Date.now() + Number(json.expires_in || 3600) * 1000;
  return cachedAccessToken;
}

/**
 * Classifies an FCM HTTP v1 error response.
 * Pure function (no I/O) so it can be unit-tested.
 */
function classifyFcmError(status, json) {
  const details = Array.isArray(json?.error?.details) ? json.error.details : [];
  const fcmDetail = details.find((d) => d && d.errorCode);
  const code = String(fcmDetail?.errorCode || json?.error?.status || '').toUpperCase();
  const message = String(json?.error?.message || '');

  const unregistered = code === 'UNREGISTERED' || code === 'NOT_FOUND' || status === 404;
  const senderMismatch = code === 'SENDER_ID_MISMATCH';
  // INVALID_ARGUMENT is only a bad *token* when the message says so; otherwise
  // the payload is wrong and the token must be kept.
  const badToken = code === 'INVALID_ARGUMENT' && /registration token|not a valid fcm/i.test(message);

  const deadToken = unregistered || senderMismatch || badToken;
  const retryable = !deadToken && (
    status === 429 || status === 500 || status === 502 || status === 503 || status === 504 ||
    ['UNAVAILABLE', 'INTERNAL', 'QUOTA_EXCEEDED', 'RESOURCE_EXHAUSTED'].includes(code)
  );
  const authExpired = status === 401 || code === 'UNAUTHENTICATED';

  return { code: code || `HTTP_${status}`, message, deadToken, retryable, authExpired };
}

function buildMessage(token, title, body, type, data) {
  const extra = data && typeof data === 'object'
    ? Object.fromEntries(
      Object.entries(data)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [String(k), typeof v === 'object' ? JSON.stringify(v) : String(v)]),
    )
    : {};
  return {
    message: {
      token,
      notification: { title: String(title || ''), body: String(body || '') },
      data: { ...extra, type: String(type || 'info'), title: String(title || ''), body: String(body || '') },
      android: {
        priority: 'HIGH',
        ttl: '259200s',
        notification: {
          channel_id: ANDROID_CHANNEL_ID,
          sound: 'notify',
          default_sound: false,
          notification_priority: 'PRIORITY_HIGH',
          visibility: 'PUBLIC',
        },
      },
    },
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendOnce(payload) {
  const projectId = getProjectId();
  const accessToken = await getAccessToken();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}
  return { response, json };
}

/**
 * Sends one push. Never throws for FCM-level failures; returns a result object:
 *   { sent: true, name }  or  { sent: false, skipped?, code, message, deadToken }
 */
async function sendPush(token, title, body, type = 'info', data = null) {
  if (!token) return { sent: false, skipped: true, reason: 'no-token' };
  if (!getServiceAccount()) return { sent: false, skipped: true, reason: 'firebase-not-configured' };

  const payload = buildMessage(token, title, body, type, data);
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const { response, json } = await sendOnce(payload);
      if (response.ok) return { sent: true, name: json?.name || null };

      const info = classifyFcmError(response.status, json);
      lastError = { sent: false, failed: true, status: response.status, ...info };

      if (info.authExpired && attempt < MAX_ATTEMPTS) {
        await getAccessToken(true);
        continue;
      }
      if (info.retryable && attempt < MAX_ATTEMPTS) {
        await sleep(300 * 2 ** (attempt - 1));
        continue;
      }
      return lastError;
    } catch (err) {
      lastError = { sent: false, failed: true, code: 'NETWORK', message: err.message, deadToken: false };
      if (attempt < MAX_ATTEMPTS) {
        await sleep(300 * 2 ** (attempt - 1));
        continue;
      }
    }
  }
  return lastError || { sent: false, failed: true, code: 'UNKNOWN', message: 'unknown', deadToken: false };
}

/**
 * Sends the same push to many tokens with bounded concurrency.
 * Returns { total, sent, failed, skipped, deadTokens: string[], errors: { CODE: count } }.
 */
async function sendPushMany(tokens, title, body, type = 'info', data = null) {
  const unique = [...new Set((tokens || []).filter(Boolean))];
  const stats = { total: unique.length, sent: 0, failed: 0, skipped: 0, deadTokens: [], errors: {} };
  if (!unique.length) return stats;

  if (!getServiceAccount()) {
    stats.skipped = unique.length;
    stats.errors['firebase-not-configured'] = unique.length;
    return stats;
  }

  let cursor = 0;
  async function worker() {
    while (cursor < unique.length) {
      const token = unique[cursor];
      cursor += 1;
      const result = await sendPush(token, title, body, type, data);
      if (result.sent) stats.sent += 1;
      else if (result.skipped) stats.skipped += 1;
      else {
        stats.failed += 1;
        const key = result.code || 'UNKNOWN';
        stats.errors[key] = (stats.errors[key] || 0) + 1;
        if (result.deadToken) stats.deadTokens.push(token);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(SEND_CONCURRENCY, unique.length) }, worker));
  return stats;
}

/** Removes tokens that FCM reported as permanently invalid. */
async function purgeDeadTokens(tokens) {
  const dead = [...new Set((tokens || []).filter(Boolean))];
  if (!dead.length) return 0;
  try {
    const prisma = require('../config/db');
    const removed = await prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
    await prisma.user.updateMany({ where: { fcmToken: { in: dead } }, data: { fcmToken: null } });
    console.warn(`[fcm] removed ${removed.count} stale device token(s)`);
    return removed.count;
  } catch (err) {
    console.warn(`[fcm] could not purge stale tokens: ${err.message}`);
    return 0;
  }
}

module.exports = {
  ANDROID_CHANNEL_ID,
  isConfigured,
  getProjectId,
  classifyFcmError,
  buildMessage,
  sendPush,
  sendPushMany,
  purgeDeadTokens,
};
