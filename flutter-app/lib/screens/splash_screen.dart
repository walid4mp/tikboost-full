import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart' hide Text;
import '../i18n/tr_text.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../providers/auth_provider.dart';
import '../services/push_notification_service.dart';

/// Cinematic splash screen.
///
/// Everything here is drawn in Flutter (no baked screenshot): an aurora
/// backdrop with twinkling particles, a logo reveal with a shock-wave ring,
/// rotating light rays and a light sweep, a staggered feature row, and a
/// progress bar that is tied to the *real* start-up work (auth bootstrap)
/// instead of a fake fixed percentage.
///
/// Navigation waits for both the intro animation and the auth bootstrap, so a
/// signed-in user goes straight to /home without flashing the login screen.
/// A first-time visitor is sent to /welcome (previously unreachable).
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with TickerProviderStateMixin {
  static const _bg = Color(0xFF030514);
  static const _violet = Color(0xFF8B3DFF);
  static const _magenta = Color(0xFFFF3DB8);
  static const _blue = Color(0xFF2D7BFF);
  static const _cyan = Color(0xFF22D3EE);

  static const _maxWait = Duration(seconds: 9);

  late final AnimationController _intro;
  late final AnimationController _ambient;
  late final AnimationController _finish;
  late final AnimationController _exit;
  late final List<_Star> _stars;

  Timer? _poll;
  Timer? _hardTimeout;
  bool _finishing = false;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    unawaited(SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky));

    final reduceMotion = WidgetsBinding
        .instance.platformDispatcher.accessibilityFeatures.disableAnimations;

    _intro = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: reduceMotion ? 900 : 4200),
    )..forward();
    _ambient = AnimationController(vsync: this, duration: const Duration(seconds: 60))
      ..repeat();
    _finish = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));
    _exit = AnimationController(vsync: this, duration: const Duration(milliseconds: 520));
    _stars = _Star.generate(78, math.Random(7));

    _poll = Timer.periodic(const Duration(milliseconds: 120), (_) => _checkReady());
    _hardTimeout = Timer(_maxWait, _finishAndGo);
  }

  void _checkReady() {
    if (!mounted || _finishing) return;
    if (_intro.isCompleted && ref.read(authProvider).bootstrapped) {
      _finishAndGo();
    }
  }

  Future<void> _finishAndGo() async {
    if (!mounted || _finishing) return;
    _finishing = true;
    _poll?.cancel();
    _hardTimeout?.cancel();
    await _finish.forward();
    if (!mounted) return;
    await _exit.forward();
    if (!mounted) return;
    await _go();
  }

  Future<void> _go() async {
    if (!mounted || _navigated) return;
    _navigated = true;
    final auth = ref.read(authProvider).state;
    unawaited(SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge));

    String target;
    if (auth.loggedIn) {
      target = '/home';
    } else {
      var welcomeSeen = true;
      try {
        final prefs = await SharedPreferences.getInstance();
        welcomeSeen = prefs.getBool('tikboost_welcome_seen_v1') ?? false;
      } catch (_) {
        // If preferences are unavailable, skip the welcome page.
      }
      target = welcomeSeen ? '/login' : '/welcome';
    }
    if (!mounted) return;
    context.go(target);

    if (auth.loggedIn) {
      // The user tapped a push notification that launched the app.
      Future<void>.delayed(const Duration(milliseconds: 350), () {
        PushNotificationService.instance.flushPendingOpen();
      });
    }
  }

  @override
  void dispose() {
    _poll?.cancel();
    _hardTimeout?.cancel();
    _intro.dispose();
    _ambient.dispose();
    _finish.dispose();
    _exit.dispose();
    unawaited(SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge));
    super.dispose();
  }

  static Color _a(Color c, double opacity) =>
      c.withAlpha((opacity.clamp(0.0, 1.0) * 255).round());

  /// Maps the controller value to a sub-interval with an easing curve.
  double _seg(double a, double b, [Curve curve = Curves.easeOutCubic]) {
    final t = ((_intro.value - a) / (b - a)).clamp(0.0, 1.0);
    return curve.transform(t);
  }

  double _progressValue() {
    if (_finish.value > 0) return 0.92 + 0.08 * _finish.value;
    final base = _intro.value * 0.9;
    if (_intro.isCompleted) {
      // Intro is over but the app is still starting: creep slowly, never lie.
      final wait = (_ambient.value * 60) % 6; // 0..6 s sawtooth
      return 0.9 + 0.02 * (wait / 6);
    }
    return base;
  }

  String _statusText(double p) {
    if (p >= 0.995) return 'جاهز! 🚀';
    if (p < 0.34) return 'جاري تجهيز تجربتك…';
    if (p < 0.7) return 'تأمين الاتصال…';
    return 'تحميل بياناتك…';
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final logoSize = math.min(size.width * 0.66, 310.0);

    return Scaffold(
      backgroundColor: _bg,
      body: AnimatedBuilder(
        animation: Listenable.merge([_intro, _ambient, _finish, _exit]),
        builder: (context, _) {
          final exit = Curves.easeInCubic.transform(_exit.value);
          final progress = _progressValue();

          return Stack(
            fit: StackFit.expand,
            children: [
              // Backdrop: gradient + aurora + stars.
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0xFF0B0426), Color(0xFF050818), _bg],
                    stops: [0.0, 0.45, 1.0],
                  ),
                ),
              ),
              CustomPaint(
                painter: _BackdropPainter(
                  p: _ambient.value,
                  stars: _stars,
                  fadeIn: _seg(0.0, 0.25),
                ),
              ),
              // Foreground content (fades / zooms out on exit).
              Opacity(
                opacity: (1 - exit).clamp(0.0, 1.0),
                child: Transform.scale(
                  scale: 1 + 0.18 * exit,
                  child: SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 22),
                      child: Column(
                        children: [
                          const Spacer(flex: 5),
                          _buildLogo(logoSize),
                          const SizedBox(height: 26),
                          _buildTagline(),
                          const Spacer(flex: 3),
                          _buildChips(),
                          const SizedBox(height: 30),
                          _buildProgress(progress),
                          const SizedBox(height: 30),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildLogo(double size) {
    final reveal = _seg(0.04, 0.40, Curves.easeOutBack);
    final fade = _seg(0.04, 0.24, Curves.easeOut);
    final ring = _seg(0.10, 0.55, Curves.easeOutCubic);
    final ring2 = _seg(0.20, 0.65, Curves.easeOutCubic);
    final sweep = _seg(0.42, 0.70, Curves.easeInOut);
    final pulse = 0.5 + 0.5 * math.sin(2 * math.pi * _ambient.value * 30);
    final float = math.sin(2 * math.pi * _ambient.value * 20) * 5;
    final canvas = size * 1.75;

    return SizedBox(
      width: canvas,
      height: size * 1.25,
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          // Rotating light rays.
          Opacity(
            opacity: fade,
            child: CustomPaint(
              size: Size(canvas, canvas),
              painter: _RaysPainter(angle: 2 * math.pi * _ambient.value * 2),
            ),
          ),
          // Soft neon glow that breathes.
          Opacity(
            opacity: fade,
            child: Container(
              width: size * 1.35,
              height: size * 1.35,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    _a(_violet, 0.50 + 0.18 * pulse),
                    _a(_blue, 0.20 + 0.08 * pulse),
                    Colors.transparent,
                  ],
                  stops: const [0.0, 0.55, 1.0],
                ),
              ),
            ),
          ),
          // Shock-wave rings.
          CustomPaint(
            size: Size(canvas, canvas),
            painter: _RingPainter(
              radius: size,
              t1: ring,
              t2: ring2,
              c1: _cyan,
              c2: _magenta,
            ),
          ),
          // The logo itself with a light sweep.
          Transform.translate(
            offset: Offset(0, float),
            child: Opacity(
              opacity: fade,
              child: Transform.scale(
                scale: 0.55 + 0.45 * reveal,
                child: ShaderMask(
                  blendMode: BlendMode.srcATop,
                  shaderCallback: (rect) => LinearGradient(
                    begin: Alignment(-2.2 + 4.4 * sweep, -0.5),
                    end: Alignment(-1.2 + 4.4 * sweep, 0.5),
                    colors: [
                      Colors.transparent,
                      _a(Colors.white, 0.55),
                      Colors.transparent,
                    ],
                    stops: const [0.30, 0.5, 0.70],
                  ).createShader(rect),
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(size * 0.22),
                      boxShadow: [
                        BoxShadow(
                          color: _a(_magenta, 0.35 + 0.15 * pulse),
                          blurRadius: 46,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: Image.asset(
                      'assets/icons/tikboost_wh_master_icon.png',
                      width: size,
                      height: size,
                      cacheWidth: 720,
                      filterQuality: FilterQuality.high,
                      gaplessPlayback: true,
                      errorBuilder: (_, __, ___) => SizedBox(
                        width: size,
                        height: size,
                        child: const Center(
                          child: Text(
                            'tikboost.wh',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 34,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTagline() {
    final t = _seg(0.46, 0.72);
    return Opacity(
      opacity: t,
      child: Transform.translate(
        offset: Offset(0, 16 * (1 - t)),
        child: ShaderMask(
          shaderCallback: (rect) => const LinearGradient(
            colors: [_cyan, Colors.white, _magenta],
          ).createShader(rect),
          blendMode: BlendMode.srcIn,
          child: Text(
            'تفاعل أكثر  •  اربح أكثر  •  انمُ معنا',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.4 + 2.6 * (1 - t),
              color: Colors.white,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildChips() {
    const items = <_ChipData>[
      _ChipData(Icons.group_add_rounded, 'متابعون', 'حقيقيون', _blue),
      _ChipData(Icons.card_giftcard_rounded, 'مكافآت', 'يومية', _magenta),
      _ChipData(Icons.verified_user_rounded, 'دفع آمن', 'Google Play', _cyan),
      _ChipData(Icons.bolt_rounded, 'مهام', 'سهلة وبسيطة', Color(0xFFFFB020)),
    ];
    return Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: 9),
          Expanded(child: _buildChip(items[i], i)),
        ],
      ],
    );
  }

  Widget _buildChip(_ChipData d, int index) {
    final start = 0.56 + index * 0.07;
    final t = _seg(start, math.min(1.0, start + 0.22));
    return Opacity(
      opacity: t,
      child: Transform.translate(
        offset: Offset(0, 22 * (1 - t)),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 4),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: _a(Colors.white, 0.05),
            border: Border.all(color: _a(d.color, 0.38)),
            boxShadow: [BoxShadow(color: _a(d.color, 0.14), blurRadius: 16)],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(d.icon, color: d.color, size: 25),
              const SizedBox(height: 6),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  d.title,
                  maxLines: 1,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(height: 2),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  d.subtitle,
                  maxLines: 1,
                  style: TextStyle(color: _a(Colors.white, 0.55), fontSize: 10),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProgress(double progress) {
    final t = _seg(0.60, 0.85);
    final shimmer = (_ambient.value * 60 * 0.8) % 1.0;
    return Opacity(
      opacity: t,
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 260),
                  child: Align(
                    key: ValueKey(_statusText(progress)),
                    alignment: AlignmentDirectional.centerStart,
                    child: Text(
                      _statusText(progress),
                      style: TextStyle(
                        color: _a(Colors.white, 0.72),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
              Text(
                '${(progress * 100).round()}%',
                textDirection: TextDirection.ltr,
                style: const TextStyle(
                  color: _cyan,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 9),
          LayoutBuilder(
            builder: (context, c) {
              final fill = c.maxWidth * progress.clamp(0.0, 1.0);
              return Stack(
                children: [
                  Container(
                    height: 7,
                    decoration: BoxDecoration(
                      color: _a(Colors.white, 0.09),
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  PositionedDirectional(
                    start: 0,
                    child: Container(
                      width: fill,
                      height: 7,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        gradient: const LinearGradient(colors: [_violet, _magenta, _cyan]),
                        boxShadow: [BoxShadow(color: _a(_magenta, 0.55), blurRadius: 12)],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: FractionallySizedBox(
                          alignment: Alignment(-1 + 2 * shimmer, 0),
                          widthFactor: 0.28,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Colors.transparent,
                                  _a(Colors.white, 0.55),
                                  Colors.transparent,
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _ChipData {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  const _ChipData(this.icon, this.title, this.subtitle, this.color);
}

class _Star {
  final double x;
  final double y;
  final double radius;
  final double speed; // full heights per minute (integer => seamless loop)
  final double twinkle; // cycles per minute (integer => seamless loop)
  final double phase;
  final Color color;

  const _Star(this.x, this.y, this.radius, this.speed, this.twinkle, this.phase, this.color);

  static List<_Star> generate(int count, math.Random rng) {
    const palette = [
      Color(0xFFFFFFFF),
      Color(0xFFC4B5FD),
      Color(0xFF93C5FD),
      Color(0xFFF9A8D4),
    ];
    return List.generate(count, (_) {
      return _Star(
        rng.nextDouble(),
        rng.nextDouble(),
        0.6 + rng.nextDouble() * 1.9,
        (1 + rng.nextInt(3)).toDouble(),
        (6 + rng.nextInt(16)).toDouble(),
        rng.nextDouble() * 2 * math.pi,
        palette[rng.nextInt(palette.length)],
      );
    });
  }
}

/// Aurora blobs + drifting, twinkling stars. `p` is 0..1 over 60 seconds and
/// every motion uses an integer number of cycles so the loop has no jump.
class _BackdropPainter extends CustomPainter {
  final double p;
  final List<_Star> stars;
  final double fadeIn;

  _BackdropPainter({required this.p, required this.stars, required this.fadeIn});

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final tau = 2 * math.pi;

    void blob(Offset c, double r, Color color, double alpha) {
      final rect = Rect.fromCircle(center: c, radius: r);
      final paint = Paint()
        ..shader = RadialGradient(
          colors: [color.withAlpha((alpha * fadeIn * 255).round()), Colors.transparent],
        ).createShader(rect);
      canvas.drawCircle(c, r, paint);
    }

    blob(Offset(w * (0.20 + 0.14 * math.sin(tau * p * 3)), h * (0.24 + 0.06 * math.cos(tau * p * 4))),
        w * 0.85, const Color(0xFF7C3AED), 0.36);
    blob(Offset(w * (0.86 + 0.10 * math.cos(tau * p * 3)), h * (0.46 + 0.08 * math.sin(tau * p * 3))),
        w * 0.80, const Color(0xFFEC4899), 0.20);
    blob(Offset(w * (0.50 + 0.22 * math.sin(tau * p * 2)), h * (0.90 + 0.03 * math.cos(tau * p * 5))),
        w * 1.00, const Color(0xFF2563EB), 0.26);

    final seconds = p * 60;
    for (final s in stars) {
      var y = (s.y - seconds * s.speed / 60) % 1.0;
      if (y < 0) y += 1.0;
      final tw = 0.5 + 0.5 * math.sin(tau * s.twinkle * p + s.phase);
      final alpha = (0.18 + 0.82 * tw) * fadeIn;
      final paint = Paint()..color = s.color.withAlpha((alpha * 255).round());
      final c = Offset(s.x * w, y * h);
      canvas.drawCircle(c, s.radius, paint);
      if (s.radius > 1.9) {
        canvas.drawCircle(
          c,
          s.radius * 3.2,
          Paint()..color = s.color.withAlpha((alpha * 38).round()),
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _BackdropPainter old) => old.p != p || old.fadeIn != fadeIn;
}

/// Slowly rotating beams of light behind the logo, faded out toward the edge.
class _RaysPainter extends CustomPainter {
  final double angle;
  const _RaysPainter({required this.angle});

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2;
    final rect = Rect.fromCircle(center: c, radius: r);

    canvas.saveLayer(rect, Paint());
    final beams = Paint()
      ..shader = SweepGradient(
        transform: GradientRotation(angle),
        colors: [
          Colors.transparent,
          const Color(0x338B3DFF),
          Colors.transparent,
          const Color(0x2622D3EE),
          Colors.transparent,
          const Color(0x33FF3DB8),
          Colors.transparent,
          const Color(0x268B3DFF),
          Colors.transparent,
          const Color(0x3322D3EE),
          Colors.transparent,
        ],
      ).createShader(rect);
    canvas.drawCircle(c, r, beams);
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..blendMode = BlendMode.dstIn
        ..shader = const RadialGradient(
          colors: [Colors.white, Colors.transparent],
          stops: [0.18, 1.0],
        ).createShader(rect),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _RaysPainter old) => old.angle != angle;
}

/// Two expanding neon rings (shock-wave) emitted when the logo appears.
class _RingPainter extends CustomPainter {
  final double radius;
  final double t1;
  final double t2;
  final Color c1;
  final Color c2;

  const _RingPainter({
    required this.radius,
    required this.t1,
    required this.t2,
    required this.c1,
    required this.c2,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);

    void ring(double t, Color color) {
      if (t <= 0 || t >= 1) return;
      final r = radius * (0.34 + 0.95 * t);
      final alpha = (1 - t) * 0.65;
      canvas.drawCircle(
        c,
        r,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3.2 * (1 - t) + 0.6
          ..color = color.withAlpha((alpha * 255).round())
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2.5),
      );
    }

    ring(t1, c1);
    ring(t2, c2);
  }

  @override
  bool shouldRepaint(covariant _RingPainter old) => old.t1 != t1 || old.t2 != t2 || old.radius != radius;
}
