import 'package:audioplayers/audioplayers.dart';

class SoundService {
  SoundService._();
  static final instance = SoundService._();
  final AudioPlayer _player = AudioPlayer();
  bool enabled = true;

  Future<void> play(String asset) async {
    if (!enabled) return;
    try {
      await _player.stop();
      await _player.play(AssetSource('audio/$asset'), volume: .75);
    } catch (_) {}
  }

  Future<void> dispose() => _player.dispose();
}
