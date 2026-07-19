import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../config/app_config.dart';
import '../services/api_client.dart';

class SocketService {
  SocketService._();
  static final SocketService instance = SocketService._();
  IO.Socket? socket;

  void connect(String accessToken) {
    socket?.dispose();
    socket = IO.io(
      AppConfig.socketUrl,
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': accessToken})
          .build(),
    )..connect();

    socket!.onConnect((_) {
      // server expects userId via 'identity' event after auth handshake
      _identify();
    });
    socket!.on('notification', (_) {});
    socket!.on('campaign:progress', (_) {});
    socket!.on('campaign:update',   (_) {});
  }

  void _identify() async {
    final token = await ApiClient.instance.storage.read(key: 'accessToken');
    if (token == null) return;
  }

  void joinCampaign(String id) => socket?.emit('campaign:join', id);
  void dispose() { socket?.dispose(); socket = null; }
}
