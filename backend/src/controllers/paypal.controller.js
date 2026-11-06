const prisma = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { asyncHandler } = require('../utils/helpers');
const { adjustPoints } = require('../services/points.service');
const { getSettings } = require('../services/appSettings.service');

async function paypalAccessToken() {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw new AppError('الدفع التلقائي عبر PayPal غير مهيأ. أضف بيانات PayPal في إعدادات الخادم.', 503, 'PAYPAL_NOT_CONFIGURED');
  }
  const auth = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${env.PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new AppError('تعذر الاتصال بمزود الدفع.', 502, 'PAYPAL_AUTH_FAILED');
  return body.access_token;
}

const createOrder = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const paypalMethod = (settings.payments?.methods || []).find((method) => method.key === 'paypal');
  if (!paypalMethod || paypalMethod.enabled !== true || paypalMethod.type !== 'paypal') {
    throw new AppError('الدفع التلقائي عبر PayPal غير مفعّل من لوحة الإدارة.', 403, 'PAYPAL_DISABLED');
  }
  const pkg = await prisma.pointPackage.findUnique({ where: { id: String(req.body.packageId || '') } });
  if (!pkg || !pkg.isActive) throw new AppError('الباقة غير متاحة.', 404, 'PACKAGE_NOT_FOUND');
  if (!Number.isInteger(pkg.priceCents) || pkg.priceCents <= 0) throw new AppError('سعر الباقة غير صالح للدفع التلقائي.', 400, 'INVALID_PACKAGE_PRICE');
  const currency = String(pkg.currency || 'USD').toUpperCase();
  if (!['USD', 'EUR', 'GBP', 'CAD', 'AUD'].includes(currency)) throw new AppError('عملة هذه الباقة غير مدعومة عبر PayPal.', 400, 'PAYPAL_CURRENCY_UNSUPPORTED');

  const token = await paypalAccessToken();
  const purchase = await prisma.purchase.create({ data: {
    userId: req.user.id, packageId: pkg.id, pointsGiven: BigInt(pkg.points) + BigInt(pkg.bonusPoints),
    priceCents: pkg.priceCents, currency, method: 'paypal', status: 'PENDING',
    notes: JSON.stringify({ paymentProvider: 'paypal', automatic: true }),
  }});
  const amount = (pkg.priceCents / 100).toFixed(2);
  const response = await fetch(`${env.PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `tikboost-create-${purchase.id}` },
    body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: purchase.id, custom_id: purchase.id, description: `TikBoost points package: ${pkg.name}`, amount: { currency_code: currency, value: amount } }],
      application_context: { brand_name: 'TikBoost', user_action: 'PAY_NOW', return_url: `${env.APP_URL}/api/packages/paypal/return`, cancel_url: `${env.APP_URL}/api/packages/paypal/cancel` } }),
  });
  const order = await response.json().catch(() => ({}));
  if (!response.ok || !order.id) {
    await prisma.purchase.update({ where: { id: purchase.id }, data: { status: 'REJECTED', notes: JSON.stringify({ paymentProvider: 'paypal', automatic: true, error: 'order_creation_failed' }) } });
    throw new AppError('تعذر إنشاء طلب PayPal. حاول لاحقاً.', 502, 'PAYPAL_ORDER_FAILED');
  }
  await prisma.purchase.update({ where: { id: purchase.id }, data: { reference: order.id } });
  const approvalUrl = (order.links || []).find((link) => link.rel === 'approve')?.href;
  if (!approvalUrl) throw new AppError('لم يرجع PayPal رابط الدفع.', 502, 'PAYPAL_APPROVAL_URL_MISSING');
  res.status(201).json({ success: true, purchaseId: purchase.id, orderId: order.id, approvalUrl, status: 'PENDING' });
});

const captureOrder = asyncHandler(async (req, res) => {
  const purchaseId = String(req.body.purchaseId || '').trim();
  const orderId = String(req.body.orderId || '').trim();
  if (!purchaseId || !orderId) throw new AppError('بيانات طلب الدفع ناقصة.', 400, 'PAYPAL_ORDER_REQUIRED');
  const purchase = await prisma.purchase.findFirst({ where: { id: purchaseId, userId: req.user.id, method: 'paypal', reference: orderId }, include: { package: true } });
  if (!purchase) throw new AppError('طلب الدفع غير موجود.', 404, 'PAYPAL_PURCHASE_NOT_FOUND');
  if (purchase.status === 'APPROVED') return res.json({ success: true, status: 'APPROVED', pointsGiven: purchase.pointsGiven.toString(), alreadyProcessed: true });
  if (purchase.status !== 'PENDING') throw new AppError('طلب الدفع ليس قيد الانتظار.', 409, 'PAYPAL_PURCHASE_NOT_PENDING');

  const token = await paypalAccessToken();
  const response = await fetch(`${env.PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `tikboost-capture-${purchase.id}` }, body: '{}',
  });
  const capture = await response.json().catch(() => ({}));
  if (!response.ok && capture?.details?.[0]?.issue !== 'ORDER_ALREADY_CAPTURED') throw new AppError('لم يتم تأكيد الدفع من PayPal.', 402, 'PAYPAL_CAPTURE_FAILED');

  // Re-read order status from PayPal if capture endpoint reports a duplicate capture.
  let order = capture;
  if (!response.ok) {
    const verify = await fetch(`${env.PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: `Bearer ${token}` } });
    order = await verify.json().catch(() => ({}));
  }
  const unit = order.purchase_units?.[0];
  const captured = unit?.payments?.captures?.find((item) => item.status === 'COMPLETED');
  const amount = captured?.amount || unit?.amount;
  if ((captured?.status || order.status) !== 'COMPLETED' || unit?.custom_id !== purchase.id || amount?.currency_code !== purchase.currency || amount?.value !== (purchase.priceCents / 100).toFixed(2)) {
    throw new AppError('بيانات الدفع لا تطابق طلب الشراء. لم تتم إضافة النقاط.', 409, 'PAYPAL_AMOUNT_MISMATCH');
  }

  const captureId = captured?.id || order.id;
  await prisma.$transaction(async (tx) => {
    const locked = await tx.purchase.findUnique({ where: { id: purchase.id } });
    if (!locked || locked.status === 'APPROVED') return;
    if (locked.status !== 'PENDING' || locked.reference !== orderId) throw new AppError('تغيرت حالة طلب الدفع.', 409, 'PAYPAL_STATE_CHANGED');
    await tx.purchase.update({ where: { id: purchase.id }, data: { status: 'APPROVED', approvedAt: new Date(), reference: captureId, notes: JSON.stringify({ paymentProvider: 'paypal', automatic: true, orderId, captureId, verifiedStatus: 'COMPLETED' }) } });
    await adjustPoints(purchase.userId, purchase.pointsGiven, 'PURCHASE', { refType: 'Purchase', refId: purchase.id, note: `PayPal capture ${captureId}` }, tx);
  }, { isolationLevel: 'Serializable' });
  res.json({ success: true, status: 'APPROVED', pointsGiven: purchase.pointsGiven.toString() });
});

module.exports = { createOrder, captureOrder };
