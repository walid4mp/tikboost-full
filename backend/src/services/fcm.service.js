const crypto = require('crypto');
const env = require('../config/env');

let cachedAccessToken = null;
let cachedExpiresAt = 0;
let cachedAccount = null;

function getServiceAccount() {
  if (cachedAccount) return cachedAccount;
  const raw = String(env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;
  try {
    const account = JSON.parse(raw);
    if (!account.client_email || !account.private_key) throw new Error('Missing client_email/private_key');
    cachedAccount = account;
    return account;
  } catch (err) {
    console.error(`[fcm] invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${err.message}`);
    return null;
  }
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

async function getAccessToken() {
  const account = getServiceAccount();
  if (!account) return null;
  if (cachedAccessToken && Date.now() < cachedExpiresAt - 60_000) return cachedAccessToken;

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
  if (!response.ok || !json?.access_token) throw new Error(`Firebase OAuth failed: HTTP ${response.status}`);
  cachedAccessToken = json.access_token;
  cachedExpiresAt = Date.now() + Number(json.expires_in || 3600) * 1000;
  return cachedAccessToken;
}

async function sendPush(token, title, body, type = 'info', data = null) {
  if (!token) return { sent: false, skipped: true, reason: 'no-token' };
  const account = getServiceAccount();
  if (!account) return { sent: false, skipped: true, reason: 'firebase-not-configured' };
  const accessToken = await getAccessToken();
  const projectId = account.project_id || env.FIREBASE_PROJECT_ID;
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: { type: String(type || 'info'), ...(data && typeof data === 'object' ? Object.fromEntries(Object.entries(data).map(([k,v]) => [String(k), String(v)])) : {}) },
        android: {
          priority: 'HIGH',
          notification: { channel_id: 'tokaura_general', sound: 'notify', default_sound: false },
        },
      },
    }),
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}
  if (!response.ok) {
    const error = new Error(`FCM send failed: HTTP ${response.status}`);
    error.status = response.status;
    error.response = json;
    throw error;
  }
  return { sent: true, name: json?.name || null };
}

async function sendPushMany(tokens, title, body, type = 'info', data = null) {
  const unique = [...new Set(tokens.filter(Boolean))];
  const results = { sent: 0, failed: 0, skipped: 0 };
  for (let i = 0; i < unique.length; i += 25) {
    const chunk = unique.slice(i, i + 25);
    const settled = await Promise.allSettled(chunk.map((token) => sendPush(token, title, body, type, data)));
    for (const item of settled) {
      if (item.status === 'fulfilled') {
        if (item.value.sent) results.sent += 1; else results.skipped += 1;
      } else results.failed += 1;
    }
  }
  return results;
}

module.exports = { sendPush, sendPushMany };
