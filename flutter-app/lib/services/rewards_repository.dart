import 'api_client.dart';

class RewardsRepository {
  RewardsRepository._();
  static final RewardsRepository instance = RewardsRepository._();

  Future<Map<String, dynamic>> status() async {
    final r = await ApiClient.instance.dio.get('/rewards/status');
    return Map<String, dynamic>.from(r.data['rewards'] ?? const {});
  }

  Future<Map<String, dynamic>> startDailyAd() async {
    final r = await ApiClient.instance.dio.post('/rewards/ad/start');
    return Map<String, dynamic>.from(r.data);
  }

  Future<Map<String, dynamic>> claimDailyAd(String sessionId) async {
    final r = await ApiClient.instance.dio.post(
      '/rewards/ad/claim',
      data: {'sessionId': sessionId},
    );
    return Map<String, dynamic>.from(r.data);
  }

  Future<Map<String, dynamic>> startExtraSpinAd() async {
    final r = await ApiClient.instance.dio.post('/rewards/wheel-extra/start');
    return Map<String, dynamic>.from(r.data);
  }

  Future<Map<String, dynamic>> claimExtraSpinAd(String sessionId) async {
    final r = await ApiClient.instance.dio.post(
      '/rewards/wheel-extra/claim',
      data: {'sessionId': sessionId},
    );
    return Map<String, dynamic>.from(r.data);
  }
}
