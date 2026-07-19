import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import '../services/api_client.dart';

class AuthUser {
  final String id, email, name;
  final String role, status;
  final String avatarUrl;
  final int points;
  final String referralCode;

  AuthUser({
    required this.id, required this.email, required this.name,
    required this.role, required this.status, required this.avatarUrl,
    required this.points, required this.referralCode,
  });

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
        id: j['id'], email: j['email'], name: j['name'] ?? '',
        role: j['role'] ?? 'USER', status: j['status'] ?? 'ACTIVE',
        avatarUrl: j['avatarUrl'] ?? '',
        points: int.tryParse('${j['points']}') ?? 0,
        referralCode: j['referralCode'] ?? '',
      );
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

  Future<String?> bootstrap() async {
    state.token = await ApiClient.instance.storage.read(key: 'accessToken');
    if (state.token == null) return null;
    try {
      final r = await ApiClient.instance.dio.get('/auth/me');
      state.user = AuthUser.fromJson(r.data['user']);
      state.notifyAll();
    } catch (_) {
      state.token = null;
      await ApiClient.instance.clear();
    }
    return state.token;
  }

  Future<String> signup({
    required String email, required String password, required String name,
    String? referralCode,
  }) async {
    final r = await ApiClient.instance.dio.post('/auth/signup', data: {
      'email': email, 'password': password, 'name': name,
      'referralCode': referralCode,
    });
    final user = AuthUser.fromJson(r.data['user']);
    await ApiClient.instance.setTokens(r.data['accessToken'], r.data['refreshToken']);
    state.user = user; state.token = r.data['accessToken'];
    state.notifyAll();
    return 'ok';
  }

  Future<String> login({required String email, required String password}) async {
    final r = await ApiClient.instance.dio.post('/auth/login', data: {
      'email': email, 'password': password,
    });
    final user = AuthUser.fromJson(r.data['user']);
    await ApiClient.instance.setTokens(r.data['accessToken'], r.data['refreshToken']);
    state.user = user; state.token = r.data['accessToken'];
    state.notifyAll();
    return 'ok';
  }

  Future<String> loginWithGoogle({
    required String email, required String name, required String googleId,
  }) async {
    final r = await ApiClient.instance.dio.post('/auth/google', data: {
      'email': email, 'name': name, 'googleId': googleId,
    });
    final user = AuthUser.fromJson(r.data['user']);
    await ApiClient.instance.setTokens(r.data['accessToken'], r.data['refreshToken']);
    state.user = user; state.token = r.data['accessToken'];
    state.notifyAll();
    return 'ok';
  }

  Future<void> forgot(String email, String newPassword) async {
    await ApiClient.instance.dio.post('/auth/forgot', data: {
      'email': email, 'newPassword': newPassword,
    });
  }

  Future<void> logout() async {
    final rt = await ApiClient.instance.storage.read(key: 'refreshToken');
    try { await ApiClient.instance.dio.post('/auth/logout', data: {'refreshToken': rt}); }
    catch (_) {}
    await ApiClient.instance.clear();
    state.user = null; state.token = null; state.notifyAll();
  }
}

final authProvider = ChangeNotifierProvider<AuthProvider>((_) => AuthProvider());
