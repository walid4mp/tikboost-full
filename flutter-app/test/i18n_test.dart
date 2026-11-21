import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:tikboost_wh/i18n/i18n.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  test('Arabic is the source language and is returned unchanged', () async {
    await I18n.instance.setLang('ar');
    expect(tr('الإعدادات'), 'الإعدادات');
    expect(I18n.instance.isRtl, isTrue);
  });

  test('English and French translate known strings', () async {
    await I18n.instance.setLang('en');
    expect(tr('الإعدادات'), 'Settings');
    expect(I18n.instance.isRtl, isFalse);
    await I18n.instance.setLang('fr');
    expect(tr('الإعدادات'), 'Paramètres');
  });

  test('unknown strings fall back to the original text', () async {
    await I18n.instance.setLang('en');
    expect(tr('نص غير موجود في الجدول'), 'نص غير موجود في الجدول');
  });

  test('pattern rules translate strings with numbers', () async {
    await I18n.instance.setLang('en');
    expect(tr('50 نقطة'), '50 points');
    expect(tr('حصلت على 50 نقطة'), 'You got 50 points');
    await I18n.instance.setLang('ar');
  });
}
