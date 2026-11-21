import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart' show TextDirection;
import 'package:shared_preferences/shared_preferences.dart';

import 'translations.dart';

/// Lightweight runtime localization (Arabic / English / Français).
///
/// Arabic is the source language: every UI string in the code base is written
/// in Arabic and [tr] maps it to the active language through the generated
/// table in `translations.dart`. Unknown strings fall back to the original
/// text, so a missing translation can never crash or blank the UI.
class I18n extends ChangeNotifier {
  I18n._();
  static final I18n instance = I18n._();

  static const List<String> supported = ['ar', 'en', 'fr'];
  static const Map<String, String> nativeNames = {
    'ar': 'العربية',
    'en': 'English',
    'fr': 'Français',
  };
  static const Map<String, String> flags = {'ar': '🇩🇿', 'en': '🇬🇧', 'fr': '🇫🇷'};

  String _lang = 'ar';
  bool _loaded = false;

  String get lang => _lang;
  bool get isRtl => _lang == 'ar';
  bool get loaded => _loaded;
  ui.Locale get locale => ui.Locale(_lang);
  TextDirection get direction => isRtl ? TextDirection.rtl : TextDirection.ltr;

  /// Reads the saved language. On first run it follows the phone language
  /// when supported, otherwise Arabic.
  Future<void> load() async {
    try {
      final p = await SharedPreferences.getInstance();
      final saved = p.getString('lang');
      if (saved != null && supported.contains(saved)) {
        _lang = saved;
      } else {
        final device = ui.PlatformDispatcher.instance.locale.languageCode;
        _lang = supported.contains(device) ? device : 'ar';
      }
    } catch (_) {
      _lang = 'ar';
    }
    _loaded = true;
    notifyListeners();
  }

  Future<void> setLang(String code) async {
    if (!supported.contains(code) || code == _lang) return;
    _lang = code;
    try {
      final p = await SharedPreferences.getInstance();
      await p.setString('lang', code);
    } catch (_) {}
    notifyListeners();
  }
}

/// Translate an Arabic source string into the active language.
String tr(String ar) {
  final lang = I18n.instance.lang;
  if (lang == 'ar' || ar.isEmpty) return ar;
  final idx = lang == 'en' ? 0 : 1;
  final hit = kTr[ar];
  if (hit != null) {
    final v = hit[idx];
    return v.isEmpty ? ar : v;
  }
  for (final rule in kTrRules) {
    final m = rule.pattern.firstMatch(ar);
    if (m != null) {
      var out = lang == 'en' ? rule.en : rule.fr;
      for (var i = 1; i <= m.groupCount; i++) {
        out = out.replaceAll('{$i}', tr(m.group(i) ?? ''));
      }
      return out;
    }
  }
  return _unit(ar, lang);
}

String _unit(String s, String lang) =>
    s.contains('نقطة') ? s.replaceAll('نقطة', 'points') : s;

class TrRule {
  final RegExp pattern;
  final String en;
  final String fr;
  const TrRule(this.pattern, this.en, this.fr);
}
