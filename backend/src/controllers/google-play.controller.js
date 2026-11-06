const crypto = require('node:crypto');
const prisma = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { asyncHandler } = require('../utils/helpers');
const { adjustPoints } = require('../services/points.service');
const { getSettings } = require('../services/appSettings.service');
const { notify } = require('../services/notifications.service');

function b64url(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64url');
}

async function publisherAccessToken() {
  if (!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
    throw new AppError('لم يتم إعداد التحقق من Google Play على الخادم.', 503, 'GOOGLE_PLAY_NOT_CONFIGURED');
  }
  let account;
  try { account = JSON.parse(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON); }
  catch { throw new AppError('إعداد حساب خدمة Google Play غير صالح.', 503, 'GOOGLE_PLAY_CONFIG_INVALID'); }
  if (!account.client_email || !account.private_key) {
    throw new AppError('بيانات حساب خدمة Google Play ناقصة.', 503, 'GOOGLE_PLAY_CONFIG_INVALID');
  }
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(account.private_key, 'base64url')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new AppError('تعذر الحصول على صلاحية التحقق من Google Play. راجع صلاحيات حساب الخدمة.', 503, 'GOOGLE_PLAY_AUTH_FAILED');
  }
  return data.access_token;
}

const verifyProduct = asyncHandler(async (req, res) => {
  const productId = String(req.body.productId || '').trim();
  const purchaseToken = String(req.body.purchaseToken || '').trim();
  const packageId = String(req.body.packageId || '').trim();
  if (!productId || !purchaseToken || !packageId || purchaseToken.length > 5000) {
    throw new AppError('بيانات عملية الشراء ناقصة.', 400, 'PURCHASE_DATA_REQUIRED');
  }
  const pkg = await prisma.pointPackage.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.isActive || pkg.slug !== productId) {
    throw new AppError('معرّف المنتج لا يطابق باقة نشطة في المتجر.', 400, 'PRODUCT_MISMATCH');
  }
  const tokenHash = crypto.createHash('sha256').update(purchaseToken).digest('hex');
  const existing = await prisma.purchase.findFirst({
    where: { method: 'google_play', reference: tokenHash },
    select: { id: true, userId: true, status: true },
  });
  if (existing) {
    if (existing.userId !== req.user.id) throw new AppError('تم استخدام عملية الشراء لحساب آخر.', 409, 'PURCHASE_ALREADY_CLAIMED');
    return res.json({ success: true, alreadyProcessed: true, purchaseId: existing.id, status: existing.status });
  }

  const accessToken = await publisherAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const verification = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  const receipt = await verification.json().catch(() => ({}));
  if (!verification.ok || Number(receipt.purchaseState) !== 0) {
    throw new AppError('لم يؤكد Google Play أن عملية الشراء مكتملة. لم تُضف النقاط.', 400, 'PURCHASE_NOT_VERIFIED');
  }
  if (receipt.productId && receipt.productId !== productId) {
    throw new AppError('المنتج المؤكد من Google Play لا يطابق الباقة.', 400, 'PURCHASE_PRODUCT_MISMATCH');
  }

  const points = BigInt(pkg.points) + BigInt(pkg.bonusPoints);
  const orderId = String(receipt.orderId || '').slice(0, 255);
  try {
    const purchase = await prisma.$transaction(async (tx) => {
      // Serialize claims for the same verified token, so concurrent callbacks cannot grant twice.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tokenHash}))`;
      const already = await tx.purchase.findFirst({
        where: { method: 'google_play', reference: tokenHash },
        select: { id: true, userId: true, status: true },
      });
      if (already) {
        if (already.userId !== req.user.id) throw new AppError('تم استخدام عملية الشراء لحساب آخر.', 409, 'PURCHASE_ALREADY_CLAIMED');
        return { ...already, alreadyProcessed: true };
      }
      const row = await tx.purchase.create({ data: {
        userId: req.user.id,
        packageId: pkg.id,
        pointsGiven: points,
        priceCents: pkg.priceCents,
        currency: pkg.currency,
        method: 'google_play',
        reference: tokenHash,
        status: 'APPROVED',
        approvedAt: new Date(),
        notes: JSON.stringify({ provider: 'Google Play', orderId, productId }),
      } });
      await adjustPoints(req.user.id, points, 'PURCHASE', {
        refType: 'Purchase', refId: row.id, note: `Google Play purchase ${orderId || productId}`,
      }, tx);
      return row;
    });
    if (purchase.alreadyProcessed) {
      return res.json({ success: true, alreadyProcessed: true, purchaseId: purchase.id, status: purchase.status });
    }
    // Acknowledge only after the purchase has been verified and granted.
    const ackUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
    await fetch(ackUrl, { method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) }).catch(() => null);
    res.status(201).json({ success: true, purchaseId: purchase.id, status: purchase.status, pointsAdded: points.toString() });
  } catch (error) {
    // A simultaneous duplicate may race the first lookup. Never award twice.
    const raced = await prisma.purchase.findFirst({ where: { method: 'google_play', reference: tokenHash } });
    if (raced) {
      if (raced.userId !== req.user.id) throw new AppError('تم استخدام عملية الشراء لحساب آخر.', 409, 'PURCHASE_ALREADY_CLAIMED');
      return res.json({ success: true, alreadyProcessed: true, purchaseId: raced.id, status: raced.status });
    }
    throw error;
  }
});


