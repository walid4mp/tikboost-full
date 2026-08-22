import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_theme.dart';
import '../services/admob_service.dart';
import '../services/rewards_repository.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';
import '../services/sound_service.dart';
import 'dart:async';

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
      // handled silently to keep screen usable
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: AppColors.success,
          content: Text('تمت إضافة لفة إضافية 🎁'),
        ),
      );
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
    _tickTimer = Timer.periodic(const Duration(milliseconds: 115), (_) { SoundService.instance.play('spin_tick.wav'); });
    try {
      final r = await ApiClient.instance.dio.post(
        '/wheel/spin',
        data: {'useExtraSpin': useExtraSpin},
      );
      final prize = Map<String, dynamic>.from(r.data['prize'] as Map);
      final index = prizes.indexWhere((p) => p['id'] == prize['id']);
      final segment = 360 / prizes.length;
      final prizeCenter = index >= 0 ? (index * segment + segment / 2) : 0;
      final target = 5 + ((360 - prizeCenter) / 360);
      if (mounted) {
        setState(() {
          turns += target;
          rewards = Map<String, dynamic>.from(r.data['rewards'] ?? const {});
        });
      }
      await Future.delayed(const Duration(milliseconds: 4300));
      _tickTimer?.cancel();
      await SoundService.instance.play('wheel_win.wav');
      await ref.read(authProvider).bootstrap();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.success,
          content: Text('🎉 ربحت ${r.data['points']} نقطة!'),
        ),
      );
    } catch (e) {
      final message = e is DioException
          ? '${e.response?.data?['message'] ?? e.message ?? 'فشل الدوران'}'
          : 'فشل الدوران';
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: AppColors.red, content: Text(message)),
      );
    } finally {
      _tickTimer?.cancel();
      if (mounted) setState(() => spinning = false);
    }
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

    if (loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('عجلة الحظ')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SizedBox(height: 8),
          Center(
            child: Stack(
              alignment: Alignment.topCenter,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 14),
                  child: TweenAnimationBuilder<double>(
                    tween: Tween<double>(begin: 0, end: turns),
                    duration: const Duration(milliseconds: 4200),
                    curve: Curves.easeOutCubic,
                    builder: (_, value, child) => Transform.rotate(
                      angle: value * 2 * pi,
                      child: child,
                    ),
                    child: SizedBox(
                      width: 300,
                      height: 300,
                      child: CustomPaint(painter: _WheelPainter(prizes)),
                    ),
                  ),
                ),
                const Icon(Icons.arrow_drop_down, size: 46, color: AppColors.red),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text('اللفات اليومية المتبقية: $dailyAvailable'),
                  const SizedBox(height: 6),
                  Text('اللفات الإضافية المتاحة: $extraAvailable'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: spinning || dailyAvailable == 0 ? null : () => spin(),
            icon: spinning
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.casino),
            label: Text(spinning ? 'جاري الدوران...' : 'استخدم اللفة اليومية'),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: spinning || extraAvailable == 0 ? null : () => spin(useExtraSpin: true),
            icon: const Icon(Icons.auto_awesome, color: AppColors.blue),
            label: const Text(
              'استخدم لفة إضافية',
              style: TextStyle(color: AppColors.blue, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: spinning || watchingExtraAd || (int.tryParse('${wheel['extraEarnedRemaining'] ?? 0}') ?? 0) <= 0
                  ? null
                  : _watchExtraSpinAd,
              icon: watchingExtraAd
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.ondemand_video),
              label: Text(
                watchingExtraAd
                    ? 'جاري تجهيز الإعلان...'
                    : '📺 شاهد إعلان واحصل على لفة إضافية',
              ),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              ),
            ),
          ),
          const SizedBox(height: 18),
          const Text('الجوائز المتاحة', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          ...prizes.map(
            (item) => Card(
              child: ListTile(
                leading: CircleAvatar(backgroundColor: _toColor(item['color'])),
                title: Text('${item['label']}'),
                subtitle: Text('الوزن: ${item['weight']}'),
                trailing: Text(
                  '${item['points']}',
                  style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.success),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _toColor(dynamic hex) {
    final value = '$hex';
    if (!value.startsWith('#') || value.length != 7) return AppColors.red;
    return Color(int.parse(value.replaceFirst('#', '0xff')));
  }
}

class _WheelPainter extends CustomPainter {
  final List<dynamic> prizes;
  const _WheelPainter(this.prizes);

  @override
  void paint(Canvas canvas, Size size) {
    if (prizes.isEmpty) return;
    final center = size.center(Offset.zero);
    final radius = size.width / 2;
    final segment = 2 * pi / prizes.length;
    final shadow = Paint()..color = Colors.black.withValues(alpha: .22)..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10);
    canvas.drawCircle(center.translate(0, 7), radius + 4, shadow);

    for (int i = 0; i < prizes.length; i++) {
      final color = _toColor(prizes[i]['color']);
      final paint = Paint()..color = color..style = PaintingStyle.fill;
      final start = -pi / 2 + i * segment;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        start,
        segment,
        true,
        paint,
      );

      final tp = TextPainter(
        text: TextSpan(
          text: '${prizes[i]['label']}',
          style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800),
        ),
        textDirection: TextDirection.rtl,
      )..layout(maxWidth: 80);
      final labelAngle = start + segment / 2;
      final dx = center.dx + (radius * 0.63) * cos(labelAngle) - tp.width / 2;
      final dy = center.dy + (radius * 0.63) * sin(labelAngle) - tp.height / 2;
      canvas.save();
      canvas.translate(dx + tp.width / 2, dy + tp.height / 2);
      canvas.rotate(labelAngle + pi / 2);
      tp.paint(canvas, Offset(-tp.width / 2, -tp.height / 2));
      canvas.restore();
    }

    canvas.drawCircle(center, radius, Paint()..style = PaintingStyle.stroke..strokeWidth = 6..color = Colors.white.withValues(alpha: .9));
    canvas.drawCircle(center, 28, Paint()..color = Colors.white);
    canvas.drawCircle(center, 23, Paint()..color = AppColors.red);
    final tp = TextPainter(text: const TextSpan(text: 'SPIN', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900)), textDirection: TextDirection.ltr)..layout();
    tp.paint(canvas, center - Offset(tp.width / 2, tp.height / 2));
  }

  Color _toColor(dynamic hex) {
    final value = '$hex';
    if (!value.startsWith('#') || value.length != 7) return AppColors.red;
    return Color(int.parse(value.replaceFirst('#', '0xff')));
  }

  @override
  bool shouldRepaint(covariant _WheelPainter oldDelegate) => oldDelegate.prizes != prizes;
}
