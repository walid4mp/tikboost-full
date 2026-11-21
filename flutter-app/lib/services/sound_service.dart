import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Polished in-app sound + haptics system.
///
/// * Every effect has its own small player pool so rapid sounds (wheel ticks,
///   taps) never cut each other off.
/// * Sounds and vibration can be switched off independently from Settings and
///   the choice is persisted.
class SoundService {
  SoundService._();
  static final instance = SoundService._();

  static const _kSound = 'sound_enabled';
  static const _kHaptics = 'haptics_enabled';

  final List<AudioPlayer> _ui = List.generate(3, (_) => AudioPlayer());
  final List<AudioPlayer> _ticks = List.generate(6, (_) => AudioPlayer());
  bool enabled = true;
  bool hapticsEnabled = true;
  bool _ready = false;
  DateTime? _lastTapAt;
  DateTime? _lastTickAt;
  int _uiIndex = 0;
  int _tickIndex = 0;
  int _tickVariant = 0;

  /// Reads the saved preferences and prepares the players. Safe to call twice.
  Future<void> load() async {
    if (_ready) return;
    try {
      final p = await SharedPreferences.getInstance();
      enabled = p.getBool(_kSound) ?? true;
      hapticsEnabled = p.getBool(_kHaptics) ?? true;
      for (final player in [..._ui, ..._ticks]) {
        await player.setReleaseMode(ReleaseMode.stop);
        await player.setPlayerMode(PlayerMode.lowLatency);
      }
    } catch (_) {}
    _ready = true;
  }

  Future<void> setEnabled(bool value) async {
    enabled = value;
    try {
      final p = await SharedPreferences.getInstance();
      await p.setBool(_kSound, value);
    } catch (_) {}
  }

  Future<void> setHaptics(bool value) async {
    hapticsEnabled = value;
    try {
      final p = await SharedPreferences.getInstance();
      await p.setBool(_kHaptics, value);
    } catch (_) {}
  }

  Future<void> play(String asset, {double volume = .75}) async {
    if (!enabled) return;
    final player = _ui[_uiIndex++ % _ui.length];
    try {
      await player.stop();
      await player.play(AssetSource('audio/$asset'), volume: volume, mode: PlayerMode.lowLatency);
    } catch (_) {}
  }

  void _haptic(Future<void> Function() fn) {
    if (!hapticsEnabled) return;
    try {
      fn();
    } catch (_) {}
  }

  Future<void> playTap() async {
    final now = DateTime.now();
    if (_lastTapAt != null && now.difference(_lastTapAt!) < const Duration(milliseconds: 90)) return;
    _lastTapAt = now;
    _haptic(HapticFeedback.selectionClick);
    await play('tap.wav', volume: .55);
  }

  Future<void> playNotification() => play('notify.wav', volume: .85);
  Future<void> playSuccess() {
    _haptic(HapticFeedback.heavyImpact);
    return play('wheel_win.wav', volume: .95);
  }

  Future<void> playCoin() => play('coin.wav', volume: .8);
  Future<void> playLevelUp() {
    _haptic(HapticFeedback.heavyImpact);
    return play('level_up.wav', volume: .95);
  }

  Future<void> playError() {
    _haptic(HapticFeedback.vibrate);
    return play('error.wav', volume: .6);
  }

  Future<void> playSpinStart() {
    _haptic(HapticFeedback.mediumImpact);
    return play('spin_start.wav', volume: .7);
  }

  Future<void> playWheelNoWin() => play('wheel_nowin.wav', volume: .7);

  /// One wheel "tick" as the pointer passes a divider. Rate limited so very
  /// fast spins stay pleasant instead of turning into noise.
  Future<void> playWheelTick({double speed = 1}) async {
    if (!enabled && !hapticsEnabled) return;
    final now = DateTime.now();
    if (_lastTickAt != null && now.difference(_lastTickAt!) < const Duration(milliseconds: 38)) return;
    _lastTickAt = now;
    _haptic(HapticFeedback.selectionClick);
    if (!enabled) return;
    const files = ['spin_tick_1.wav', 'spin_tick_2.wav', 'spin_tick_3.wav'];
    final player = _ticks[_tickIndex++ % _ticks.length];
    try {
      await player.stop();
      await player.play(
        AssetSource('audio/${files[_tickVariant++ % files.length]}'),
        volume: (.22 + .18 * speed.clamp(0.0, 1.0)).toDouble(),
        mode: PlayerMode.lowLatency,
      );
    } catch (_) {}
  }

  Future<void> dispose() async {
    for (final player in [..._ui, ..._ticks]) {
      await player.dispose();
    }
  }
}
