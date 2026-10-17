class AppConfig {
  static String appName = 'TokAura';
  static String tagline = 'اكسب، تفاعل، وخلّي حضورك يلمع.';

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://tikboost-api-v2.onrender.com/api',
  );

  static String socketUrl = const String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: 'https://tikboost-api-v2.onrender.com',
  );

  static bool enableGoogleLogin = const bool.fromEnvironment(
    'ENABLE_GOOGLE_LOGIN',
    defaultValue: false,
  );

  static bool allowLegacyPasswordReset = const bool.fromEnvironment(
    'ALLOW_LEGACY_PASSWORD_RESET',
    defaultValue: false,
  );

  static String whatsapp = '';
  static String instagramUrl = '';
  static String facebookUrl = '';
  static String email = '';
  static String privacyUrl = 'https://tikboost.app/privacy';
  static String termsUrl = 'https://tikboost.app/terms';
  static String downloadUrl = '';
  static String logoUrl = '';
  static String iconUrl = '';
  static String splashImageUrl = '';
  static String primaryColor = '#FF3B5C';
  static String secondaryColor = '#2D7BFF';

  static Map<String, dynamic> rewards = <String, dynamic>{};
  static Map<String, dynamic> wheel = <String, dynamic>{};
  static Map<String, dynamic> chest = <String, dynamic>{};
  static Map<String, dynamic> notifications = <String, dynamic>{};
  static Map<String, int> campaignPricing = {
    'FOLLOWERS': 100,
    'LIKES': 20,
    'VIEWS': 5,
    'COMMENTS': 50,
  };
  static Map<String, int> campaignRewards = {
    'FOLLOWERS': 80,
    'LIKES': 16,
    'VIEWS': 4,
    'COMMENTS': 40,
  };
  static int minCampaignQuantity = 10;
  static int maxCampaignQuantity = 100000;

  static List<Map<String, dynamic>> paymentMethods = <Map<String, dynamic>>[];
  static List<Map<String, dynamic>> contactLinks = <Map<String, dynamic>>[];
  static List<Map<String, dynamic>> levelDefinitions = <Map<String, dynamic>>[];

  static String get whatsappDisplayValue {
    final raw = whatsapp.trim();
    if (raw.isEmpty) return '';
    final matched = RegExp(r'wa\.me\/(\d+)', caseSensitive: false).firstMatch(raw);
    if (matched != null) return matched.group(1) ?? raw;
    final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    return digits.isEmpty ? raw : digits;
  }

  static String get whatsappChatUrl {
    final raw = whatsapp.trim();
    if (raw.isEmpty) return '';
    if (raw.startsWith('https://') || raw.startsWith('http://')) return raw;
    if (raw.startsWith('wa.me/')) return 'https://$raw';
    final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    return digits.isEmpty ? '' : 'https://wa.me/$digits';
  }

  static String get supportMailTo => email.trim().isEmpty ? '' : 'mailto:${email.trim()}';

  static String whatsappUrlWithText(String message) {
    final base = whatsappChatUrl;
    if (base.isEmpty) return '';
    final uri = Uri.tryParse(base);
    if (uri == null) return '';
    final nextParams = Map<String, String>.from(uri.queryParameters);
    nextParams['text'] = message;
    return uri.replace(queryParameters: nextParams).toString();
  }

  static int priceForCampaign(String type) => campaignPricing[type] ?? 0;
  static int rewardForCampaign(String type) => campaignRewards[type] ?? 0;

  static List<Map<String, dynamic>> get enabledPaymentMethods =>
      paymentMethods.where((item) => item['enabled'] == true).toList();

  static List<Map<String, dynamic>> get enabledContactLinks =>
      contactLinks.where((item) => item['enabled'] == true).toList();

  static List<Map<String, dynamic>> buildFallbackContactLinks() =>
      <Map<String, dynamic>>[
        if (whatsappDisplayValue.isNotEmpty)
          {
            'key': 'whatsapp',
            'label': 'WhatsApp',
            'value': whatsappDisplayValue,
            'enabled': true,
          },
        if (instagramUrl.trim().isNotEmpty)
          {
            'key': 'instagram',
            'label': 'Instagram',
            'value': instagramUrl.trim(),
            'enabled': true,
          },
        if (facebookUrl.trim().isNotEmpty)
          {
            'key': 'facebook',
            'label': 'Facebook',
            'value': facebookUrl.trim(),
            'enabled': true,
          },
        if (email.trim().isNotEmpty)
          {
            'key': 'email',
            'label': 'Email',
            'value': email.trim(),
            'enabled': true,
          },
      ];

  static void applyClientConfig(Map<String, dynamic>? config) {
    if (config == null) return;

    final app = _map(config['app']);
    final features = _map(config['features']);
    final pricing = _map(config['campaignPricing']);
    final rewardMap = _map(config['campaignRewards']);
    final campaignRules = _map(config['campaignRules']);
    final payments = _map(config['payments']);
    final levels = _map(config['levels']);

    appName = _text(app['name'], appName);
    tagline = _text(app['tagline'], tagline);
    email = _text(app['supportEmail'], email);
    whatsapp = _text(app['whatsapp'], whatsapp);
    instagramUrl = _text(app['instagramUrl'], instagramUrl);
    facebookUrl = _text(app['facebookUrl'], facebookUrl);
    privacyUrl = _text(app['privacyUrl'], privacyUrl);
    termsUrl = _text(app['termsUrl'], termsUrl);
    downloadUrl = _text(app['downloadUrl'], downloadUrl);
    logoUrl = _text(app['logoUrl'], logoUrl);
    iconUrl = _text(app['iconUrl'], iconUrl);
    splashImageUrl = _text(app['splashImageUrl'], splashImageUrl);
    primaryColor = _text(app['primaryColor'], primaryColor);
    secondaryColor = _text(app['secondaryColor'], secondaryColor);
    socketUrl = _text(app['socketUrl'], socketUrl);

    enableGoogleLogin = _bool(features['enableGoogleLogin'], enableGoogleLogin);
    allowLegacyPasswordReset =
        _bool(features['allowLegacyPasswordReset'], allowLegacyPasswordReset);

    rewards = _map(config['rewards']);
    wheel = _map(config['wheel']);
    chest = _map(config['chest']);
    notifications = _map(config['notifications']);

    campaignPricing = {
      'FOLLOWERS': _int(pricing['FOLLOWERS'], campaignPricing['FOLLOWERS'] ?? 100),
      'LIKES': _int(pricing['LIKES'], campaignPricing['LIKES'] ?? 20),
      'VIEWS': _int(pricing['VIEWS'], campaignPricing['VIEWS'] ?? 5),
      'COMMENTS': _int(pricing['COMMENTS'], campaignPricing['COMMENTS'] ?? 50),
    };
    campaignRewards = {
      'FOLLOWERS': _int(rewardMap['FOLLOWERS'], campaignRewards['FOLLOWERS'] ?? 80),
      'LIKES': _int(rewardMap['LIKES'], campaignRewards['LIKES'] ?? 16),
      'VIEWS': _int(rewardMap['VIEWS'], campaignRewards['VIEWS'] ?? 4),
      'COMMENTS': _int(rewardMap['COMMENTS'], campaignRewards['COMMENTS'] ?? 40),
    };
    minCampaignQuantity = _int(campaignRules['minQuantity'], minCampaignQuantity);
    maxCampaignQuantity = _int(campaignRules['maxQuantity'], maxCampaignQuantity);

    final methods = payments['methods'];
    if (methods is List) {
      paymentMethods = methods
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }

    final links = app['contactLinks'];
    if (links is List) {
      contactLinks = links
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
      if (contactLinks.isEmpty) contactLinks = buildFallbackContactLinks();
    } else {
      contactLinks = buildFallbackContactLinks();
    }

    final definitions = levels['definitions'];
    if (definitions is List) {
      levelDefinitions = definitions
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
  }

  static Map<String, dynamic> _map(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return const <String, dynamic>{};
  }

  static String _text(dynamic value, String fallback) {
    final text = (value ?? '').toString().trim();
    return text.isEmpty ? fallback : text;
  }

  static bool _bool(dynamic value, bool fallback) {
    if (value is bool) return value;
    if (value == 'true' || value == '1' || value == 1) return true;
    if (value == 'false' || value == '0' || value == 0) return false;
    return fallback;
  }

  static int _int(dynamic value, int fallback) {
    return int.tryParse('${value ?? ''}') ?? fallback;
  }
}
