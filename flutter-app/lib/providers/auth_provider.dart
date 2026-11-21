import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:shared_preferences/shared_preferences.dart';

import '../services/api_client.dart';
import '../services/push_notification_service.dart';
import '../services/install_identity.dart';

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

  /// True once start-up authentication finished (success or not). The splash
  /// screen waits for it so it never flashes the login page for a signed-in user.
  bool bootstrapped = false;

  void markBootstrapped() {
    if (bootstrapped) return;
    bootstrapped = true;
    notifyListeners();
  }

  void _emit() {
    state.notifyAll();
    notifyListeners();
  }

  static const _cacheKey = 'cached_user_v1';

  AuthProvider() {
    ApiClient.instance.onSessionExpired = () {
      state.user = null;
      state.token = null;
      _forgetCachedUser();
      _emit();
    };
  }

  Future<void> _cacheUser(Map json) async {
    try {
      final p = await SharedPreferences.getInstance();
      await p.setString(_cacheKey, jsonEncode(json));
    } catch (_) {}
  }

  Future<void> _forgetCachedUser() async {
    try {
      final p = await SharedPreferences.getInstance();
      await p.remove(_cacheKey);
    } catch (_) {}
  }

  /// Instant, offline-safe restore: if tokens and the last known profile are
  /// stored on the phone we treat the user as signed in right away. The real
  /// validation happens afterwards in [bootstrap] without blocking the UI.
  Future<bool> restoreLocal() async {
    try {
      final access = await ApiClient.instance.readAccessToken();
      final refresh = await ApiClient.instance.readRefreshToken();
      if ((access == null || access.isEmpty) && (refresh == null || refresh.isEmpty)) {
        return false;
      }
      final p = await SharedPreferences.getInstance();
      final raw = p.getString(_cacheKey);
      if (raw == null || raw.isEmpty) return false;
      state.user = AuthUser.fromJson(Map.from(jsonDecode(raw) as Map));
      state.token = access;
      _emit();
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Validates the stored session with the server.
  ///
  /// * Server says the session is gone (401/403 on refresh) -> sign out.
  /// * Network error / slow server / 5xx -> stay signed in with the cached
  ///   profile and try again later. This is what keeps people logged in.
  Future<String?> bootstrap() async {
    state.token = await ApiClient.instance.readAccessToken();
    final refresh = await ApiClient.instance.readRefreshToken();
    final hasTokens = (state.token != null && state.token!.isNotEmpty) ||
        (refresh != null && refresh.isNotEmpty);
    if (!hasTokens) return null;

    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        await refreshCurrentUser();
        return state.token;
      } on DioException catch (e) {
        final code = e.response?.statusCode;
        if (code == 401 || code == 403) {
          final refreshed = await _tryRefresh();
          if (refreshed) continue;
          if (ApiClient.instance.lastRefreshRejected) {
            await ApiClient.instance.expireSession();
            return null;
          }
        }
        // Offline or the server is waking up: wait a little and retry.
        if (attempt < 2) await Future.delayed(Duration(seconds: 2 + attempt * 3));
      } catch (_) {
        if (attempt < 2) await Future.delayed(const Duration(seconds: 2));
      }
    }

    // Could not reach the server: keep the cached session.
    if (state.user != null) return state.token;
    return null;
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
    final json = Map.from(r.data['user']);
    state.user = AuthUser.fromJson(json);
    state.token = await ApiClient.instance.readAccessToken();
    unawaited(_cacheUser(json));
    _emit();
  }

  Future signup({
    required String email,
    required String password,
    required String name,
    String? referralCode,
  }) async {
    final installId = await InstallIdentity.getId();
    final r = await ApiClient.instance.dio.post('/auth/signup', data: {
      'email': email,
      'password': password,
      'name': name,
      'referralCode': referralCode,
      'deviceId': installId,
    });
    final user = AuthUser.fromJson(Map.from(r.data['user']));
    unawaited(_cacheUser(Map.from(r.data['user'])));
    await ApiClient.instance
        .setTokens('${r.data['accessToken']}', '${r.data['refreshToken']}');
    state.user = user;
    state.token = '${r.data['accessToken']}';
    PushNotificationService.instance.registerTokenInBackground();
    _emit();
    return 'ok';
  }

  Future login({required String email, required String password}) async {
    final installId = await InstallIdentity.getId();
    final r = await ApiClient.instance.dio.post('/auth/login', data: {
      'email': email,
      'password': password,
      'deviceId': installId,
    });
    final user = AuthUser.fromJson(Map.from(r.data['user']));
    unawaited(_cacheUser(Map.from(r.data['user'])));
    await ApiClient.instance
        .setTokens('${r.data['accessToken']}', '${r.data['refreshToken']}');
    state.user = user;
    state.token = '${r.data['accessToken']}';
    PushNotificationService.instance.registerTokenInBackground();
    _emit();
    return 'ok';
  }

  Future loginWithGoogle({
    required String email,
    required String name,
    required String googleId,
    required String idToken,
  }) async {
    final installId = await InstallIdentity.getId();
    final r = await ApiClient.instance.dio.post('/auth/google', data: {
      'email': email,
      'name': name,
      'googleId': googleId,
      'idToken': idToken,
      'deviceId': installId,
    });
    final user = AuthUser.fromJson(Map.from(r.data['user']));
    unawaited(_cacheUser(Map.from(r.data['user'])));
    await ApiClient.instance
        .setTokens('${r.data['accessToken']}', '${r.data['refreshToken']}');
    state.user = user;
    state.token = '${r.data['accessToken']}';
    PushNotificationService.instance.registerTokenInBackground();
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
    unawaited(_cacheUser(Map.from(r.data['user'])));
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
    await _forgetCachedUser();
    state.user = null;
    state.token = null;
    _emit();
  }
}

final authProvider = ChangeNotifierProvider((_) => AuthProvider());
