import 'dart:math';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Stable per-install identifier used as one anti-abuse signal, not as proof of identity.
class InstallIdentity {
  InstallIdentity._();
  static const _storage = FlutterSecureStorage();
  static const _key = 'install_identity_v1';
  static Future<String> getId() async {
    var value = await _storage.read(key: _key);
    if (value != null && value.length >= 32) return value;
    final random = Random.secure();
    value = List<int>.generate(32, (_) => random.nextInt(16))
        .map((n) => n.toRadixString(16)).join();
    await _storage.write(key: _key, value: value);
    return value;
  }
}
