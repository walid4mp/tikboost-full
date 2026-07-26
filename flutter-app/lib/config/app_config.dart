class AppConfig {
  static const String appName = 'TikBoost';
  static const String tagline = 'اكسب النقاط وروج لحسابك بسهولة.';

  // Compile-time production overrides for CI / release builds.
  // Example:
  // flutter build apk --release \
  //   --dart-define=API_BASE_URL=https://your-render-service.onrender.com/api \
  //   --dart-define=SOCKET_URL=https://your-render-service.onrender.com
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/api',
  );
  static const String socketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: 'http://10.0.2.2:4000',
  );

  // Contact
  static const String whatsapp = '+966559658947';
  static const String email = 'walid300105@gmail.com';
}
