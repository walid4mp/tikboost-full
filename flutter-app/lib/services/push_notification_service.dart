import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../services/api_client.dart';
import 'local_notification_service.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  // Messages containing a notification payload are rendered by Android/FCM
  // automatically while the app is backgrounded or terminated.
}

class PushNotificationService {
  PushNotificationService._();
  static final instance = PushNotificationService._();
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  bool _initialized = false;
  bool _listenersRegistered = false;
  AuthorizationStatus _authorizationStatus = AuthorizationStatus.notDetermined;

  AuthorizationStatus get authorizationStatus => _authorizationStatus;
  bool get notificationsAllowed =>
      _authorizationStatus == AuthorizationStatus.authorized ||
      _authorizationStatus == AuthorizationStatus.provisional;
  String? _pendingInitialNotificationId;

  Future<void> initialize() async {
    if (_initialized) return;
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    await requestPermission();
  }

  Future<AuthorizationStatus> requestPermission() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    _authorizationStatus = settings.authorizationStatus;
    if (!notificationsAllowed) return _authorizationStatus;

    if (!_listenersRegistered) {
      FirebaseMessaging.onMessage.listen((message) async {
        final title = message.notification?.title ?? message.data['title']?.toString() ?? 'TokAura';
        final body = message.notification?.body ?? message.data['body']?.toString() ?? '';
        if (title.isNotEmpty || body.isNotEmpty) {
          await LocalNotificationService.instance.show(title, body);
        }
      });

      FirebaseMessaging.onMessageOpenedApp.listen((message) async {
        final id = message.data['notificationId']?.toString();
        if (id == null || id.isEmpty) return;
        try {
          await ApiClient.instance.dio.post('/notifications/$id/read');
        } catch (_) {}
      });

      final initialMessage = await _messaging.getInitialMessage();
      final initialId = initialMessage?.data['notificationId']?.toString();
      if (initialId != null && initialId.isNotEmpty) {
        _pendingInitialNotificationId = initialId;
      }
      _listenersRegistered = true;
    }

    _initialized = true;
    return _authorizationStatus;
  }

  Future<void> registerToken() async {
    if (!_initialized) await initialize();
    if (!notificationsAllowed) return;
    final token = await _messaging.getToken();
    if (token == null || token.isEmpty) return;
    await ApiClient.instance.dio.post('/notifications/device-token', data: {'token': token});

    final pendingId = _pendingInitialNotificationId;
    if (pendingId != null && pendingId.isNotEmpty) {
      try {
        await ApiClient.instance.dio.post('/notifications/$pendingId/read');
      } catch (_) {}
      _pendingInitialNotificationId = null;
    }

    _messaging.onTokenRefresh.listen((newToken) async {
      try {
        await ApiClient.instance.dio.post('/notifications/device-token', data: {'token': newToken});
      } catch (_) {}
    });
  }

  Future<void> unregisterToken() async {
    try {
      await ApiClient.instance.dio.delete('/notifications/device-token');
    } catch (_) {}
  }
}
