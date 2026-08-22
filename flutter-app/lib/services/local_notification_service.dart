import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

class LocalNotificationService {
  LocalNotificationService._();
  static final instance = LocalNotificationService._();
  final FlutterLocalNotificationsPlugin plugin = FlutterLocalNotificationsPlugin();

  Future<void> initialize() async {
    tz.initializeTimeZones();
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const settings = InitializationSettings(android: android);
    await plugin.initialize(settings);
    await plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.requestNotificationsPermission();
  }

  Future<void> show(String title, String body) async {
    const details = NotificationDetails(android: AndroidNotificationDetails(
      'tokaura_general', 'TokAura',
      channelDescription: 'إشعارات TokAura', importance: Importance.high, priority: Priority.high,
      playSound: true, sound: RawResourceAndroidNotificationSound('notify'),
    ));
    await plugin.show(DateTime.now().millisecondsSinceEpoch ~/ 1000, title, body, details);
  }

  Future<void> scheduleReminder({int hours = 24}) async {
    const details = NotificationDetails(android: AndroidNotificationDetails(
      'tokaura_reminders', 'تذكيرات TokAura',
      channelDescription: 'تذكير المستخدم بالعودة إلى TokAura', importance: Importance.defaultImportance, priority: Priority.defaultPriority,
    ));
    final when = tz.TZDateTime.now(tz.local).add(Duration(hours: hours));
    await plugin.zonedSchedule(
      8001, 'اشتقنا لك في TokAura 👋', 'عد للتطبيق واجمع نقاطك وأكمل مهامك اليومية.', when, details,
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
      matchDateTimeComponents: null,
    );
  }
}
