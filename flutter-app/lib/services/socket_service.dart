import 'dart:convert';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../config/app_config.dart';
import 'local_notification_service.dart';
import 'sound_service.dart';

class SocketService {
  SocketService._();
  static final SocketService instance = SocketService._();
  io.Socket? socket;

  void connect(String accessToken) {
    socket?.dispose();
    socket = io.io(
      AppConfig.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': accessToken})
          .enableReconnection()
          .build(),
    )..connect();

    socket!.onConnect((_) {
      final userId = _readUserId(accessToken);
      if (userId != null) {
        socket?.emit('identity', userId);
      }
    });
    socket!.on('notification', (payload) async {
      final data = payload is Map ? Map<String, dynamic>.from(payload) : const <String, dynamic>{};
      final title = '${data['title'] ?? 'TokAura'}';
      final body = '${data['body'] ?? ''}';
      await SoundService.instance.playNotification();
      await LocalNotificationService.instance.show(title, body);
    });
    socket!.on('campaign:progress', (_) {});
    socket!.on('campaign:update', (_) {});
  }

  String? _readUserId(String accessToken) {
    try {
      final parts = accessToken.split('.');
      if (parts.length != 3) return null;
      final normalized = base64Url.normalize(parts[1]);
      final payload = jsonDecode(utf8.decode(base64Url.decode(normalized)));
      return payload['sub']?.toString();
    } catch (_) {
      return null;
    }
  }

  void joinCampaign(String id) => socket?.emit('campaign:join', id);

  void dispose() {
    socket?.dispose();
    socket = null;
  }
}
