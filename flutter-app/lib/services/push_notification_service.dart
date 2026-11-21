
import 'dart:async';

import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../services/api_client.dart';
import 'local_notification_service.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(
  RemoteMessage message,
) async {
  // Initialize Firebase before using any Firebase service.
  if (Firebase.apps.isEmpty) {
    await Firebase.initializeApp();
  }
}

class PushNotificationService {
  PushNotificationService._();

  static final PushNotificationService instance =
      PushNotificationService._();

  static const String _appVersion =
      String.fromEnvironment('APP_VERSION', defaultValue: '1.3.1');

  // Important: FirebaseMessaging.instance must not be accessed
  // before Firebase.initializeApp() completes.
  late final FirebaseMessaging _messaging;

  bool _initialized = false;
  bool _signedIn = false;

  String? _lastRegisteredToken;
  DateTime? _lastRegisteredAt;
  Future<void>? _registering;

  void Function()? onOpenNotifications;
  bool _pendingOpen = false;

  Future<void> initialize() async {
    if (_initialized) return;

    // Initialize Firebase first.
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp();
    }

    // Only access Firebase Messaging after Firebase initialization.
    _messaging = FirebaseMessaging.instance;

    FirebaseMessaging.onBackgroundMessage(
      firebaseMessagingBackgroundHandler,
    );

    try {
      await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
    } catch (e) {
      debugPrint('[push] permission request failed: $e');
    }

    FirebaseMessaging.onMessage.listen((message) async {
      try {
        final title = message.notification?.title ??
            message.data['title']?.toString() ??
            'tikboost.wh';

        final body = message.notification?.body ??
            message.data['body']?.toString() ??
            '';

        if (title.isNotEmpty || body.isNotEmpty) {
          await LocalNotificationService.instance.show(title, body);
        }
      } catch (e) {
        debugPrint('[push] foreground notification failed: $e');
      }
    });

    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _openNotifications();
    });

    _messaging.onTokenRefresh.listen((token) {
      if (_signedIn) {
        unawaited(_sendToServer(token, force: true));
      }
    });

    _initialized = true;

    // Handle app launched by tapping a notification.
    try {
      final initialMessage = await _messaging.getInitialMessage();

      if (initialMessage != null) {
        _pendingOpen = true;
      }
    } catch (e) {
      debugPrint('[push] initial message failed: $e');
    }
  }

  void _openNotifications() {
    if (onOpenNotifications != null) {
      onOpenNotifications!.call();
    } else {
      _pendingOpen = true;
    }
  }

  /// Called when the application router is ready.
  void flushPendingOpen() {
    if (!_pendingOpen) return;

    _pendingOpen = false;
    onOpenNotifications?.call();
  }

  /// Register token without blocking login/signup.
  void registerTokenInBackground() {
    unawaited(
      registerToken().catchError((Object error) {
        debugPrint('[push] background registration failed: $error');
      }),
    );
  }

  Future<void> registerToken({bool force = false}) {
    _signedIn = true;

    return _registering ??= _doRegister(force).whenComplete(() {
      _registering = null;
    });
  }

  Future<void> _doRegister(bool force) async {
    if (!_initialized) {
      await initialize();
    }

    final settings = await _messaging.getNotificationSettings();

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('[push] notification permission denied');
      return;
    }

    String? token = await _messaging.getToken();

    for (var i = 0; (token == null || token.isEmpty) && i < 3; i++) {
      await Future<void>.delayed(
        Duration(seconds: 2 * (i + 1)),
      );

      token = await _messaging.getToken();
    }

    if (token == null || token.isEmpty) {
      debugPrint('[push] FCM token unavailable');
      return;
    }

    await _sendToServer(token, force: force);
  }

  Future<void> _sendToServer(
    String token, {
    bool force = false,
  }) async {
    final recent = _lastRegisteredAt != null &&
        DateTime.now().difference(_lastRegisteredAt!) <
            const Duration(hours: 6);

    if (!force && token == _lastRegisteredToken && recent) {
      return;
    }

    for (var attempt = 0; attempt < 4; attempt++) {
      try {
        await ApiClient.instance.dio.post(
          '/notifications/device-token',
          data: {
            'token': token,
            'platform':
                defaultTargetPlatform == TargetPlatform.iOS
                    ? 'ios'
                    : 'android',
            'appVersion': _appVersion,
          },
        );

        _lastRegisteredToken = token;
        _lastRegisteredAt = DateTime.now();

        debugPrint('[push] FCM token registered successfully');
        return;
      } catch (e) {
        final status =
            e is DioException ? e.response?.statusCode : null;

        debugPrint('[push] token registration attempt ${attempt + 1}: $e');

        if (status == 400 || status == 401 || status == 403) {
          return;
        }

        if (attempt < 3) {
          await Future<void>.delayed(
            Duration(seconds: 3 * (attempt + 1)),
          );
        }
      }
    }
  }

  /// Re-register token when app resumes.
  void onAppResumed() {
    if (_signedIn) {
      registerTokenInBackground();
    }
  }

  Future<void> unregisterToken() async {
    _signedIn = false;

    final token = _lastRegisteredToken;

    _lastRegisteredToken = null;
    _lastRegisteredAt = null;

    try {
      await ApiClient.instance.dio.delete(
        '/notifications/device-token',
        data: token == null ? null : {'token': token},
      );
    } catch (e) {
      debugPrint('[push] unregister token failed: $e');
    }
  }
}
