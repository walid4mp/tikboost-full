const prisma = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { asyncHandler } = require('../utils/helpers');
const { adjustPoints } = require('../services/points.service');
const { notify } = require('../services/notifications.service');
const paypal = require('../services/paypal.service');

async function creditPurchase(purchase, providerData = {}) {
  const claimed = await prisma.purchase.updateMany({
    where: { id: purchase.id, status: 'PENDING' },
    data: { status: 'APPROVED', approvedAt: new Date(), notes: JSON.stringify({ ...(safeNotes(purchase.notes)), paypal: providerData }) },
  });
  if (claimed.count !== 1) {
    const current = await prisma.purchase.findUnique({ where: { id: purchase.id } });
    return { alreadyProcessed: true, purchase: current };
  }
  await adjustPoints(purchase.userId, purchase.pointsGiven, 'PURCHASE', { refType: 'Purchase', refId: purchase.id, note: 'PayPal Checkout purchase' });
  await notify(purchase.userId, '✅ تم الدفع بنجاح', `تم إضافة ${purchase.pointsGiven} نقطة إلى حسابك.`, 'success');
  return { alreadyProcessed: false, purchase: await prisma.purchase.findUnique({ where: { id: purchase.id } }) };
}

function safeNotes(notes) { try { return notes ? JSON.parse(notes) : {}; } catch (_) { return {}; } }

const create = asyncHandler(async (req, res) => {
  const { packageId } = req.body || {};
  const settings = await require('../services/appSettings.service').getSettings();
  const configuredMethod = (settings.payments?.methods || []).find((m) => String(m.key || '').toLowerCase() === 'paypal');
  if (configuredMethod && configuredMethod.enabled === false) throw new AppError('PayPal غير مفعل حاليًا من لوحة الإدارة.', 400, 'PAYPAL_DISABLED');
  const pkg = await prisma.pointPackage.findUnique({ where: { id: String(packageId || '') } });
  if (!pkg || !pkg.isActive) throw new AppError('Package not available', 404);
  if (String(pkg.currency).toUpperCase() !== 'USD') throw new AppError('الدفع عبر PayPal متاح حاليًا للباقات التي عملتها USD فقط. غيّر عملة الباقة إلى USD من لوحة الإدارة.', 400, 'PAYPAL_CURRENCY_UNSUPPORTED');
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) throw new AppError('PayPal غير مهيأ في الخادم.', 503, 'PAYPAL_NOT_CONFIGURED');

  const points = BigInt(pkg.points) + BigInt(pkg.bonusPoints);
  const purchase = await prisma.purchase.create({ data: {
    userId: req.user.id, packageId: pkg.id, pointsGiven: points, priceCents: pkg.priceCents, currency: pkg.currency,
    method: 'paypal', status: 'PENDING', notes: JSON.stringify({ paymentMethod: { key: 'paypal', label: 'PayPal / Visa / Mastercard', type: 'paypal' }, checkout: 'paypal' }),
  }});
  try {
    const order = await paypal.createOrder({ purchaseId: purchase.id, amount: pkg.priceCents / 100, currency: pkg.currency, description: `${pkg.name} - ${points.toString()} Coins` });
    const approval = paypal.approvalUrl(order);
    if (!approval) throw new Error('لم يعُد PayPal رابط الدفع.');
    await prisma.purchase.update({ where: { id: purchase.id }, data: { reference: order.id, notes: JSON.stringify({ paymentMethod: { key: 'paypal', label: 'PayPal / Visa / Mastercard', type: 'paypal' }, checkout: 'paypal', paypalOrderId: order.id }) } });
    res.status(201).json({ success: true, orderId: order.id, approvalUrl: approval, purchaseId: purchase.id, status: 'PENDING' });
  } catch (e) {
    await prisma.purchase.update({ where: { id: purchase.id }, data: { status: 'REJECTED', notes: JSON.stringify({ error: e.message, checkout: 'paypal' }) } }).catch(() => {});
    throw new AppError(e.message || 'تعذر إنشاء طلب PayPal.', 502, 'PAYPAL_CREATE_FAILED');
  }
});

const capture = asyncHandler(async (req, res) => {
  const orderId = String(req.body?.orderId || '').trim();
  if (!orderId) throw new AppError('orderId مطلوب.', 400);
  const purchase = await prisma.purchase.findFirst({ where: { reference: orderId, userId: req.user.id }, include: { package: true } });
  if (!purchase) throw new AppError('عملية PayPal غير موجودة.', 404);
  if (purchase.status === 'APPROVED') return res.json({ success: true, status: 'APPROVED', purchaseId: purchase.id, alreadyProcessed: true });
  if (purchase.method !== 'paypal') throw new AppError('طريقة الدفع غير صحيحة.', 400);

  let data;
  try { data = await paypal.captureOrder(orderId); } catch (e) {
    if (e.paypal?.name === 'UNPROCESSABLE_ENTITY') {
      const current = await paypal.getOrder(orderId).catch(() => null);
      if (current?.status === 'COMPLETED') data = current;
      else throw new AppError(e.message, 400, 'PAYPAL_CAPTURE_FAILED');
    } else throw new AppError(e.message, 502, 'PAYPAL_CAPTURE_FAILED');
  }
  if (data.status !== 'COMPLETED') throw new AppError('لم يتم تأكيد الدفع من PayPal بعد.', 400, 'PAYPAL_NOT_COMPLETED');
  const result = await creditPurchase(purchase, { orderId, status: data.status, captureId: data.purchase_units?.[0]?.payments?.captures?.[0]?.id || null });
  res.json({ success: true, status: 'APPROVED', purchaseId: result.purchase.id, alreadyProcessed: result.alreadyProcessed });
});

const webhook = asyncHandler(async (req, res) => {
  const event = req.body;
  const valid = await paypal.verifyWebhookSignature({ headers: req.headers, event });
  if (!valid) return res.status(400).json({ success: false, error: 'Invalid PayPal webhook signature' });
  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' || event.event_type === 'CHECKOUT.ORDER.COMPLETED') {
    const orderId = event.resource?.supplementary_data?.related_ids?.order_id || event.resource?.id;
    if (orderId) {
      const purchase = await prisma.purchase.findFirst({ where: { reference: orderId, method: 'paypal' } });
      if (purchase && purchase.status === 'PENDING') await creditPurchase(purchase, { orderId, eventType: event.event_type, webhook: true });
    }
  }
  res.json({ received: true });
});

const returnUrl = (_req, res) => res.status(200).send('<!doctype html><meta name="viewport" content="width=device-width"><h2>تم الرجوع من PayPal</h2><p>ارجع إلى تطبيق TikBoost واضغط «تأكيد الدفع» لإتمام إضافة الرصيد.</p>');
const cancelUrl = (_req, res) => res.status(200).send('<!doctype html><meta name="viewport" content="width=device-width"><h2>تم إلغاء الدفع</h2><p>يمكنك العودة إلى التطبيق والمحاولة مرة أخرى.</p>');
module.exports = { create, capture, webhook, returnUrl, cancelUrl };
