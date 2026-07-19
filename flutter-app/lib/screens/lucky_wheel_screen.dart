import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';

class LuckyWheelScreen extends ConsumerStatefulWidget {
  const LuckyWheelScreen({super.key});
  @override
  ConsumerState<LuckyWheelScreen> createState() => _LuckyWheelScreenState();
}

class _LuckyWheelScreenState extends ConsumerState<LuckyWheelScreen>
    with SingleTickerProviderStateMixin {
  List<dynamic> prizes = [];
  bool loading = true;
  double angle = 0;
  bool spinning = false;

  @override
  void initState() { super.initState(); load(); }

  Future<void> load() async {
    try {
      final r = await ApiClient.instance.dio.get('/wheel/prizes');
      setState(() => prizes = r.data['prizes'] ?? []);
    } catch (_) {} finally { setState(() => loading = false); }
  }

  Future<void> spin() async {
    if (spinning || prizes.isEmpty) return;
    setState(() => spinning = true);
    try {
      final r = await ApiClient.instance.dio.post('/wheel/spin');
      final index = prizes.indexWhere((p) => p['id'] == r.data['prize']['id']);
      final segment = 360 / prizes.length;
      final targetAngle = 360 * 5 + (360 - (index * segment + segment / 2));
      setState(() => angle = targetAngle.toDouble());
      await Future.delayed(const Duration(milliseconds: 4500));
      await ref.read(authProvider).bootstrap();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        backgroundColor: AppColors.success,
        content: Text('🎉 ربحت ${r.data['points']} نقطة!'),
      ));
    } catch (e) {
      final m = (e as dynamic).response?.data?['message'] ?? 'فشل الدوران';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(m), backgroundColor: AppColors.red));
    } finally { setState(() => spinning = false); }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    return Scaffold(
      appBar: AppBar(title: const Text('عجلة الحظ')),
      body: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 12),
          AnimatedRotation(
            turns: angle / 360,
            duration: const Duration(seconds: 5),
            child: SizedBox(
              width: 280, height: 280,
              child: CustomPaint(painter: _WheelPainter(prizes)),
            ),
          ),
          const SizedBox(height: 30),
          ElevatedButton.icon(
            onPressed: spinning ? null : spin,
            icon: spinning
              ? const SizedBox(width: 18, height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.casino),
            label: Text(spinning ? 'جاري الدوران...' : 'دوّر الآن'),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 18),
            ),
          ),
          const SizedBox(height: 20),
        ]),
      ),
    );
  }
}

class AnimatedRotation extends StatelessWidget {
  final double turns;
  final Duration duration;
  final Widget child;
  const AnimatedRotation({super.key, required this.turns, required this.duration, required this.child});

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder(
      tween: Tween<double>(begin: 0, end: turns),
      duration: duration,
      curve: Curves.easeOutCubic,
      builder: (_, v, __) => Transform.rotate(angle: v * 2 * pi, child: child),
    );
  }
}

class _WheelPainter extends CustomPainter {
  final List<dynamic> prizes;
  _WheelPainter(this.prizes);

  @override
  void paint(Canvas canvas, Size size) {
    if (prizes.isEmpty) return;
    final center = size.center(Offset.zero);
    final radius = size.width / 2;
    final segment = 2 * pi / prizes.length;

    for (int i = 0; i < prizes.length; i++) {
      final color = _toColor(prizes[i]['color']);
      final paint = Paint()..color = color;
      final start = -pi / 2 + i * segment;
      canvas.drawArc(Rect.fromCircle(center: center, radius: radius), start, segment, true, paint);

      // label
      final tp = TextPainter(
        text: TextSpan(
          text: prizes[i]['label'],
          style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final labelAngle = start + segment / 2;
      final dx = center.dx + (radius * 0.6) * cos(labelAngle) - tp.width / 2;
      final dy = center.dy + (radius * 0.6) * sin(labelAngle) - tp.height / 2;
      canvas.save();
      canvas.translate(dx + tp.width / 2, dy + tp.height / 2);
      canvas.rotate(labelAngle + pi / 2);
      tp.paint(canvas, Offset(-tp.width / 2, -tp.height / 2));
      canvas.restore();
    }

    // pointer
    final pPath = Path()
      ..moveTo(center.dx, center.dy - radius - 6)
      ..lineTo(center.dx - 12, center.dy - radius + 14)
      ..lineTo(center.dx + 12, center.dy - radius + 14)
      ..close();
    canvas.drawPath(pPath, Paint()..color = AppColors.red);

    // center
    canvas.drawCircle(center, 18, Paint()..color = AppColors.card);
    canvas.drawCircle(center, 14, Paint()..color = Colors.white);
  }

  Color _toColor(String? hex) {
    if (hex == null || hex.length < 7) return AppColors.red;
    return Color(int.parse(hex.replaceFirst('#', '0xff')));
  }

  @override
  bool shouldRepaint(covariant _WheelPainter oldDelegate) => false;
}
