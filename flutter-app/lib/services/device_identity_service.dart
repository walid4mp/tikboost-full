import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Returns a stable app/device identifier that survives app reinstalls on
/// supported platforms. The backend uses it only for anti-abuse limits.
class DeviceIdentityService {
  DeviceIdentityService._();
  static final instance = DeviceIdentityService._();

  static const _fallbackKey = 'tikboost_device_identity_v1';

  Future<String> getId() async {
    final plugin = DeviceInfoPlugin();

    try {
      if (Platform.isAndroid) {
        final info = await plugin.androidInfo;
        final id = info.id.trim();
        if (id.isNotEmpty) return 'android:$id';
      } else if (Platform.isIOS) {
        final info = await plugin.iosInfo;
        final id = (info.identifierForVendor ?? '').trim();
        if (id.isNotEmpty) return 'ios:$id';
      }
    } catch (_) {
      // Use a persistent fallback below.
    }

    final prefs = await SharedPreferences.getInstance();
    var fallback = prefs.getString(_fallbackKey);
    if (fallback == null || fallback.trim().isEmpty) {
      fallback = 'fallback:${DateTime.now().microsecondsSinceEpoch}';
      await prefs.setString(_fallbackKey, fallback);
    }
    return fallback;
  }
}
