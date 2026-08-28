import 'dart:math';
import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_theme.dart';
import '../services/admob_service.dart';
import '../services/rewards_repository.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';
import '../services/sound_service.dart';

class LuckyWheelScreen extends ConsumerStatefulWidget {
  const LuckyWheelScreen({super.key});

  @override
  ConsumerState<LuckyWheelScreen> createState() => _LuckyWheelScreenState();
}

class _LuckyWheelScreenState extends ConsumerState<LuckyWheelScreen> {
  List<dynamic> prizes = const [];
  Map<String, dynamic> rewards = const {};
  bool loading = true;
  bool spinning = false;
  bool watchingExtraAd = false;
  double turns = 0;
  Timer? _tickTimer;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final r = await ApiClient.instance.dio.get('/wheel/prizes');
      if (!mounted) return;
      setState(() {
        prizes = List<dynamic>.from(r.data['prizes'] ?? const []);
        rewards = Map<String, dynamic>.from(r.data['rewards'] ?? const {});
      });
    } catch (_) {
      // Keep the screen usable even if the network is temporarily unavailable.
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _watchExtraSpinAd() async {
    if (spinning || watchingExtraAd) return;
    final wheel = Map<String, dynamic>.from(rewards['wheel'] ?? const {});
    final remaining = int.tryParse('${wheel['extraEarnedRemaining'] ?? 0}') ?? 0;
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
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        backgroundColor: AppColors.success,
        content: Text('تمت إضافة لفة إضافية 🎁'),
      ));
    } catch (e) {
      final message = e is DioException
          ? '${e.response?.data?['message'] ?? e.message ?? 'تعذر الحصول على اللفة الإضافية'}'
          : 'تعذر الحصول على اللفة الإضافية';
      _showMessage(message);
    } finally {
      if (mounted) setState(() => watchingExtraAd = false);
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(backgroundColor: AppColors.red, content: Text(message)),
    );
  }

  Future<void> spin({bool useExtraSpin = false}) async {
    if (spinning || prizes.isEmpty) return;
    setState(() => spinning = true);
    _tickTimer?.cancel();
    _tickTimer = Timer.periodic(const Duration(milliseconds: 135), (_) {
      SoundService.instance.playWheelTick();
    });

    try {
      final r = await ApiClient.instance.dio.post(
        '/wheel/spin',
        data: {'useExtraSpin': useExtraSpin},
      );
      final prize = Map<String, dynamic>.from(r.data['prize'] as Map);
      final index = prizes.indexWhere((p) => p['id'] == prize['id']);
      final count = max(prizes.length, 1);
      final segment = 360 / count;
      final prizeCenter = index >= 0 ? (index * segment + segment / 2) : 0;
      final target = 6 + ((360 - prizeCenter) / 360);

      if (mounted) {
        setState(() {
          turns += target;
          rewards = Map<String, dynamic>.from(r.data['rewards'] ?? const {});
        });
      }

      await Future.delayed(const Duration(milliseconds: 5000));
      _tickTimer?.cancel();

      final points = int.tryParse('${r.data['points'] ?? prize['points'] ?? 0}') ?? 0;
      final label = '${prize['label'] ?? ''}'.trim();

      if (points > 0) {
        await SoundService.instance.playSuccess();
      } else {
        await SoundService.instance.playWheelNoWin();
      }

      await ref.read(authProvider).bootstrap();
      if (!mounted) return;
      await _showResultDialog(label: label, points: points);
    } catch (e) {
      final message = e is DioException
          ? '${e.response?.data?['message'] ?? e.message ?? 'فشل الدوران'}'
          : 'فشل الدوران';
      if (!mounted) return;
      _showMessage(message);
    } finally {
      _tickTimer?.cancel();
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
      builder: (_) => Dialog(
        backgroundColor: const Color(0xff111827),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
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
                  onPressed: () => Navigator.pop(context),
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

  @override
  void dispose() {
    _tickTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final wheel = Map<String, dynamic>.from(rewards['wheel'] ?? const {});
    final extraAvailable = wheel['extraAvailableToUse'] ?? 0;
    final dailyAvailable = wheel['dailyRemaining'] ?? 0;

    if (loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    return Scaffold(
      appBar: AppBar(title: const Text('عجلة الحظ')),
      body: ListView(
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
                Center(
                  child: Stack(
                    alignment: Alignment.topCenter,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 16),
                        child: TweenAnimationBuilder<double>(
                          tween: Tween<double>(begin: 0, end: turns),
                          duration: const Duration(milliseconds: 5000),
                          curve: Curves.easeOutCubic,
                          builder: (_, value, child) => Transform.rotate(angle: value * 2 * pi, child: child),
                          child: SizedBox(
                            width: min(MediaQuery.of(context).size.width - 44, 350),
                            height: min(MediaQuery.of(context).size.width - 44, 350),
                            child: CustomPaint(painter: _WheelPainter(prizes)),
                          ),
                        ),
                      ),
                      const Positioned(
                        top: -2,
                        child: Icon(Icons.arrow_drop_down_rounded, size: 58, color: Color(0xffffd166)),
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
              onPressed: spinning || dailyAvailable == 0 ? null : () async {
                await SoundService.instance.playTap();
                await spin();
              },
              icon: spinning ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.casino_rounded),
              label: Text(spinning ? 'جاري الدوران...' : 'لف الآن', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
              style: FilledButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17))),
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: spinning || extraAvailable == 0 ? null : () async {
              await SoundService.instance.playTap();
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
      child: Row(children: [Icon(icon, size: 18, color: const Color(0xffffd166)), const SizedBox(width: 7), Text('$value $label', style: const TextStyle(fontWeight: FontWeight.w800))]),
    );
  }
}

class _WheelPainter extends CustomPainter {
  final List<dynamic> prizes;
  const _WheelPainter(this.prizes);

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

    // Outer luminous ring.
    final outer = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 11
      ..shader = const SweepGradient(colors: [Color(0xffffd166), Color(0xffffffff), Color(0xffa78bfa), Color(0xffffd166)]).createShader(Rect.fromCircle(center: center, radius: radius));
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

      final divider = Paint()..color = Colors.white.withValues(alpha: .36)..strokeWidth = 2.2;
      final p1 = Offset(center.dx + radius * cos(start), center.dy + radius * sin(start));
      canvas.drawLine(center, p1, divider);

      final label = '${prizes[i]['label'] ?? ''}';
      final shortLabel = label.length > 13 ? '${label.substring(0, 12)}…' : label;
      final tp = TextPainter(
        text: TextSpan(text: shortLabel, style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w900, shadows: [Shadow(color: Colors.black54, blurRadius: 4)])),
        textDirection: TextDirection.rtl,
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

    // Glossy highlight.
    final highlight = Paint()
      ..shader = RadialGradient(colors: [Colors.white.withValues(alpha: .22), Colors.transparent]).createShader(Rect.fromCircle(center: center.translate(-radius * .18, -radius * .22), radius: radius * .72));
    canvas.drawCircle(center, radius, highlight);

    // Decorative light bulbs around the rim.
    for (int i = 0; i < 20; i++) {
      final a = -pi / 2 + i * (2 * pi / 20);
      final p = Offset(center.dx + (radius + 7) * cos(a), center.dy + (radius + 7) * sin(a));
      final glow = Paint()..color = const Color(0xffffd166).withValues(alpha: .22)..maskFilter = const MaskFilter.blur(BlurStyle.normal, 7);
      canvas.drawCircle(p, 4.6, glow);
      canvas.drawCircle(p, 2.2, Paint()..color = const Color(0xffffd166));
    }

    canvas.drawCircle(center, radius * .18, Paint()..color = const Color(0xff111827));
    canvas.drawCircle(center, radius * .15, Paint()..shader = const RadialGradient(colors: [Color(0xffffd166), Color(0xffff7a00)]).createShader(Rect.fromCircle(center: center, radius: radius * .15)));
    final tp = TextPainter(
      text: const TextSpan(text: 'لَف', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w900, shadows: [Shadow(color: Colors.black54, blurRadius: 3)])),
      textDirection: TextDirection.rtl,
    )..layout();
    tp.paint(canvas, center - Offset(tp.width / 2, tp.height / 2));
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
