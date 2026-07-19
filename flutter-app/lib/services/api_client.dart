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
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (o, h) async {
        final token = await storage.read(key: 'accessToken');
        if (token != null) o.headers['Authorization'] = 'Bearer $token';
        h.next(o);
      },
      onError: (e, h) async {
        if (e.response?.statusCode == 401) {
          final refresh = await storage.read(key: 'refreshToken');
          if (refresh != null) {
            try {
              final res = await Dio().post('${AppConfig.apiBaseUrl}/auth/refresh',
                data: {'refreshToken': refresh});
              if (res.statusCode == 200) {
                await storage.write(key: 'accessToken', value: res.data['accessToken']);
                await storage.write(key: 'refreshToken', value: res.data['refreshToken']);
                final req = e.requestOptions;
                req.headers['Authorization'] = 'Bearer ${res.data['accessToken']}';
                final retry = await dio.fetch(req);
                return h.resolve(retry);
              }
            } catch (_) {}
          }
        }
        h.next(e);
      },
    ));
  }

  static final ApiClient instance = ApiClient._();
  late final Dio dio;
  final storage = const FlutterSecureStorage();

  Future<void> setTokens(String access, String refresh) async {
    await storage.write(key: 'accessToken', value: access);
    await storage.write(key: 'refreshToken', value: refresh);
  }
  Future<void> clear() async => storage.deleteAll();
}
