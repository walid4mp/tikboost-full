import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/app_config.dart';

String userFriendlyApiError(Object error, {String fallback = 'حدث خطأ غير متوقع. حاول مرة أخرى.'}) {
  if (error is DioException) {
    final status = error.response?.statusCode;
    final data = error.response?.data;
    final message = data is Map ? '${data['message'] ?? ''}'.trim() : '';
    final code = data is Map ? '${data['code'] ?? ''}'.trim() : '';

    // Known server codes -> translatable Arabic messages (the server sends
    // English text that would otherwise be shown raw to the user).
    switch (code) {
      case 'INVALID_CRED':
        return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      case 'BANNED':
        return 'هذا الحساب محظور. تواصل مع الدعم.';
      case 'FROZEN':
        return 'هذا الحساب مجمّد حالياً. تواصل مع الدعم.';
      case 'DEVICE_ID_USED':
        return 'هذا الجهاز مرتبط بحساب آخر. سجّل الدخول بحسابك أو تواصل مع الدعم.';
    }

    if (status == 409) {
      if (code == 'EMAIL_USED') return 'البريد الإلكتروني مستخدم بالفعل.';
      if (message.isNotEmpty) return message;
      return 'هذه البيانات مستخدمة بالفعل.';
    }

    if (status == 400) {
      if (code == 'INVALID_REFERRAL_CODE') return 'كود الدعوة غير صالح.';
      if (message.isNotEmpty) return message;
      return 'تحقق من البيانات المدخلة وحاول مرة أخرى.';
    }

    if (status == 429) {
      return 'عدد المحاولات كبير. حاول مرة أخرى بعد قليل.';
    }

    if (status == 500) {
      return 'حدث خطأ في الخادم. حاول مرة أخرى.';
    }

    if (message.isNotEmpty) return message;
  }

  return fallback;
}

class ApiClient {
  ApiClient._() {
    dio = Dio(_options());
    _refreshDio = Dio(_options());

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = _accessTokenCache ?? await _safeRead('accessToken');
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          options.extra['retried'] ??= false;
          handler.next(options);
        },
        onError: (error, handler) async {
          final path = error.requestOptions.path;
          final isAuthCall = path == '/auth/refresh' ||
              path == '/auth/login' ||
              path == '/auth/signup' ||
              path == '/auth/google';
          final shouldRefresh = error.response?.statusCode == 401 &&
              !isAuthCall &&
              error.requestOptions.extra['retried'] != true;

          if (!shouldRefresh) {
            handler.next(error);
            return;
          }

          final refreshed = await refreshSession();
          if (!refreshed) {
            // Only drop the session when the server explicitly rejected the
            // refresh token. A network hiccup must never log the user out.
            if (lastRefreshRejected) await expireSession();
            handler.next(error);
            return;
          }

          try {
            final request = error.requestOptions;
            request.extra['retried'] = true;
            if (_accessTokenCache != null && _accessTokenCache!.isNotEmpty) {
              request.headers['Authorization'] = 'Bearer $_accessTokenCache';
            }
            final retry = await dio.fetch(request);
            handler.resolve(retry);
          } on DioException catch (e) {
            handler.next(e);
          } catch (_) {
            handler.next(error);
          }
        },
      ),
    );
  }

  static final ApiClient instance = ApiClient._();

  /// Called when the server rejected our refresh token (real sign-out).
  void Function()? onSessionExpired;

  late final Dio dio;
  late final Dio _refreshDio;
  final storage = const FlutterSecureStorage();
  String? _accessTokenCache;
  String? _refreshTokenCache;
  Future<bool>? _refreshInFlight;

  /// True only when the last refresh attempt was explicitly refused (400/401/
  /// 403). False for timeouts, offline mode and 5xx errors.
  bool lastRefreshRejected = false;

  BaseOptions _options() => BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 25),
        receiveTimeout: const Duration(seconds: 35),
        contentType: 'application/json',
        headers: const {'Content-Type': 'application/json'},
        extra: const {'withCredentials': true},
      );

  Future<String?> _safeRead(String key) async {
    try {
      return await storage.read(key: key);
    } catch (_) {
      return null;
    }
  }

  Future<String?> readAccessToken() async {
    _accessTokenCache ??= await _safeRead('accessToken');
    return _accessTokenCache;
  }

  Future<String?> readRefreshToken() async {
    _refreshTokenCache ??= await _safeRead('refreshToken');
    return _refreshTokenCache;
  }

  Future<void> setTokens(String access, String refresh) async {
    _accessTokenCache = access;
    _refreshTokenCache = refresh;
    dio.options.headers['Authorization'] = 'Bearer $access';
    try {
      await storage.write(key: 'accessToken', value: access);
      await storage.write(key: 'refreshToken', value: refresh);
    } catch (_) {
      // Keep the in-memory session even if the keystore is temporarily busy.
    }
  }

  Future<bool> refreshSession() {
    final existing = _refreshInFlight;
    if (existing != null) return existing;
    final future = _refreshSessionInternal();
    _refreshInFlight = future;
    return future.whenComplete(() {
      if (identical(_refreshInFlight, future)) _refreshInFlight = null;
    });
  }

  Future<bool> _refreshSessionInternal() async {
    final refreshToken = await readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      lastRefreshRejected = true;
      return false;
    }
    try {
      final res = await _refreshDio.post(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
        options: Options(extra: const {'withCredentials': true}),
      );
      final access = '${res.data['accessToken'] ?? ''}'.trim();
      final refresh = '${res.data['refreshToken'] ?? ''}'.trim();
      if (access.isEmpty || refresh.isEmpty) {
        lastRefreshRejected = false;
        return false;
      }
      await setTokens(access, refresh);
      lastRefreshRejected = false;
      return true;
    } on DioException catch (e) {
      final code = e.response?.statusCode;
      lastRefreshRejected = code == 400 || code == 401 || code == 403;
      return false;
    } catch (_) {
      lastRefreshRejected = false;
      return false;
    }
  }

  /// Real sign-out: forget the tokens and tell the app to show the login page.
  Future<void> expireSession() async {
    await clear();
    onSessionExpired?.call();
  }

  /// Removes only the session tokens. The install identity lives in the same
  /// secure storage and must survive logout (it is an anti-abuse signal), so
  /// we never call deleteAll().
  Future<void> clear() async {
    _accessTokenCache = null;
    _refreshTokenCache = null;
    dio.options.headers.remove('Authorization');
    try {
      await storage.delete(key: 'accessToken');
      await storage.delete(key: 'refreshToken');
    } catch (_) {}
  }
}
