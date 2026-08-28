# TokAura / TikBoost Payment System

## Payment methods

The admin panel now controls these methods from **Settings → Payment Methods**:

- BaridiMob — DZD
- Binance Pay — USD / configured currency
- RedotPay — USD / configured currency
- PayPal — USD / configured currency
- USDT TRC20 — USDT, network TRC20
- Manual Transfer

Each method supports:

- enable/disable
- payment identifier/address/email
- account name
- external payment URL
- currency
- network
- minimum / maximum amount
- fee percentage
- display order
- user-facing instructions
- icon

## Purchase flow

1. User selects a points package, VIP plan, or personal offer.
2. The app displays enabled payment methods from the server.
3. User sees the configured payment address/instructions.
4. User submits the transaction ID and payment receipt image.
5. Backend creates a `PENDING` purchase.
6. Admin sees the payment in **Payments**, including the method, transaction ID and receipt.
7. Admin can approve or reject the payment.
8. Approval credits the configured points/VIP entitlement.

## Personal offers

Personal offers created from the admin panel are now purchasable through the same payment proof flow. The offer purchase is visible in the admin Payments list and keeps the offer title and payment-method snapshot with the order.

## Important

BaridiMob, Binance Pay, RedotPay and USDT TRC20 are implemented as proof-based/manual transfers because their credentials/API capabilities differ. PayPal is also configurable as a payment method and can use a PayPal payment URL/email. Automatic PayPal capture should only be enabled after configuring official PayPal API credentials and verified webhooks on the server.
