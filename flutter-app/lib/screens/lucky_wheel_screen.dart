import 'dart:async';
import 'dart:math';

import 'package:confetti/confetti.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_theme.dart';
import '../i18n/tr_text.dart';
import '../providers/auth_provider.dart';
import '../services/admob_service.dart';
import '../services/api_client.dart';
import '../services/rewards_repository.dart';
import '../services/sound_service.dart';

/// Constant-speed "free spin" used while we wait for the server result, so the
/// wheel starts moving the instant the button is pressed (no dead time).
class _FreeSpin extends Simulation {
  static const double cruise = 1.7; // turns / second
  static const double ramp = .55; // seconds to reach cruising speed

  @override
  double x(double time) => time < ramp
      ? cruise * time * time / (2 * ramp)
      : cruise * ramp / 2 + cruise * (time - ramp);

  @override
  double dx(double time) => time < ramp ? cruise * time / ramp : cruise;

  @override
  bool isDone(double time) => false;
}

enum _Phase { idle, free, settle }

class LuckyWheelScreen extends ConsumerStatefulWidget {
  const LuckyWheelScreen({super.key});

  @override
  ConsumerState<LuckyWheelScreen> createState() => _LuckyWheelScreenState();
}

class _LuckyWheelScreenState extends ConsumerState<LuckyWheelScreen> with TickerProviderStateMixin {
  List<dynamic> prizes = const [];
  Map<String, dynamic> rewards = const {};
  int confettiThreshold = 1000;
  bool loading = true;
  bool loadFailed = false;
  bool spinning = false;
  bool watchingExtraAd = false;

  // --- wheel animation state -------------------------------------------------
  final Random _rng = Random();
  late final AnimationController _free = AnimationController.unbounded(vsync: this);
  late final AnimationController _settle = AnimationController(vsync: this, duration: const Duration(milliseconds: 4300));
  late final AnimationController _kick = AnimationController(vsync: this, duration: const Duration(milliseconds: 170));
  late final ConfettiController _confetti = ConfettiController(duration: const Duration(seconds: 3));
  _Phase _phase = _Phase.idle;
  double _base = 0; // resting rotation in radians (clockwise)
  double _settleFrom = 0;
  double _settleTo = 0;
  int _lastTickIndex = -1;
  double _lastTheta = 0;
  DateTime _lastFrameAt = DateTime.now();
  double _speed = 0; // normalised 0..1, drives tick volume

  double get _theta {
    switch (_phase) {
      case _Phase.idle:
        return _base;
      case _Phase.free:
        return _base + _free.value * 2 * pi;
      case _Phase.settle:
        return _settleFrom + (_settleTo - _settleFrom) * Curves.easeOutCubic.transform(_settle.value);
    }
  }

  @override
  void initState() {
    super.initState();
    _free.addListener(_onFrame);
    _settle.addListener(_onFrame);
    load();
  }

  @override
  void dispose() {
    _free.dispose();
    _settle.dispose();
    _kick.dispose();
    _confetti.dispose();
    super.dispose();
  }

