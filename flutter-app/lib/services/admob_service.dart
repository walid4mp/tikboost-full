import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/app_config.dart';
import 'api_client.dart';

class AdMobService {
  AdMobService._();
  static final AdMobService instance = AdMobService._();

  // Production AdMob units created for tikboost.wh. In Release builds these
  // IDs are authoritative; remote admin config may toggle formats but cannot
  // accidentally replace production inventory with Google's sample IDs.
  static const String _productionBannerAdUnitId =
      'ca-app-pub-5844737250635220/5064241834';
  static const String _productionNativeAdUnitId =
      'ca-app-pub-5844737250635220/3998572171';
  // No standard Rewarded unit was created in AdMob. The app's reward flow
  // uses the two real Rewarded Interstitial units below instead.
  static const String _productionInterstitialAdUnitId =
      'ca-app-pub-5844737250635220/1209803484';
  static const String _productionRewardedInterstitialAdUnitId =
      'ca-app-pub-5844737250635220/3250090571';
  static const String _productionRewardedInterstitialAdUnitIdSecondary =
      'ca-app-pub-5844737250635220/5688551653';
  static const String _productionAppOpenAdUnitId =
      'ca-app-pub-5844737250635220/9850710830';

  Map<String, dynamic> _adsConfig = const <String, dynamic>{};
  bool _adsSuppressed = false;

  bool get adsEnabled => !_adsSuppressed && _boolValue('adsEnabled', true);
  bool get bannerEnabled => adsEnabled && _boolValue('bannerEnabled', true);
  bool get nativeEnabled => adsEnabled && _boolValue('nativeEnabled', true);
  bool get rewardedEnabled => adsEnabled && _boolValue('rewardedEnabled', true);
  bool get interstitialEnabled => adsEnabled && _boolValue('interstitialEnabled', true);
  bool get autoInterstitialEnabled => adsEnabled && _boolValue('autoInterstitialEnabled', true);
  bool get rewardedInterstitialEnabled => adsEnabled && _boolValue('rewardedInterstitialEnabled', true);
  bool get appOpenEnabled => adsEnabled && _boolValue('appOpenEnabled', true);
  int get interstitialIntervalMinutes => _intValue('interstitialIntervalMinutes', 20);
  int get appOpenMinIntervalMinutes => _intValue('appOpenMinIntervalMinutes', 60);
  bool get customBannerEnabled => adsEnabled && _boolValue('customBannerEnabled', false);
  String get customBannerImageUrl => _stringValue('customBannerImageUrl', '');
  String get customBannerLinkUrl {
    final value = _stringValue('customBannerLinkUrl', '');
    final uri = Uri.tryParse(value);
    return uri != null && (uri.scheme == 'http' || uri.scheme == 'https') ? value : '';
  }
  String get customBannerLabel => _stringValue('customBannerLabel', 'إعلان');
  bool get adsSuppressed => _adsSuppressed;

  Future<void> recordAdEvent(String type, {String event = 'VIEW'}) async {
    try { await ApiClient.instance.dio.post('/user/ad-events', data: {'type': type, 'event': event}); } catch (_) {}
  }

  // Debug always uses Google's sample inventory. Release always uses the
  // publisher's real units, even if an old server setting contains a test ID.
  String get bannerAdUnitId => kDebugMode
      ? 'ca-app-pub-3940256099942544/6300978111'
      : _productionBannerAdUnitId;
  String get nativeAdUnitId => kDebugMode
      ? 'ca-app-pub-3940256099942544/2247696110'
      : _productionNativeAdUnitId;
  // No standard Rewarded unit was created. Reward flows use Rewarded
  // Interstitial, so never load a standard Rewarded test unit in production.
  String get rewardedAdUnitId => '';
  String get interstitialAdUnitId => kDebugMode
      ? 'ca-app-pub-3940256099942544/1033173712'
      : _productionInterstitialAdUnitId;
  String get rewardedInterstitialAdUnitId => kDebugMode
      ? 'ca-app-pub-3940256099942544/5354046379'
      : _productionRewardedInterstitialAdUnitId;
  String get rewardedInterstitialAdUnitIdSecondary => kDebugMode
      ? 'ca-app-pub-3940256099942544/5354046379'
      : _productionRewardedInterstitialAdUnitIdSecondary;
  String get appOpenAdUnitId => kDebugMode
      ? 'ca-app-pub-3940256099942544/9257395921'
      : _productionAppOpenAdUnitId;

  Future<InitializationStatus> initialize() async {
    await _loadRemoteConfig();
    _applyDebugTestIds();
    return MobileAds.instance.initialize();
  }

