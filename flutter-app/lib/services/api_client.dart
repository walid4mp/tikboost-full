import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';

class ApiClient {
  ApiClient._() {
    dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
        },
      ),
    );

    _refreshDio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await storage.read(key: 'accessToken');

          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }

          handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401) {
            final refreshToken =
                await storage.read(key: 'refreshToken');

            if (refreshToken != null) {
              try {
                final res = await _refreshDio.post(
                  '/auth/refresh',
                  data: {
                    'refreshToken': refreshToken,
                  },
                );

                await setTokens(
                  res.data['accessToken'],
                  res.data['refreshToken'],
                );

                final request = error.requestOptions;
                request.headers['Authorization'] =
                    'Bearer ${res.data['accessToken']}';

                final retry = await dio.fetch(request);
                return handler.resolve(retry);
              } catch (_) {
                await clear();
              }
            }
          }

          handler.next(error);
        },
      ),
    );
  }

  static final ApiClient instance = ApiClient._();

  late final Dio dio;
  late final Dio _refreshDio;

  final storage = const FlutterSecureStorage();

  Future<void> setTokens(
    String access,
    String refresh,
  ) async {
    await storage.write(
      key: 'accessToken',
      value: access,
    );

    await storage.write(
      key: 'refreshToken',
      value: refresh,
    );
  }

  Future<void> clear() async {
    await storage.deleteAll();
  }
}
