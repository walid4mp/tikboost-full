import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';

class ApiClient {
  ApiClient._() {
    dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    _refreshDio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await storage.read(key: 'accessToken');
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final path = error.requestOptions.path;
        final alreadyRetried = error.requestOptions.extra['retried'] == true;
        final shouldSkipRefresh =
            path.contains('/auth/refresh') || path.contains('/auth/logout');

        if (error.response?.statusCode == 401 && !alreadyRetried && !shouldSkipRefresh) {
          final refreshToken = await storage.read(key: 'refreshToken');
          if (refreshToken != null && refreshToken.isNotEmpty) {
            try {
              final res = await _refreshDio.post('/auth/refresh', data: {
                'refreshToken': refreshToken,
              });
              if (res.statusCode == 200) {
                final newAccess = '${res.data['accessToken']}';
                final newRefresh = '${res.data['refreshToken']}';
                await setTokens(newAccess, newRefresh);
                final request = error.requestOptions;
                request.headers['Authorization'] = 'Bearer $newAccess';
                request.extra['retried'] = true;
                final retryResponse = await dio.fetch(request);
                return handler.resolve(retryResponse);
              }
            } catch (_) {
              await clear();
            }
          }
        }
        handler.next(error);
      },
    ));
  }

  static final ApiClient instance = ApiClient._();
  late final Dio dio;
  late final Dio _refreshDio;
  final storage = const FlutterSecureStorage();

  Future<void> setTokens(String access, String refresh) async {
    await storage.write(key: 'accessToken', value: access);
    await storage.write(key: 'refreshToken', value: refresh);
  }

  Future<void> clear() async => storage.deleteAll();
}