  // --- data ------------------------------------------------------------------
  Future<void> load() async {
    try {
      final r = await ApiClient.instance.dio.get('/wheel/prizes');
      if (!mounted) return;
      setState(() {
        prizes = List<dynamic>.from(r.data['prizes'] ?? const []);
        rewards = Map<String, dynamic>.from(r.data['rewards'] ?? const {});
        confettiThreshold = int.tryParse('${r.data['confettiThreshold'] ?? 1000}') ?? 1000;
        loadFailed = false;
      });
    } catch (_) {
      if (mounted) setState(() => loadFailed = true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  int _int(dynamic v) => int.tryParse('${v ?? 0}') ?? 0;

  // --- animation helpers -------------------------------------------------------
  double get _segment => 2 * pi / max(prizes.length, 1);

  int _indexUnderPointer(double theta) {
    if (prizes.isEmpty) return 0;
    var local = (-theta) % (2 * pi);
    if (local < 0) local += 2 * pi;
    return (local / _segment).floor() % prizes.length;
  }

  void _onFrame() {
    if (_phase == _Phase.idle || prizes.isEmpty) return;
    final theta = _theta;
    final now = DateTime.now();
    final dt = now.difference(_lastFrameAt).inMicroseconds / 1e6;
    if (dt > 0) {
      final turnsPerSec = ((theta - _lastTheta).abs() / (2 * pi)) / dt;
      _speed = (turnsPerSec / 1.8).clamp(0.0, 1.0).toDouble();
    }
    _lastFrameAt = now;
    _lastTheta = theta;
    final idx = _indexUnderPointer(theta);
    if (idx != _lastTickIndex) {
      if (_lastTickIndex != -1) {
        SoundService.instance.playWheelTick(speed: _speed);
        _kick.forward(from: 0);
      }
      _lastTickIndex = idx;
    }
    if (mounted) setState(() {});
  }

  void _startFree() {
    _phase = _Phase.free;
    _lastTickIndex = _indexUnderPointer(_base);
    _lastTheta = _base;
    _lastFrameAt = DateTime.now();
    _free.value = 0;
    _free.animateWith(_FreeSpin());
  }

  /// Smoothly decelerates from wherever the wheel is to a gentle stop (used
  /// when the request fails).
  Future<void> _coastToStop() async {
    final from = _theta;
    _free.stop();
    _settleFrom = from;
    _settleTo = from + 2 * pi * .8;
    _phase = _Phase.settle;
    _settle.duration = const Duration(milliseconds: 1100);
    await _settle.forward(from: 0);
    _base = _settleTo;
    _phase = _Phase.idle;
    _settle.duration = const Duration(milliseconds: 4300);
  }

  Future<void> _landOn(int prizeIndex) async {
    final from = _theta;
    _free.stop();
    final seg = _segment;
    final center = (prizeIndex + .5) * seg;
    var need = (-center) % (2 * pi);
    if (need < 0) need += 2 * pi;
    var cur = from % (2 * pi);
    if (cur < 0) cur += 2 * pi;
    var delta = (need - cur) % (2 * pi);
    if (delta < 0) delta += 2 * pi;
    final jitter = (_rng.nextDouble() - .5) * seg * .56; // stays inside the slice
    _settleFrom = from;
    _settleTo = from + delta + 2 * pi * 2 + jitter;
    _phase = _Phase.settle;
    await _settle.forward(from: 0);
    _base = _settleTo;
    _phase = _Phase.idle;
    if (mounted) setState(() {});
  }

  // --- actions -----------------------------------------------------------------
  Future<void> _watchExtraSpinAd() async {
    if (spinning || watchingExtraAd) return;
    final wheel = Map<String, dynamic>.from(rewards['wheel'] ?? const {});
    final remaining = _int(wheel['extraEarnedRemaining']);
    if (remaining <= 0) {
      _showMessage('لقد وصلت إلى الحد الأقصى لللفات الإضافية اليوم.');
      return;
    }
    if (!AdMobService.instance.rewardedEnabled) {
      _showMessage('الإعلانات بالمكافأة غير مفعّلة حالياً.');
      return;
    }

    setState(() => watchingExtraAd = true);
    try {
      final session = await RewardsRepository.instance.startExtraSpinAd();
      final rewarded = await AdMobService.instance.showRewardedAd();
      if (!rewarded) {
        _showMessage('لم يكتمل الإعلان، لذلك لم تتم إضافة اللفة.');
        return;
      }
      await RewardsRepository.instance.claimExtraSpinAd('${session['sessionId']}');
      await load();
      SoundService.instance.playCoin();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        backgroundColor: AppColors.success,
        content: const Text('تمت إضافة لفة إضافية 🎁'),
      ));
    } catch (e) {
      _showMessage(_errorText(e, 'تعذر الحصول على اللفة الإضافية'));
    } finally {
      if (mounted) setState(() => watchingExtraAd = false);
    }
  }

  String _errorText(Object e, String fallback) {
    if (e is DioException) {
      final data = e.response?.data;
      final msg = data is Map ? '${data['message'] ?? ''}'.trim() : '';
      if (msg.isNotEmpty) return msg;
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.connectionError) {
        return 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.';
      }
    }
    return fallback;
  }

