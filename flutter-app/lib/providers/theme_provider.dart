import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeController extends ChangeNotifier {
  ThemeMode _mode = ThemeMode.dark;
  Locale _locale = const Locale('ar');
  ThemeMode get mode => _mode;
  bool get isDark => _mode == ThemeMode.dark;
  Locale get locale => _locale;
  String get languageCode => _locale.languageCode;

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    final isDark = p.getBool('isDark') ?? true;
    _mode = isDark ? ThemeMode.dark : ThemeMode.light;
    final code = p.getString('lang') ?? 'ar';
    _locale = ['ar', 'fr', 'en'].contains(code) ? Locale(code) : const Locale('ar');
    notifyListeners();
  }

  Future<void> toggle() async {
    _mode = isDark ? ThemeMode.light : ThemeMode.dark;
    final p = await SharedPreferences.getInstance();
    await p.setBool('isDark', isDark);
    notifyListeners();
  }

  Future<void> setLanguage(String code) async {
    if (!['ar', 'fr', 'en'].contains(code)) return;
    _locale = Locale(code);
    final p = await SharedPreferences.getInstance();
    await p.setString('lang', code);
    notifyListeners();
  }
}

final themeProvider = ChangeNotifierProvider<ThemeController>((_) => ThemeController()..load());
