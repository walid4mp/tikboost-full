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

  test('client config applies dynamic contact links', () {
    AppConfig.applyClientConfig({
      'app': {
        'supportEmail': 'ww608352@gmail.com',
        'whatsapp': '213779109990',
        'instagramUrl': 'https://www.instagram.com/wh.s.8',
        'facebookUrl': 'https://www.facebook.com/profile.php?id=61570663858487',
        'contactLinks': [
          {
            'key': 'whatsapp',
            'label': 'WhatsApp',
            'value': '213779109990',
            'enabled': true,
          },
          {
            'key': 'instagram',
            'label': 'Instagram',
            'value': 'https://www.instagram.com/wh.s.8',
            'enabled': true,
          },
          {
            'key': 'facebook',
            'label': 'Facebook',
            'value': 'https://www.facebook.com/profile.php?id=61570663858487',
            'enabled': true,
          },
          {
            'key': 'email',
            'label': 'Email',
            'value': 'ww608352@gmail.com',
            'enabled': true,
          },
        ],
      },
      'features': const <String, dynamic>{},
      'campaignPricing': const <String, dynamic>{},
      'payments': const <String, dynamic>{},
      'levels': const <String, dynamic>{},
    });

    expect(AppConfig.whatsappDisplayValue, '213779109990');
    expect(AppConfig.whatsappChatUrl, 'https://wa.me/213779109990');
    expect(AppConfig.supportMailTo, 'mailto:ww608352@gmail.com');
    expect(AppConfig.enabledContactLinks.length, 4);
    expect(
      AppConfig.whatsappUrlWithText('شراء باقة'),
      contains('https://wa.me/213779109990'),
    );
    expect(
      AppConfig.whatsappUrlWithText('شراء باقة'),
      contains('text=%D8%B4%D8%B1%D8%A7%D8%A1'),
    );
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
