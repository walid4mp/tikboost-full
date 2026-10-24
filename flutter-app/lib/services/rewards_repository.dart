import 'api_client.dart';

class RewardsRepository {
  RewardsRepository._();
  static final RewardsRepository instance = RewardsRepository._();

  Future<Map<String, dynamic>> status() async {
    final r = await ApiClient.instance.dio.get('/rewards/status');
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<Map<String, dynamic>> profile() async {
    final r = await ApiClient.instance.dio.get('/rewards/profile');
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<Map<String, dynamic>> startDailyAd() async {
    final r = await ApiClient.instance.dio.post('/rewards/ad/start');
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<Map<String, dynamic>> claimDailyAd(String sessionId) async {
    final r = await ApiClient.instance.dio.post(
      '/rewards/ad/claim',
      data: {'sessionId': sessionId},
    );
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<Map<String, dynamic>> startExtraSpinAd() async {
    final r = await ApiClient.instance.dio.post('/rewards/wheel-extra/start');
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<Map<String, dynamic>> claimExtraSpinAd(String sessionId) async {
    final r = await ApiClient.instance.dio.post(
      '/rewards/wheel-extra/claim',
      data: {'sessionId': sessionId},
    );
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<Map<String, dynamic>> claimDailyLogin() async {
    final r = await ApiClient.instance.dio.post('/rewards/login/claim');
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<Map<String, dynamic>> chestStatus() async {
    final r = await ApiClient.instance.dio.get('/rewards/chest');
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<Map<String, dynamic>> openChest() async {
    final r = await ApiClient.instance.dio.post('/rewards/chest/open');
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<Map<String, dynamic>> dailyTasks() async {
    final r = await ApiClient.instance.dio.get('/rewards/daily-tasks');
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<Map<String, dynamic>> claimDailyTask(String key) async {
    final r = await ApiClient.instance.dio.post('/rewards/daily-tasks/$key/claim');
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<Map<String, dynamic>> completeManualTask(String key) async {
    final r = await ApiClient.instance.dio.post('/rewards/daily-tasks/$key/complete');
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<Map<String, dynamic>> achievements() async {
    final r = await ApiClient.instance.dio.get('/rewards/achievements');
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<List<dynamic>> personalizedOffers() async {
    final r = await ApiClient.instance.dio.get('/offers/personalized');
    return List<dynamic>.from(r.data['offers'] ?? const []);
  }

  Future<Map<String, dynamic>> buyOffer(String id) async {
    final r = await ApiClient.instance.dio.post('/offers/$id/buy', data: {'method': 'manual_transfer'});
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<List<dynamic>> weekly() async {
    final r = await ApiClient.instance.dio.get('/rewards/weekly');
    return List<dynamic>.from(r.data['items'] ?? const []);
  }

  Future<Map<String, dynamic>> claimWeekly(String key) async {
    final r = await ApiClient.instance.dio.post('/rewards/weekly/$key/claim');
    return Map<String, dynamic>.from(r.data as Map);
  }

  Future<Map<String, dynamic>> claimAchievement(String key) async {
    final r = await ApiClient.instance.dio.post('/rewards/achievements/$key/claim');
    return Map<String, dynamic>.from(r.data as Map);
  }
}
