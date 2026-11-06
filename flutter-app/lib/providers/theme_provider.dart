import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeController extends ChangeNotifier {
  ThemeMode _mode = ThemeMode.dark;
  ThemeMode get mode => _mode;
  bool get isDark => _mode == ThemeMode.dark;

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    final isDark = p.getBool('isDark') ?? true;
    _mode = isDark ? ThemeMode.dark : ThemeMode.light;
    notifyListeners();
  }

  Future<void> toggle() async {
    _mode = isDark ? ThemeMode.light : ThemeMode.dark;
    final p = await SharedPreferences.getInstance();
    await p.setBool('isDark', isDark);
    notifyListeners();
  }

  Future<void> setLanguage(String code) async {
    final p = await SharedPreferences.getInstance();
    await p.setString('lang', code);
  }
}

final themeProvider = ChangeNotifierProvider<ThemeController>((_) => ThemeController()..load());
