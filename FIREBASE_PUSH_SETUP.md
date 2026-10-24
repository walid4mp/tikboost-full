# TokAura Push Notifications

TokAura now supports Firebase Cloud Messaging (FCM) so admin notifications can appear in the Android notification tray even when the app is in the background or fully closed.

## Android
The project includes the Firebase Android configuration for package `com.tikboost.app`, `firebase_core`, and `firebase_messaging`. Android 13+ notification permission is requested on first launch.

## Render / backend secret (required for server push)
The `google-services.json` file is a client configuration and **does not contain a server private key**. To let the admin panel send push notifications, create a Firebase service-account JSON in Firebase/Google Cloud and add it to Render as:

`FIREBASE_SERVICE_ACCOUNT_JSON` = the complete service-account JSON on one line.

Also set:

`FIREBASE_PROJECT_ID=tikboost-df79c`

Never commit the service-account JSON or its private key to GitHub.

## Admin
The existing admin endpoint `/api/admin/notifications/send` now sends both:
- the in-app notification stored in PostgreSQL;
- an FCM push notification to registered Android devices.

This works for `ALL`, `SELECTED`, and `VIP_PRO` audiences.
