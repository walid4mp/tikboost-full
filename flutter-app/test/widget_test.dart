import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:tikboost/config/app_config.dart';
import 'package:tikboost/config/app_theme.dart';

void main() {
  test('app config exposes production defaults', () {
    expect(AppConfig.appName, 'TikBoost');
    expect(AppConfig.apiBaseUrl, contains('/api'));
    expect(AppConfig.socketUrl, startsWith('https://'));
  });

  testWidgets('light theme renders brand title', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: const Scaffold(
          body: Center(child: Text('TikBoost')),
        ),
      ),
    );

    expect(find.text('TikBoost'), findsOneWidget);
  });
}
