import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/api_client.dart';
import '../services/push_notification_service.dart';

class AuthUser {
  final String id;
  final String email;
  final String name;
  final String role;
  final String status;
  final String avatarUrl;
  final int points;
  final String referralCode;
  final String gender;
  final String countryCode;
  final int totalEarned;
  final int totalSpent;
  final DateTime? vipProUntil;

  AuthUser({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.status,
    required this.avatarUrl,
    required this.points,
    required this.referralCode,
    required this.gender,
    required this.countryCode,
    required this.totalEarned,
    required this.totalSpent,
    required this.vipProUntil,
  });

  bool get isVipPro => vipProUntil != null && vipProUntil!.isAfter(DateTime.now());

  bool get isProfileComplete =>
      (gender == 'MALE' || gender == 'FEMALE') && countryCode.isNotEmpty;

  factory AuthUser.fromJson(Map j) => AuthUser(
        id: '${j['id']}',
        email: '${j['email']}',
        name: '${j['name'] ?? ''}',
        role: '${j['role'] ?? 'USER'}',
        status: '${j['status'] ?? 'ACTIVE'}',
        avatarUrl: '${j['avatarUrl'] ?? ''}',
        points: int.tryParse('${j['points']}') ?? 0,
        referralCode: '${j['referralCode'] ?? ''}',
        gender: '${j['gender'] ?? ''}',
        countryCode: '${j['countryCode'] ?? ''}',
        totalEarned: int.tryParse('${j['totalEarned']}') ?? 0,
        totalSpent: int.tryParse('${j['totalSpent']}') ?? 0,
        vipProUntil: j['vipProUntil'] == null ? null : DateTime.tryParse('${j['vipProUntil']}'),
      );

  AuthUser copyWith({
    String? name,
    String? avatarUrl,
    int? points,
    String? gender,
    String? countryCode,
    int? totalEarned,
    int? totalSpent,
    DateTime? vipProUntil,
  }) {
    return AuthUser(
      id: id,
      email: email,
      name: name ?? this.name,
      role: role,
      status: status,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      points: points ?? this.points,
      referralCode: referralCode,
      gender: gender ?? this.gender,
      countryCode: countryCode ?? this.countryCode,
      totalEarned: totalEarned ?? this.totalEarned,
      totalSpent: totalSpent ?? this.totalSpent,
      vipProUntil: vipProUntil ?? this.vipProUntil,
    );
  }
}

class AuthState extends ChangeNotifier {
  AuthUser? user;
  String? token;
  bool isLoading = false;

  bool get loggedIn => user != null;

  void notifyAll() => notifyListeners();
}

class AuthProvider extends ChangeNotifier {
  final state = AuthState();

  void _emit() {
    state.notifyAll();
    notifyListeners();
  }

  Future<String?> bootstrap() async {
    state.token = await ApiClient.instance.readAccessToken();
    if (state.token == null || state.token!.isEmpty) {
      final refreshed = await _tryRefresh();
      if (!refreshed) return null;
    }

    try {
      await refreshCurrentUser();
      return state.token;
    } catch (_) {
      final refreshed = await _tryRefresh();
      if (!refreshed) {
        await ApiClient.instance.clear();
        state.user = null;
        state.token = null;
        _emit();
        return null;
      }
      await refreshCurrentUser();
      return state.token;
    }
  }

  Future<bool> _tryRefresh() async {
    try {
      final ok = await ApiClient.instance.refreshSession();
      state.token = await ApiClient.instance.readAccessToken();
      return ok;
    } catch (_) {
      return false;
    }
  }

  Future refreshCurrentUser() async {
    final r = await ApiClient.instance.dio.get('/auth/me');
    state.user = AuthUser.fromJson(Map.from(r.data['user']));
    state.token = await ApiClient.instance.readAccessToken();
    _emit();
  }

  Future signup({
    required String email,
    required String password,
    required String name,
    String? referralCode,
  }) async {
    final r = await ApiClient.instance.dio.post('/auth/signup', data: {
      'email': email,
      'password': password,
      'name': name,
      'referralCode': referralCode,
    });
    final user = AuthUser.fromJson(Map.from(r.data['user']));
    await ApiClient.instance
        .setTokens('${r.data['accessToken']}', '${r.data['refreshToken']}');
    state.user = user;
    state.token = '${r.data['accessToken']}';
    try { await PushNotificationService.instance.registerToken(); } catch (_) {}
    _emit();
    return 'ok';
  }

  Future login({required String email, required String password}) async {
    final r = await ApiClient.instance.dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    final user = AuthUser.fromJson(Map.from(r.data['user']));
    await ApiClient.instance
        .setTokens('${r.data['accessToken']}', '${r.data['refreshToken']}');
    state.user = user;
    state.token = '${r.data['accessToken']}';
    try { await PushNotificationService.instance.registerToken(); } catch (_) {}
    _emit();
    return 'ok';
  }

  Future loginWithGoogle({
    required String email,
    required String name,
    required String googleId,
  }) async {
    final r = await ApiClient.instance.dio.post('/auth/google', data: {
      'email': email,
      'name': name,
      'googleId': googleId,
    });
    final user = AuthUser.fromJson(Map.from(r.data['user']));
    await ApiClient.instance
        .setTokens('${r.data['accessToken']}', '${r.data['refreshToken']}');
    state.user = user;
    state.token = '${r.data['accessToken']}';
    try { await PushNotificationService.instance.registerToken(); } catch (_) {}
    _emit();
    return 'ok';
  }

  Future completeProfile({
    required String gender,
    required String countryCode,
  }) async {
    final r = await ApiClient.instance.dio.post('/user/profile/complete', data: {
      'gender': gender,
      'countryCode': countryCode,
    });
    state.user = AuthUser.fromJson(Map.from(r.data['user']));
    _emit();
  }

  Future requestPasswordReset(String email) async {
    await ApiClient.instance.dio.post('/auth/forgot', data: {'email': email});
  }

  /// NEW: Correct reset with email + 6-digit code
  Future resetPasswordWithCode({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    await ApiClient.instance.dio.post('/auth/reset', data: {
      'email': email,
      'code': code,
      'newPassword': newPassword,
    });
  }

  /// DEPRECATED: kept for backward compatibility only
  Future applyPasswordReset(String token, String newPassword) async {
    await resetPasswordWithCode(
      email: '',
      code: token,
      newPassword: newPassword,
    );
  }

  Future logout() async {
    try { await PushNotificationService.instance.unregisterToken(); } catch (_) {}
    final rt = await ApiClient.instance.readRefreshToken();
    try {
      await ApiClient.instance
          .dio
          .post('/auth/logout', data: {'refreshToken': rt});
    } catch (_) {}
    await ApiClient.instance.clear();
    state.user = null;
    state.token = null;
    _emit();
  }
}

final authProvider = ChangeNotifierProvider((_) => AuthProvider());
