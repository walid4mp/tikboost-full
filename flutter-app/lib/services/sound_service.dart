import 'package:audioplayers/audioplayers.dart';

/// Polished in-app sound system. Wheel ticks use a tiny player pool so one
/// tick does not stop the previous tick (the old behaviour felt like vibration).
class SoundService {
  SoundService._();
  static final instance = SoundService._();

  final AudioPlayer _uiPlayer = AudioPlayer();
  final List<AudioPlayer> _wheelPlayers = List.generate(4, (_) => AudioPlayer());
  bool enabled = true;
  DateTime? _lastTapAt;
  int _wheelTickIndex = 0;
  int _wheelPlayerIndex = 0;

  Future<void> play(String asset, {double volume = .75}) async {
    if (!enabled) return;
    try {
      await _uiPlayer.stop();
      await _uiPlayer.play(AssetSource('audio/$asset'), volume: volume);
    } catch (_) {}
  }

  Future<void> playTap() async {
    final now = DateTime.now();
    if (_lastTapAt != null && now.difference(_lastTapAt!) < const Duration(milliseconds: 100)) return;
    _lastTapAt = now;
    await play('tap.wav', volume: .50);
  }

  Future<void> playNotification() => play('notify.wav', volume: .82);
  Future<void> playSuccess() => play('wheel_win.wav', volume: .92);

  Future<void> playWheelTick() async {
    if (!enabled) return;
    const files = ['spin_tick_1.wav', 'spin_tick_2.wav', 'spin_tick_3.wav'];
    final player = _wheelPlayers[_wheelPlayerIndex % _wheelPlayers.length];
    _wheelPlayerIndex++;
    try {
      await player.stop();
      await player.play(AssetSource('audio/${files[_wheelTickIndex % files.length]}'), volume: .32);
      _wheelTickIndex++;
    } catch (_) {}
  }

  Future<void> playWheelNoWin() => play('notify.wav', volume: .65);

  Future<void> dispose() async {
    await _uiPlayer.dispose();
    for (final player in _wheelPlayers) {
      await player.dispose();
    }
  }
}
