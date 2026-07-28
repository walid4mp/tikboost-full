class AppConfig {
  static const String appName = 'TikBoost';
  static const String tagline = 'اكسب النقاط وروج لحسابك بسهولة.';

  // رابط الـ API النهائي
  static const String apiBaseUrl =
      'https://tikboost-api-v2.onrender.com/api';

  // رابط Socket.IO
  static const String socketUrl =
      'https://tikboost-api-v2.onrender.com';

  static const bool enableGoogleLogin = false;
  static const bool allowLegacyPasswordReset = false;

  static const String whatsapp = '+213559658947';
  static const String email = 'walid300105@gmail.com';

  static String get whatsappChatUrl =>
      'https://wa.me/${whatsapp.replaceAll(RegExp(r'[^0-9]'), '')}';

  static String get supportMailTo => 'mailto:$email';
}
