# TikBoost localization

The Android app now supports Arabic (`ar`), French (`fr`) and English (`en`).

- The selected language is stored in `SharedPreferences` under `lang`.
- Arabic uses RTL layout; French and English use LTR layout.
- Language can be changed from **Settings → Change language** without reinstalling the app.
- The localization infrastructure lives in `lib/config/app_localizations.dart`.
- Add future UI strings to the localization dictionary instead of hard-coding user-facing text.
