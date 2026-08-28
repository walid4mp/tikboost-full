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

  Future<void> initialize() async {
    if (_initialized) return;
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    final settings = await _messaging.requestPermission(alert: true, badge: true, sound: true, provisional: false);
    if (settings.authorizationStatus == AuthorizationStatus.denied) return;

    FirebaseMessaging.onMessage.listen((message) async {
      final title = message.notification?.title ?? message.data['title']?.toString() ?? 'TokAura';
      final body = message.notification?.body ?? message.data['body']?.toString() ?? '';
      if (title.isNotEmpty || body.isNotEmpty) {
        await LocalNotificationService.instance.show(title, body);
      }
    });

    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      // The notification center is the canonical in-app inbox. The app refreshes
      // it when the user opens it, so no navigation state is required here.
    });
    _initialized = true;
  }

  Future<void> registerToken() async {
    if (!_initialized) await initialize();
    final token = await _messaging.getToken();
    if (token == null || token.isEmpty) return;
    await ApiClient.instance.dio.post('/notifications/device-token', data: {'token': token});
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
