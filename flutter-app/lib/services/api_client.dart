import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/app_config.dart';

String userFriendlyApiError(Object error, {String fallback = 'حدث خطأ غير متوقع. حاول مرة أخرى.'}) {
  if (error is DioException) {
    final status = error.response?.statusCode;
    final data = error.response?.data;
    final message = data is Map ? '${data['message'] ?? ''}'.trim() : '';
    final code = data is Map ? '${data['code'] ?? ''}'.trim() : '';

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
          final token = _accessTokenCache ?? await storage.read(key: 'accessToken');
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          options.extra['retried'] ??= false;
          handler.next(options);
        },
        onError: (error, handler) async {
          final shouldRefresh =
              error.response?.statusCode == 401 &&
              error.requestOptions.path != '/auth/refresh' &&
              error.requestOptions.extra['retried'] != true;

          if (!shouldRefresh) {
            handler.next(error);
            return;
          }

          try {
            final refreshed = await refreshSession();
            if (!refreshed) {
              handler.next(error);
              return;
            }

            final request = error.requestOptions;
            request.extra['retried'] = true;
            if (_accessTokenCache != null && _accessTokenCache!.isNotEmpty) {
              request.headers['Authorization'] = 'Bearer $_accessTokenCache';
            }
            final retry = await dio.fetch(request);
            handler.resolve(retry);
          } catch (_) {
            await clear();
            handler.next(error);
          }
        },
      ),
    );
  }

  static final ApiClient instance = ApiClient._();

  late final Dio dio;
  late final Dio _refreshDio;
  final storage = const FlutterSecureStorage();
  String? _accessTokenCache;
  String? _refreshTokenCache;

  BaseOptions _options() => BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 30),
        contentType: 'application/json',
        headers: const {'Content-Type': 'application/json'},
        extra: const {'withCredentials': true},
      );

  Future<String?> readAccessToken() async {
    _accessTokenCache ??= await storage.read(key: 'accessToken');
    return _accessTokenCache;
  }

  Future<String?> readRefreshToken() async {
    _refreshTokenCache ??= await storage.read(key: 'refreshToken');
    return _refreshTokenCache;
  }

  Future<void> setTokens(String access, String refresh) async {
    _accessTokenCache = access;
    _refreshTokenCache = refresh;
    dio.options.headers['Authorization'] = 'Bearer $access';
    await storage.write(key: 'accessToken', value: access);
    await storage.write(key: 'refreshToken', value: refresh);
  }

  Future<bool> refreshSession() async {
    final refreshToken = await readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) return false;

    final res = await _refreshDio.post(
      '/auth/refresh',
      data: {'refreshToken': refreshToken},
      options: Options(extra: const {'withCredentials': true}),
    );

    final access = '${res.data['accessToken'] ?? ''}'.trim();
    final refresh = '${res.data['refreshToken'] ?? ''}'.trim();
    if (access.isEmpty || refresh.isEmpty) return false;
    await setTokens(access, refresh);
    return true;
  }

  Future<void> clear() async {
    _accessTokenCache = null;
    _refreshTokenCache = null;
    dio.options.headers.remove('Authorization');
    await storage.deleteAll();
  }
}
