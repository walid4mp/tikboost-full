# TikBoost — PayPal Checkout

هذا الإصدار يستبدل الدفع اليدوي لـ PayPal في شراء الباقات بتدفق PayPal Checkout. المستخدم لا يطلب منه رقم معاملة أو صورة إثبات عند اختيار PayPal.

## Render Environment Variables

أضف في Backend:

```env
PAYPAL_CLIENT_ID=YOUR_LIVE_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_LIVE_SECRET
PAYPAL_MODE=live
PAYPAL_WEBHOOK_ID=YOUR_WEBHOOK_ID
PAYPAL_RETURN_URL=https://YOUR-BACKEND-DOMAIN/api/payments/paypal/return
PAYPAL_CANCEL_URL=https://YOUR-BACKEND-DOMAIN/api/payments/paypal/cancel
```

لا تضع `PAYPAL_CLIENT_SECRET` داخل Flutter أو GitHub.

## Admin

فعّل طريقة الدفع التي مفتاحها `paypal` من Admin → طرق الدفع. في التطبيق ستظهر كـ **PayPal / Visa / Mastercard**.

## Currency

PayPal Checkout في هذا الإصدار يطلب أن تكون الباقة بعملة `USD`. إذا كانت الباقة DZD، غيّر عملتها إلى USD من إدارة الباقات أو استخدم طريقة دفع محلية.

## Flow

1. Flutter يطلب `/api/payments/paypal/create`.
2. Backend ينشئ Purchase بحالة `PENDING` ثم PayPal Order.
3. Flutter يفتح رابط PayPal Checkout الخارجي.
4. المستخدم يدفع عبر PayPal أو خيار البطاقة الذي يتيحه PayPal لحساب التاجر.
5. يعود المستخدم للتطبيق ويضغط «لقد دفعت».
6. Flutter يطلب `/api/payments/paypal/capture`.
7. Backend يتحقق من PayPal، ثم يحوّل Purchase إلى `APPROVED` ويضيف Coins مرة واحدة فقط.
8. Webhook اختياري/احتياطي يؤكد `PAYMENT.CAPTURE.COMPLETED` عند ضبط `PAYPAL_WEBHOOK_ID`.

> لا تخزن أرقام البطاقات أو CVV في TikBoost.