const verifyVipSubscription = asyncHandler(async (req, res) => {
  const productId = String(req.body.productId || '').trim();
  const planKey = String(req.body.planKey || '').trim();
  const purchaseToken = String(req.body.purchaseToken || '').trim();
  if (!productId || !planKey || !purchaseToken || purchaseToken.length > 5000) throw new AppError('بيانات اشتراك VIP ناقصة.', 400, 'VIP_PURCHASE_DATA_REQUIRED');
  const settings = await getSettings();
  const plan = (settings.vipPro?.plans || []).find(p => p.key === planKey && p.enabled !== false);
  if (!plan || String(plan.productId || plan.key) !== productId) throw new AppError('معرّف منتج Google Play لا يطابق خطة VIP.', 400, 'VIP_PRODUCT_MISMATCH');
  const tokenHash = crypto.createHash('sha256').update(purchaseToken).digest('hex');
  const existing = await prisma.vipSubscription.findFirst({ where: { method: 'google_play', reference: tokenHash } });
  if (existing) {
    if (existing.userId !== req.user.id) throw new AppError('تم استخدام هذا الاشتراك لحساب آخر.', 409, 'VIP_PURCHASE_ALREADY_CLAIMED');
    if (existing.status === 'ACTIVE' && existing.expiresAt > new Date()) return res.json({ success: true, alreadyProcessed: true, expiresAt: existing.expiresAt });
  }
  const accessToken = await publisherAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) });
  const receipt = await response.json().catch(() => ({}));
  if (!response.ok) throw new AppError('تعذر التحقق من اشتراك Google Play.', 400, 'VIP_PURCHASE_NOT_VERIFIED');
  const lineItems = Array.isArray(receipt.lineItems) ? receipt.lineItems : [];
  const item = lineItems.find(x => x.productId === productId);
  const expiry = item?.expiryTime ? new Date(item.expiryTime) : null;
  const allowedStates = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'];
  if (!item || !expiry || Number.isNaN(expiry.getTime()) || expiry <= new Date() || !allowedStates.includes(receipt.subscriptionState)) {
    throw new AppError('اشتراك Google Play غير نشط أو منتهي. لم يتم تفعيل VIP.', 400, 'VIP_SUBSCRIPTION_INACTIVE');
  }
  const start = new Date();
  const subscription = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tokenHash}))`;
    const raced = await tx.vipSubscription.findFirst({ where: { method: 'google_play', reference: tokenHash } });
    if (raced) {
      if (raced.userId !== req.user.id) throw new AppError('تم استخدام هذا الاشتراك لحساب آخر.', 409, 'VIP_PURCHASE_ALREADY_CLAIMED');
      const updated = await tx.vipSubscription.update({ where: { id: raced.id }, data: { status: 'ACTIVE', startsAt: raced.startsAt || start, expiresAt: expiry, notes: JSON.stringify({ productId, orderId: receipt.latestOrderId || null, subscriptionState: receipt.subscriptionState }) } });
      await tx.user.update({ where: { id: req.user.id }, data: { vipProUntil: expiry } });
      return updated;
    }
    const row = await tx.vipSubscription.create({ data: {
      userId: req.user.id, priceCents: Number(plan.priceCents || 0), currency: settings.vipPro?.currency || 'USD',
      status: 'ACTIVE', method: 'google_play', reference: tokenHash, planKey: plan.key,
      startsAt: start, expiresAt: expiry, notes: JSON.stringify({ productId, orderId: receipt.latestOrderId || null, subscriptionState: receipt.subscriptionState }),
    }});
    await tx.user.update({ where: { id: req.user.id }, data: { vipProUntil: expiry } });
    return row;
  });
  // Acknowledge the subscription after server verification and entitlement grant.
  const ackUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  await fetch(ackUrl, { method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) }).catch(() => null);
  await notify(req.user.id, 'تم تفعيل VIP PRO 👑', `تم التحقق من اشتراك Google Play حتى ${expiry.toISOString().slice(0,10)}.`, 'success');
  res.status(201).json({ success: true, subscriptionId: subscription.id, expiresAt: expiry });
});

module.exports = { verifyProduct, verifyVipSubscription };
