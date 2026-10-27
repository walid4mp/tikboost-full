import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';

class ClientConfigProvider extends ChangeNotifier {
  Map<String, dynamic> config = const <String, dynamic>{};
  bool loading = false;
  String? error;

  List<dynamic> get packages => (config['packages'] as List?) ?? const <dynamic>[];

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();

    try {
      final dio = Dio(
        BaseOptions(
          baseUrl: AppConfig.apiBaseUrl,
          connectTimeout: const Duration(seconds: 20),
          receiveTimeout: const Duration(seconds: 30),
          headers: const {'Content-Type': 'application/json'},
        ),
      );
      final response = await dio.get('/config/client');
      final nextConfig = Map<String, dynamic>.from(
        response.data['config'] as Map? ?? const <String, dynamic>{},
      );
      config = nextConfig;
      AppConfig.applyClientConfig(nextConfig);
    } catch (e) {
      error = e.toString();
    } finally {
      loading = false;
      notifyListeners();
    }
  }
}

final clientConfigProvider =
    ChangeNotifierProvider<ClientConfigProvider>((_) => ClientConfigProvider());
