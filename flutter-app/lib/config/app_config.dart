class AppConfig {
  static const String appName = 'TikBoost';
  static const String tagline = 'اكسب النقاط وروج لحسابك بسهولة.';

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://tikboost-api-v2.onrender.com/api',
  );

  static const String socketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: 'https://tikboost-api-v2.onrender.com',
  );

  static const bool enableGoogleLogin = bool.fromEnvironment(
    'ENABLE_GOOGLE_LOGIN',
    defaultValue: false,
  );

  static const bool allowLegacyPasswordReset = bool.fromEnvironment(
    'ALLOW_LEGACY_PASSWORD_RESET',
    defaultValue: false,
  );

  static const String whatsapp = '+213559658947';
  static const String email = 'walid300105@gmail.com';

  static String get whatsappChatUrl =>
      'https://wa.me/${whatsapp.replaceAll(RegExp(r'[^0-9]'), '')}';

  static String get supportMailTo => 'mailto:$email';
}