  Future<void> loadUserAdConfig() async {
    try {
      final dio = Dio(BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        contentType: 'application/json',
        headers: const {'Content-Type': 'application/json'},
        extra: const {'withCredentials': true},
      ));
      final token = await _readAccessToken();
      if (token == null || token.isEmpty) return;
      final response = await dio.get('/user/ad-config', options: Options(headers: {'Authorization': 'Bearer $token'}));
      _adsConfig = Map<String, dynamic>.from(response.data['ads'] ?? _adsConfig);
      _adsSuppressed = response.data['adsSuppressed'] == true;
      _applyDebugTestIds();
    } catch (_) {
      // Keep the public config if the authenticated policy request fails.
    }
  }


  void _applyDebugTestIds() {
    if (!kDebugMode) return;
    _adsConfig = {
      ..._adsConfig,
      'bannerUnitId': 'ca-app-pub-3940256099942544/6300978111',
      'interstitialUnitId': 'ca-app-pub-3940256099942544/1033173712',
      'rewardedUnitId': 'ca-app-pub-3940256099942544/5224354917',
      'nativeUnitId': 'ca-app-pub-3940256099942544/2247696110',
      'rewardedInterstitialUnitId': 'ca-app-pub-3940256099942544/5354046379',
      'rewardedInterstitialUnitIdSecondary': 'ca-app-pub-3940256099942544/5354046379',
      'appOpenUnitId': 'ca-app-pub-3940256099942544/9257395921',
    };
  }

  Future<String?> _readAccessToken() async {
    // Avoid coupling this service to Riverpod; read the same secure storage key used by ApiClient.
    const storage = FlutterSecureStorage();
    return storage.read(key: 'accessToken');
  }

  Future<void> _loadRemoteConfig() async {
    try {
      final dio = Dio(BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        contentType: 'application/json',
        headers: const {'Content-Type': 'application/json'},
        extra: const {'withCredentials': true},
      ));
      final response = await dio.get('/config/client');
      final config = Map<String, dynamic>.from(response.data['config'] ?? const {});
      _adsConfig = Map<String, dynamic>.from(config['ads'] ?? const {});
    } catch (_) {
      _adsConfig = const <String, dynamic>{};
    }
  }

  BannerAd createBannerAd({
    VoidCallback? onLoaded,
    void Function(LoadAdError error)? onFailed,
  }) {
    return BannerAd(
      adUnitId: bannerAdUnitId,
      size: AdSize.banner,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (_) { recordAdEvent('BANNER'); onLoaded?.call(); },
        onAdFailedToLoad: (ad, error) {
          ad.dispose();
          onFailed?.call(error);
        },
      ),
    );
  }

  NativeAd createNativeAd({
    VoidCallback? onLoaded,
    void Function(LoadAdError error)? onFailed,
  }) {
    return NativeAd(
      adUnitId: nativeAdUnitId,
      factoryId: 'listTile',
      request: const AdRequest(),
      listener: NativeAdListener(
        onAdLoaded: (_) { recordAdEvent('NATIVE'); onLoaded?.call(); },
        onAdFailedToLoad: (ad, error) {
          ad.dispose();
          onFailed?.call(error);
        },
      ),
    );
  }

  Future<bool> showInterstitialAd() async {
    if (!interstitialEnabled) return false;
    final completer = Completer<bool>();
    InterstitialAd.load(
      adUnitId: interstitialAdUnitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          recordAdEvent('INTERSTITIAL');
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdDismissedFullScreenContent: (ad) {
              ad.dispose();
              if (!completer.isCompleted) completer.complete(true);
            },
            onAdFailedToShowFullScreenContent: (ad, _) {
              ad.dispose();
              if (!completer.isCompleted) completer.complete(false);
            },
          );
          ad.show();
        },
        onAdFailedToLoad: (_) {
          if (!completer.isCompleted) completer.complete(false);
        },
      ),
    );
    return completer.future;
  }

  // The account has two Rewarded Interstitial units (not standard Rewarded
  // units). Keep the existing call site compatible while using the correct
  // Google Mobile Ads format.
  Future<bool> showRewardedAd() async {
    if (!rewardedEnabled || !rewardedInterstitialEnabled) return false;
    return showRewardedInterstitialAd();
  }

  Future<bool> showRewardedInterstitialAd({bool useSecondaryUnit = false}) async {
    if (!rewardedInterstitialEnabled) return false;
    final completer = Completer<bool>();
    RewardedInterstitialAd.load(
      adUnitId: useSecondaryUnit ? rewardedInterstitialAdUnitIdSecondary : rewardedInterstitialAdUnitId,
      request: const AdRequest(),
      rewardedInterstitialAdLoadCallback: RewardedInterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          recordAdEvent('REWARDED_INTERSTITIAL');
          var rewarded = false;
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdDismissedFullScreenContent: (ad) {
              ad.dispose();
              if (!completer.isCompleted) completer.complete(rewarded);
            },
            onAdFailedToShowFullScreenContent: (ad, _) {
              ad.dispose();
              if (!completer.isCompleted) completer.complete(false);
            },
          );
          ad.show(onUserEarnedReward: (_, __) {
            rewarded = true;
            recordAdEvent('REWARDED_INTERSTITIAL', event: 'COMPLETED');
          });
        },
        onAdFailedToLoad: (_) {
          if (!completer.isCompleted) completer.complete(false);
        },
      ),
    );
    return completer.future;
  }

  Future<bool> showAppOpenAd() async {
    if (!appOpenEnabled) return false;
    final completer = Completer<bool>();
    AppOpenAd.load(
      adUnitId: appOpenAdUnitId,
      request: const AdRequest(),
      adLoadCallback: AppOpenAdLoadCallback(
        onAdLoaded: (ad) {
          recordAdEvent('APP_OPEN');
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdDismissedFullScreenContent: (ad) {
              ad.dispose();
              if (!completer.isCompleted) completer.complete(true);
            },
            onAdFailedToShowFullScreenContent: (ad, _) {
              ad.dispose();
              if (!completer.isCompleted) completer.complete(false);
            },
          );
          ad.show();
        },
        onAdFailedToLoad: (_) {
          if (!completer.isCompleted) completer.complete(false);
        },
      ),
    );
    return completer.future;
  }

  bool _boolValue(String key, bool fallback) {
    final value = _adsConfig[key];
    if (value is bool) return value;
    if (value is String) {
      return value.toLowerCase() == 'true' || value == '1';
    }
    return fallback;
  }

  int _intValue(String key, int fallback) {
    final value = _adsConfig[key];
    final parsed = int.tryParse('$value');
    return parsed ?? fallback;
  }

  String _stringValue(String key, String fallback) {
    final value = '${_adsConfig[key] ?? ''}'.trim();
    return value.isEmpty ? fallback : value;
  }
}
