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

  static const String _fallbackBannerAdUnitId =
      'ca-app-pub-3940256099942544/6300978111';
  static const String _fallbackNativeAdUnitId =
      'ca-app-pub-3940256099942544/2247696110';
  static const String _fallbackRewardedAdUnitId =
      'ca-app-pub-3940256099942544/5224354917';
  static const String _fallbackInterstitialAdUnitId =
      'ca-app-pub-3940256099942544/1033173712';

  Map<String, dynamic> _adsConfig = const <String, dynamic>{};
  bool _adsSuppressed = false;

  bool get bannerEnabled => !_adsSuppressed && _boolValue('bannerEnabled', true);
  bool get nativeEnabled => !_adsSuppressed && _boolValue('nativeEnabled', true);
  bool get rewardedEnabled => !_adsSuppressed && _boolValue('rewardedEnabled', true);
  bool get interstitialEnabled => !_adsSuppressed && _boolValue('interstitialEnabled', true);
  bool get autoInterstitialEnabled => !_adsSuppressed && _boolValue('autoInterstitialEnabled', true);
  int get interstitialIntervalMinutes => _intValue('interstitialIntervalMinutes', 20);
  bool get customBannerEnabled => !_adsSuppressed && _boolValue('customBannerEnabled', false);
  String get customBannerImageUrl => _stringValue('customBannerImageUrl', '');
  String get customBannerLinkUrl => _stringValue('customBannerLinkUrl', '');
  String get customBannerLabel => _stringValue('customBannerLabel', 'إعلان');
  bool get adsSuppressed => _adsSuppressed;

  Future<void> recordAdEvent(String type, {String event = 'VIEW'}) async {
    try { await ApiClient.instance.dio.post('/user/ad-events', data: {'type': type, 'event': event}); } catch (_) {}
  }

  String get bannerAdUnitId => _stringValue('bannerUnitId', _fallbackBannerAdUnitId);
  String get nativeAdUnitId => _stringValue('nativeUnitId', _fallbackNativeAdUnitId);
  String get rewardedAdUnitId => _stringValue('rewardedUnitId', _fallbackRewardedAdUnitId);
  String get interstitialAdUnitId =>
      _stringValue('interstitialUnitId', _fallbackInterstitialAdUnitId);

  Future<InitializationStatus> initialize() async {
    await _loadRemoteConfig();
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
    } catch (_) {
      // Keep the public config if the authenticated policy request fails.
    }
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

  Future<bool> showRewardedAd() async {
    if (!rewardedEnabled) return false;
    final completer = Completer<bool>();
    RewardedAd.load(
      adUnitId: rewardedAdUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) {
          recordAdEvent('REWARDED');
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
          ad.show(
            onUserEarnedReward: (_, __) {
              rewarded = true;
              recordAdEvent('REWARDED', event: 'COMPLETED');
            },
          );
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