  void _showMessage(String message) {
    if (!mounted) return;
    SoundService.instance.playError();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(backgroundColor: AppColors.red, content: Text(message)),
    );
  }

  Future<void> spin({bool useExtraSpin = false}) async {
    if (spinning || prizes.isEmpty) return;
    setState(() => spinning = true);
    SoundService.instance.playSpinStart();
    _startFree();

    Map<String, dynamic> data;
    try {
      final r = await ApiClient.instance.dio.post(
        '/wheel/spin',
        data: {'useExtraSpin': useExtraSpin},
        options: Options(receiveTimeout: const Duration(seconds: 45)),
      );
      data = Map<String, dynamic>.from(r.data as Map);
    } catch (e) {
      await _coastToStop();
      if (mounted) setState(() => spinning = false);
      _showMessage(_errorText(e, 'فشل الدوران'));
      return;
    }

    try {
      final prize = Map<String, dynamic>.from(data['prize'] as Map);
      var index = prizes.indexWhere((p) => '${p['id']}' == '${prize['id']}');
      if (index < 0) index = 0;
      if (mounted) {
        setState(() => rewards = Map<String, dynamic>.from(data['rewards'] ?? rewards));
      }

      await _landOn(index);

      final points = _int(data['points'] ?? prize['points']);
      final label = '${prize['label'] ?? ''}'.trim();
      final big = data['confetti'] == true || (points > 0 && points >= confettiThreshold);

      if (points > 0) {
        SoundService.instance.playSuccess();
        if (big && mounted) _confetti.play();
      } else {
        SoundService.instance.playWheelNoWin();
      }

      unawaited(ref.read(authProvider).refreshCurrentUser().catchError((_) {}));
      if (!mounted) return;
      await _showResultDialog(label: label, points: points);
    } catch (_) {
      _showMessage('فشل الدوران');
    } finally {
      if (mounted) setState(() => spinning = false);
    }
  }

  Future<void> _showResultDialog({required String label, required int points}) async {
    final won = points > 0;
    final retry = label.contains('حاول') || label.toLowerCase().contains('try');
    final title = won
        ? '🎉 مبروك!'
        : retry
            ? '✨ حاول مجددًا'
            : '💫 هذه المرة لم تربح';
    final body = won
        ? 'حصلت على $points نقطة'
        : retry
            ? 'حظك في اللفة القادمة قد يكون أفضل.'
            : 'لم تحصل على نقاط في هذه اللفة. حاول مرة أخرى لاحقًا.';

    await showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (dialogContext) => Dialog(
        backgroundColor: const Color(0xff111827),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween(begin: .4, end: 1),
                duration: const Duration(milliseconds: 520),
                curve: Curves.elasticOut,
                builder: (_, v, child) => Transform.scale(scale: v, child: child),
                child: Container(
                  width: 82,
                  height: 82,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: won
                          ? [const Color(0xffffd166), const Color(0xffff7a00)]
                          : [const Color(0xff64748b), const Color(0xff334155)],
                    ),
                    boxShadow: [BoxShadow(color: (won ? Colors.orange : Colors.blueGrey).withValues(alpha: .28), blurRadius: 28)],
                  ),
                  child: Icon(won ? Icons.workspace_premium_rounded : (retry ? Icons.refresh_rounded : Icons.sentiment_neutral_rounded), size: 44, color: Colors.white),
                ),
              ),
              const SizedBox(height: 18),
              Text(title, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
              const SizedBox(height: 8),
              Text(body, textAlign: TextAlign.center, style: const TextStyle(fontSize: 15, color: Colors.white70, height: 1.5)),
              if (won) ...[
                const SizedBox(height: 10),
                Text('+$points نقطة', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xffffd166))),
              ],
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                  ),
                  child: const Text('حسناً', style: TextStyle(fontWeight: FontWeight.w900)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // --- UI ----------------------------------------------------------------------
  @override
  Widget build(BuildContext context) {
    final wheel = Map<String, dynamic>.from(rewards['wheel'] ?? const {});
    final extraAvailable = _int(wheel['extraAvailableToUse']);
    final dailyAvailable = _int(wheel['dailyRemaining']);

    if (loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    final size = min(MediaQuery.of(context).size.width - 44, 350.0);
    final kick = -0.42 * (1 - Curves.easeOut.transform(_kick.value));

    return Scaffold(
      appBar: AppBar(title: const Text('عجلة الحظ')),
      body: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xff172554), Color(0xff111827), Color(0xff2e1065)],
                  ),
                  border: Border.all(color: Colors.white.withValues(alpha: .09)),
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: .28), blurRadius: 30, offset: const Offset(0, 14))],
                ),
                child: Column(
                  children: [
                    const Text('جرّب حظك', style: TextStyle(fontSize: 23, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 4),
                    const Text('جوائز متنوعة • نتيجة واحدة في كل لفة', style: TextStyle(color: Colors.white60, fontSize: 12)),
                    const SizedBox(height: 14),
                    if (loadFailed || prizes.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 40),
                        child: Column(children: [
                          const Icon(Icons.cloud_off_rounded, size: 44, color: Colors.white54),
                          const SizedBox(height: 10),
                          OutlinedButton(onPressed: () { setState(() => loading = true); load(); }, child: const Text('إعادة المحاولة')),
                        ]),
                      )
                    else
                      Center(
                        child: Stack(
                          alignment: Alignment.topCenter,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(top: 22),
                              child: Transform.rotate(
                                angle: _theta,
                                child: SizedBox(
                                  width: size,
                                  height: size,
                                  child: CustomPaint(painter: _WheelPainter(prizes)),
                                ),
                              ),
                            ),
                            // The "hub" button sits above the rotating disc.
                            Positioned(
                              top: 22 + size / 2 - 30,
                              child: _Hub(spinning: spinning),
                            ),
                            Transform.rotate(
                              angle: kick,
                              alignment: Alignment.topCenter,
                              child: const _Pointer(),
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        _Counter(label: 'لفات اليوم', value: '$dailyAvailable', icon: Icons.local_fire_department_rounded),
                        _Counter(label: 'إضافية', value: '$extraAvailable', icon: Icons.auto_awesome_rounded),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                height: 56,
                child: FilledButton.icon(
                  onPressed: spinning || dailyAvailable == 0 || prizes.isEmpty
                      ? null
                      : () async {
                          SoundService.instance.playTap();
                          await spin();
                        },
                  icon: spinning
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.casino_rounded),
                  label: Text(spinning ? 'جاري الدوران...' : 'لف الآن', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
                  style: FilledButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17))),
                ),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: spinning || extraAvailable == 0 || prizes.isEmpty
                    ? null
                    : () async {
                        SoundService.instance.playTap();
                        await spin(useExtraSpin: true);
                      },
                icon: const Icon(Icons.auto_awesome, color: AppColors.blue),
                label: const Text('استخدم لفة إضافية', style: TextStyle(color: AppColors.blue, fontWeight: FontWeight.w800)),
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 15), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: spinning || watchingExtraAd ? null : _watchExtraSpinAd,
                icon: watchingExtraAd ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.ondemand_video_rounded),
                label: Text(watchingExtraAd ? 'جاري تجهيز الإعلان...' : 'شاهد إعلان واحصل على لفة إضافية'),
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 15), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .025),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.white.withValues(alpha: .06)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline_rounded, color: AppColors.blue),
                    SizedBox(width: 10),
                    Expanded(child: Text('نتائج العجلة واحتمالاتها تتم إدارتها من لوحة الإدارة. لا يتم عرض الأوزان أو الاحتمالات للمستخدم.', style: TextStyle(color: Colors.white70, height: 1.4))),
                  ],
                ),
              ),
            ],
          ),
          Align(
            alignment: Alignment.topCenter,
            child: ConfettiWidget(
              confettiController: _confetti,
              blastDirectionality: BlastDirectionality.explosive,
              shouldLoop: false,
              numberOfParticles: 28,
              gravity: .25,
              colors: const [Color(0xffffd166), Color(0xffff3b5c), Color(0xff2d7bff), Color(0xff22c55e), Colors.white],
            ),
          ),
        ],
      ),
    );
  }
}

