import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

class LocalNotificationService {
  LocalNotificationService._();
  static final instance = LocalNotificationService._();
  final FlutterLocalNotificationsPlugin plugin =
      FlutterLocalNotificationsPlugin();

  Future<void> initialize() async {
    tz.initializeTimeZones();
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const settings = InitializationSettings(android: android);
    await plugin.initialize(settings);

    final androidPlugin = plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();

    await androidPlugin?.requestNotificationsPermission();

    // The channel is also created natively so FCM can use the same channel
    // while the app is fully closed.
    await androidPlugin?.createNotificationChannel(
      const AndroidNotificationChannel(
        'tokaura_general_v2',
        'إشعارات TokAura',
        description: 'الإشعارات المهمة من TokAura',
        importance: Importance.high,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('notify'),
        enableVibration: true,
      ),
    );

    await androidPlugin?.createNotificationChannel(
      const AndroidNotificationChannel(
        'tokaura_reminders_v2',
        'تذكيرات TokAura',
        description: 'تذكير المستخدم بالعودة إلى TokAura',
        importance: Importance.defaultImportance,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('notify'),
        enableVibration: true,
      ),
    );
  }

  Future<void> show(String title, String body) async {
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'tokaura_general_v2',
        'إشعارات TokAura',
        channelDescription: 'الإشعارات المهمة من TokAura',
        importance: Importance.high,
        priority: Priority.high,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('notify'),
        enableVibration: true,
      ),
    );

    await plugin.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      details,
    );
  }

  Future<void> scheduleReminder({int hours = 24}) async {
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'tokaura_reminders_v2',
        'تذكيرات TokAura',
        channelDescription: 'تذكير المستخدم بالعودة إلى TokAura',
        importance: Importance.defaultImportance,
        priority: Priority.defaultPriority,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('notify'),
        enableVibration: true,
      ),
    );

    final when =
        tz.TZDateTime.now(tz.local).add(Duration(hours: hours));

    await plugin.zonedSchedule(
      8001,
      'اشتقنا لك في TokAura 👋',
      'عد للتطبيق واجمع نقاطك وأكمل مهامك اليومية.',
      when,
      details,
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
      matchDateTimeComponents: null,
    );
  }
}
