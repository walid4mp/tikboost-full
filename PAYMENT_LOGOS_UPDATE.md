# Payment logos update

The Flutter payment selector in `flutter-app/lib/screens/shop_screen.dart` now prefers real brand artwork for payment methods instead of the previous colored placeholder-style logos.

Supported remote artwork keys:
- BaridiMob
- Binance Pay
- PayPal
- USDT / Tether
- RedotPay

The original bundled PNG files remain as offline/error fallbacks, so the selector still renders if an image host is unavailable.

The payment cards were also enlarged slightly and use `BoxFit.contain` so the brand artwork is not cropped.