class _Pointer extends StatelessWidget {
  const _Pointer();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(size: const Size(40, 48), painter: _PointerPainter());
  }
}

class _PointerPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width / 2, size.height)
      ..lineTo(size.width * .06, size.height * .2)
      ..quadraticBezierTo(size.width / 2, -size.height * .16, size.width * .94, size.height * .2)
      ..close();
    canvas.drawShadow(path, Colors.black, 6, true);
    canvas.drawPath(
      path,
      Paint()..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xffffe08a), Color(0xffff7a00)]).createShader(Offset.zero & size),
    );
    canvas.drawCircle(Offset(size.width / 2, size.height * .3), 5, Paint()..color = const Color(0xff111827));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _Hub extends StatelessWidget {
  final bool spinning;
  const _Hub({required this.spinning});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 60,
      height: 60,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: const Color(0xff111827),
        border: Border.all(color: const Color(0xffffd166), width: 3),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: .4), blurRadius: 10)],
      ),
      alignment: Alignment.center,
      child: Icon(spinning ? Icons.autorenew_rounded : Icons.star_rounded, color: const Color(0xffffd166), size: 28),
    );
  }
}

class _Counter extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  const _Counter({required this.label, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
      decoration: BoxDecoration(color: Colors.black.withValues(alpha: .18), borderRadius: BorderRadius.circular(15)),
      child: Row(children: [
        Icon(icon, size: 18, color: const Color(0xffffd166)),
        const SizedBox(width: 7),
        Text('$value ${tr(label)}', style: const TextStyle(fontWeight: FontWeight.w800)),
      ]),
    );
  }
}

