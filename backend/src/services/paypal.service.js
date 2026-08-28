const env = require('../config/env');

function baseUrl() {
  return env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function ensureConfigured() {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    const e = new Error('PayPal Checkout غير مهيأ في الخادم. أضف PAYPAL_CLIENT_ID وPAYPAL_CLIENT_SECRET.');
    e.status = 503;
    throw e;
  }
}

async function accessToken() {
  ensureConfigured();
  const auth = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || 'تعذر الاتصال بـ PayPal.');
  return data.access_token;
}

async function paypalRequest(path, options = {}) {
  const token = await accessToken();
  const response = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.details?.map((x) => x.description).filter(Boolean).join('; ') || data?.message || 'PayPal API error';
    const e = new Error(message); e.status = response.status; e.paypal = data; throw e;
  }
  return data;
}

async function createOrder({ purchaseId, amount, currency, description }) {
  const returnUrl = env.PAYPAL_RETURN_URL || `${env.APP_URL}/api/payments/paypal/return`;
  const cancelUrl = env.PAYPAL_CANCEL_URL || `${env.APP_URL}/api/payments/paypal/cancel`;
  return paypalRequest('/v2/checkout/orders', {
    method: 'POST',
    headers: { 'PayPal-Request-Id': `tikboost-${purchaseId}` },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{ reference_id: purchaseId, custom_id: purchaseId, description: String(description || 'TikBoost Coins').slice(0, 127), amount: { currency_code: currency, value: Number(amount).toFixed(2) } }],
      application_context: { brand_name: 'TikBoost', user_action: 'PAY_NOW', return_url: returnUrl, cancel_url: cancelUrl, shipping_preference: 'NO_SHIPPING' },
    }),
  });
}

async function captureOrder(orderId) {
  return paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST', headers: { 'PayPal-Request-Id': `tikboost-capture-${orderId}` }, body: '{}' });
}

async function getOrder(orderId) {
  return paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
}

async function verifyWebhookSignature({ headers, event }) {
  if (!env.PAYPAL_WEBHOOK_ID) return false;
  const data = await paypalRequest('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    }),
  });
  return data.verification_status === 'SUCCESS';
}

function approvalUrl(order) {
  return (order.links || []).find((l) => l.rel === 'approve')?.href || (order.links || []).find((l) => l.rel === 'payer-action')?.href || null;
}

module.exports = { createOrder, captureOrder, getOrder, verifyWebhookSignature, approvalUrl };
