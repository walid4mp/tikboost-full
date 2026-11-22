import 'package:flutter/services.dart';

/// Single owner for the full-screen (immersive) system UI mode.
///
/// Problem this fixes: GoRouter builds the next page *before* the previous one
/// is disposed. The splash screen used to restore the status bar in `dispose`,
/// which ran after the welcome screen had already hidden it, so the status bar
/// came back on top of the welcome artwork. Now only the screen that currently
/// owns immersive mode may restore the bars.
class ImmersiveMode {
  ImmersiveMode._();
  static Object? _owner;

  /// Hides the status and navigation bars (swipe from the edge shows them
  /// temporarily and they hide again).
  static void enter(Object owner) {
    _owner = owner;
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  /// Restores the bars only if [owner] still owns immersive mode. When another
  /// full-screen page took over in the meantime this does nothing.
  static void leave(Object owner) {
    if (!identical(_owner, owner)) return;
    _owner = null;
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  }

  /// Unconditionally restores the bars (used right before entering the app).
  static void restore() {
    _owner = null;
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  }
}