class _WheelPainter extends CustomPainter {
  final List<dynamic> prizes;
  const _WheelPainter(this.prizes);

  static final RegExp _arabic = RegExp(r'[\u0600-\u06FF]');

  @override
  void paint(Canvas canvas, Size size) {
    if (prizes.isEmpty) return;
    final center = size.center(Offset.zero);
    final radius = size.width / 2 - 7;
    final count = prizes.length;
    final segment = 2 * pi / count;

    final shadow = Paint()
      ..color = Colors.black.withValues(alpha: .48)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 18);
    canvas.drawCircle(center.translate(0, 10), radius + 3, shadow);

    final outer = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 11
      ..shader = const SweepGradient(colors: [Color(0xffffd166), Color(0xffffffff), Color(0xffa78bfa), Color(0xffffd166)])
          .createShader(Rect.fromCircle(center: center, radius: radius));
    canvas.drawCircle(center, radius + 2, outer);

    for (int i = 0; i < count; i++) {
      final color = _toColor(prizes[i]['color']);
      final start = -pi / 2 + i * segment;
      final rect = Rect.fromCircle(center: center, radius: radius);
      final paint = Paint()
        ..style = PaintingStyle.fill
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_lighten(color, .16), _darken(color, .18)],
        ).createShader(rect);
      canvas.drawArc(rect, start, segment - .018, true, paint);

      final divider = Paint()
        ..color = Colors.white.withValues(alpha: .36)
        ..strokeWidth = 2.2;
      final p1 = Offset(center.dx + radius * cos(start), center.dy + radius * sin(start));
      canvas.drawLine(center, p1, divider);

      final label = tr('${prizes[i]['label'] ?? ''}');
      final shortLabel = label.length > 13 ? '${label.substring(0, 12)}…' : label;
      final tp = TextPainter(
        text: TextSpan(
          text: shortLabel,
          style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w900, shadows: [Shadow(color: Colors.black54, blurRadius: 4)]),
        ),
        textDirection: _arabic.hasMatch(shortLabel) ? TextDirection.rtl : TextDirection.ltr,
        textAlign: TextAlign.center,
        maxLines: 2,
      )..layout(maxWidth: radius * .36);
      final a = start + segment / 2;
      final textRadius = radius * .64;
      final pos = Offset(center.dx + textRadius * cos(a), center.dy + textRadius * sin(a));
      canvas.save();
      canvas.translate(pos.dx, pos.dy);
      canvas.rotate(a + pi / 2);
      tp.paint(canvas, Offset(-tp.width / 2, -tp.height / 2));
      canvas.restore();
    }

    final highlight = Paint()
      ..shader = RadialGradient(colors: [Colors.white.withValues(alpha: .22), Colors.transparent])
          .createShader(Rect.fromCircle(center: center.translate(-radius * .18, -radius * .22), radius: radius * .72));
    canvas.drawCircle(center, radius, highlight);

    for (int i = 0; i < 20; i++) {
      final a = -pi / 2 + i * (2 * pi / 20);
      final p = Offset(center.dx + (radius + 7) * cos(a), center.dy + (radius + 7) * sin(a));
      final glow = Paint()
        ..color = const Color(0xffffd166).withValues(alpha: .22)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 7);
      canvas.drawCircle(p, 4.6, glow);
      canvas.drawCircle(p, 2.2, Paint()..color = const Color(0xffffd166));
    }
  }

  Color _toColor(dynamic hex) {
    final value = '$hex';
    if (!value.startsWith('#') || value.length != 7) return const Color(0xff64748b);
    return Color(int.parse(value.replaceFirst('#', '0xff')));
  }

  Color _lighten(Color c, double amount) => Color.lerp(c, Colors.white, amount)!;
  Color _darken(Color c, double amount) => Color.lerp(c, Colors.black, amount)!;

  @override
  bool shouldRepaint(covariant _WheelPainter oldDelegate) => oldDelegate.prizes != prizes;
}
