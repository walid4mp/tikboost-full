import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config/app_config.dart';
import '../config/app_theme.dart';
import '../services/api_client.dart';

class ShopScreen extends ConsumerStatefulWidget {
  const ShopScreen({super.key});
  @override
  ConsumerState<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends ConsumerState<ShopScreen> {
  List<dynamic> packages = [];
  Map<String, dynamic> vip = {};
  List<dynamic> vipPlans = [];
  bool loading = true;
  bool vipBusy = false;
  String? selectedPlan;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final results = await Future.wait([
        ApiClient.instance.dio.get('/packages'),
        ApiClient.instance.dio.get('/vip/status'),
      ]);
      if (!mounted) return;
      final data = Map<String, dynamic>.from(results[1].data['vipPro'] ?? {});
      setState(() {
        packages = List<dynamic>.from(results[0].data['packages'] ?? const []);
        vip = data;
        vipPlans = List<dynamic>.from(data['plans'] ?? const []);
      });
    } catch (_) {
      if (mounted) setState(() => vipPlans = _fallbackPlans);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  List<Map<String, dynamic>> get _fallbackPlans => const [
        {'key': 'vip_starter', 'name': 'VIP Starter', 'priceCents': 199, 'durationDays': 7, 'bonusPerTask': 25},
        {'key': 'vip_monthly', 'name': 'VIP', 'priceCents': 499, 'durationDays': 30, 'bonusPerTask': 50},
        {'key': 'vip_pro', 'name': 'VIP PRO', 'priceCents': 999, 'durationDays': 30, 'bonusPerTask': 100},
        {'key': 'vip_elite', 'name': 'Elite', 'priceCents': 1999, 'durationDays': 30, 'bonusPerTask': 200},
        {'key': 'vip_ultimate', 'name': 'Ultimate', 'priceCents': 3999, 'durationDays': 90, 'bonusPerTask': 300},
      ];

  Future<void> buyVip(String key) async {
    if (vipBusy) return;
    setState(() {
      vipBusy = true;
      selectedPlan = key;
    });
    try {
      final r = await ApiClient.instance.dio.post('/vip/subscribe', data: {
        'method': 'manual_transfer',
        'planKey': key,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        backgroundColor: AppColors.success,
        content: Text(r.data['instructions'] ?? 'تم إرسال طلب VIP للدعم'),
      ));
      final plan = vipPlans.firstWhere((p) => '${p['key']}' == key, orElse: () => {});
      final name = plan['name'] ?? 'VIP';
      final url = AppConfig.whatsappUrlWithText('مرحبًا، أريد شراء $name في TokAura. الخطة: $key');
      final uri = Uri.tryParse(url);
      if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
      await load();
    } catch (e) {
      if (!mounted) return;
      final response = (e as dynamic).response;
      final message = response?.data?['message'] ?? 'تعذر إنشاء طلب VIP';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$message'), backgroundColor: AppColors.red));
    } finally {
      if (mounted) setState(() { vipBusy = false; selectedPlan = null; });
    }
  }

  Future<void> buy(dynamic pkg) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final r = await ApiClient.instance.dio.post('/packages/buy', data: {
        'packageId': pkg['id'],
        'method': 'manual_transfer',
      });
      messenger.showSnackBar(SnackBar(backgroundColor: AppColors.success, content: Text(r.data['instructions'] ?? 'تم إنشاء الطلب')));
      final url = AppConfig.whatsappUrlWithText('مرحبًا، أريد شراء باقة ${pkg['name']} بكمية ${pkg['points']} نقطة');
      final uri = Uri.tryParse(url);
      if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (e) {
      final m = (e as dynamic).response?.data?['message'] ?? 'تعذر الشراء';
      messenger.showSnackBar(SnackBar(content: Text('$m'), backgroundColor: AppColors.red));
    }
  }

  Color _color(int i) => [AppColors.blue, AppColors.success, AppColors.purple, AppColors.red, AppColors.warning][i % 5];

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    final plans = vipPlans.isEmpty ? _fallbackPlans : vipPlans;
    return Scaffold(
      appBar: AppBar(title: const Text('TokAura Shop'), centerTitle: true),
      body: RefreshIndicator(
        onRefresh: load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 28),
          children: [
            _hero(),
            const SizedBox(height: 16),
            _welcomeOffer(plans),
            const SizedBox(height: 22),
            Row(children: [
              const Expanded(child: Text('VIP Membership', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900))),
              Text('${plans.length} مستويات', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
            ]),
            const SizedBox(height: 10),
            ...plans.asMap().entries.map((entry) => _planCard(Map<String, dynamic>.from(entry.value as Map), entry.key)),
            const SizedBox(height: 18),
            _flashSale(plans),
            const SizedBox(height: 24),
            const Text('شراء النقاط', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            if (packages.isEmpty)
              const _EmptyShop()
            else
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: packages.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: .78),
                itemBuilder: (_, i) => _pointCard(packages[i], i),
              ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.blue.withValues(alpha: .08), borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border)),
              child: const Row(children: [
                Icon(Icons.support_agent_rounded, color: AppColors.blue),
                SizedBox(width: 10),
                Expanded(child: Text('الدفع يتم عبر الدعم. أرسل إثبات الدفع ليتم تفعيل العرض بسرعة.', style: TextStyle(color: AppColors.textMuted, fontSize: 12))),
              ]),
            ),
          ],
        ),
      ),
    );
  }

  Widget _hero() => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(gradient: AppColors.aurora, borderRadius: BorderRadius.circular(28), boxShadow: const [BoxShadow(color: Color(0x331F8FFF), blurRadius: 24, offset: Offset(0, 10))]),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(width: 48, height: 48, decoration: BoxDecoration(color: Colors.white.withValues(alpha: .16), borderRadius: BorderRadius.circular(16)), child: const Icon(Icons.workspace_premium_rounded, color: Colors.white, size: 28)),
            const Spacer(),
            if (vip['active'] == true) Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: Colors.white.withValues(alpha: .16), borderRadius: BorderRadius.circular(20)), child: const Text('ACTIVE 👑', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 11))),
          ]),
          const SizedBox(height: 18),
          const Text('Unlock your TokAura', style: TextStyle(color: Colors.white, fontSize: 25, fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          const Text('مضاعفات نقاط • أولوية • مكافآت حصرية • بدون إعلانات', style: TextStyle(color: Colors.white70, fontSize: 12)),
          if (vip['active'] == true && vip['until'] != null) ...[
            const SizedBox(height: 12),
            Text('مفعل حتى ${vip['until']}'.replaceAll('T', ' '), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
          ],
        ]),
      );

  Widget _welcomeOffer(List<dynamic> plans) {
    final plan = plans.firstWhere((p) => '${p['key']}' == 'vip_pro', orElse: () => plans.length > 2 ? plans[2] : plans.first);
    final price = ((plan['priceCents'] ?? 999) as num) / 100;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(24), border: Border.all(color: AppColors.red.withValues(alpha: .35))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5), decoration: BoxDecoration(color: AppColors.red.withValues(alpha: .14), borderRadius: BorderRadius.circular(10)), child: const Text('WELCOME OFFER', style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w900, fontSize: 10))),
          const Spacer(),
          const Text('24H', style: TextStyle(color: AppColors.warning, fontWeight: FontWeight.w900)),
        ]),
        const SizedBox(height: 12),
        const Text('VIP PRO — العرض المميز', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
        const SizedBox(height: 4),
        Text('مضاعف ${plan['bonusPerTask'] ?? 100}% + أولوية المهام + مكافآت VIP', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
        const SizedBox(height: 12),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text('\$$price', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
          const SizedBox(width: 6),
          const Padding(padding: EdgeInsets.only(bottom: 4), child: Text('/ 30 يوم', style: TextStyle(color: AppColors.textMuted, fontSize: 11))),
          const Spacer(),
          FilledButton(onPressed: vipBusy ? null : () => buyVip('${plan['key']}'), child: const Text('احصل عليه')),
        ]),
      ]),
    );
  }

  Widget _planCard(Map<String, dynamic> plan, int index) {
    final key = '${plan['key'] ?? ''}';
    final name = '${plan['name'] ?? 'VIP'}';
    final price = ((plan['priceCents'] ?? 0) as num) / 100;
    final days = plan['durationDays'] ?? 30;
    final bonus = plan['bonusPerTask'] ?? 0;
    final isPro = key == 'vip_pro';
    final isElite = key == 'vip_elite' || key == 'vip_ultimate';
    final accent = isPro ? AppColors.purple : (isElite ? AppColors.warning : AppColors.blue);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(22), border: Border.all(color: isPro ? accent.withValues(alpha: .75) : AppColors.border, width: isPro ? 1.4 : 1)),
      child: Column(children: [
        Row(children: [
          Container(width: 48, height: 48, decoration: BoxDecoration(color: accent.withValues(alpha: .12), borderRadius: BorderRadius.circular(15)), child: Icon(isPro ? Icons.auto_awesome_rounded : Icons.workspace_premium_rounded, color: accent)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Text(name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)), if (isPro) ...[const SizedBox(width: 8), const _Tag(text: 'MOST POPULAR')]]),
            const SizedBox(height: 3),
            Text('${days} يوم • +$bonus% نقاط لكل مهمة', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          ])),
          Text('\$${price.toStringAsFixed(2)}', style: TextStyle(color: accent, fontSize: 19, fontWeight: FontWeight.w900)),
        ]),
        const SizedBox(height: 13),
        Wrap(spacing: 7, runSpacing: 7, children: const [
          _Benefit(icon: Icons.bolt_rounded, text: 'Bonus'),
          _Benefit(icon: Icons.priority_high_rounded, text: 'Priority'),
          _Benefit(icon: Icons.block_rounded, text: 'No ads'),
        ]),
        const SizedBox(height: 13),
        SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: vipBusy ? null : () => buyVip(key), icon: Icon(selectedPlan == key ? Icons.hourglass_top_rounded : Icons.arrow_forward_rounded), label: Text(selectedPlan == key ? 'جاري إنشاء الطلب...' : 'ترقية إلى $name'))),
      ]),
    );
  }

  Widget _flashSale(List<dynamic> plans) {
    final plan = plans.length > 0 ? plans.first : null;
    if (plan == null) return const SizedBox.shrink();
    final price = ((plan['priceCents'] ?? 199) as num) / 100;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF25192E), Color(0xFF171B2B)]), borderRadius: BorderRadius.circular(22), border: Border.all(color: AppColors.warning.withValues(alpha: .35))),
      child: Row(children: [
        Container(width: 46, height: 46, decoration: BoxDecoration(color: AppColors.warning.withValues(alpha: .12), borderRadius: BorderRadius.circular(15)), child: const Icon(Icons.local_fire_department_rounded, color: AppColors.warning)),
        const SizedBox(width: 12),
        const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('FLASH SALE 🔥', style: TextStyle(fontWeight: FontWeight.w900)), SizedBox(height: 3), Text('ابدأ بأقل سعر وجرب VIP لمدة قصيرة', style: TextStyle(color: AppColors.textMuted, fontSize: 11))])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Text('\$$price', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17)), const SizedBox(height: 4), TextButton(onPressed: vipBusy ? null : () => buyVip('${plan['key']}'), child: const Text('ابدأ'))]),
      ]),
    );
  }

  Widget _pointCard(dynamic pkg, int i) {
    final c = _color(i);
    final price = (((pkg['priceCents'] ?? 0) as num) / 100).toStringAsFixed(2);
    return Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: c.withValues(alpha: .16), borderRadius: BorderRadius.circular(8)), child: Text('${pkg['name'] ?? 'POINTS'}'.toUpperCase(), style: TextStyle(color: c, fontWeight: FontWeight.w900, fontSize: 11))),
      const Spacer(),
      Text('\$$price', style: const TextStyle(fontSize: 27, fontWeight: FontWeight.w900)),
      const SizedBox(height: 4),
      Text('${pkg['points'] ?? 0} نقطة', style: const TextStyle(fontWeight: FontWeight.w700)),
      if ((pkg['bonusPoints'] ?? '0').toString() != '0') Text('+${pkg['bonusPoints']} هدية', style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w700)),
      const SizedBox(height: 10),
      SizedBox(width: double.infinity, child: ElevatedButton(onPressed: () => buy(pkg), style: ElevatedButton.styleFrom(backgroundColor: c), child: const Text('شراء'))),
    ])));
  }
}

class _Tag extends StatelessWidget {
  final String text;
  const _Tag({required this.text});
  @override Widget build(BuildContext context) => Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3), decoration: BoxDecoration(color: AppColors.purple.withValues(alpha: .14), borderRadius: BorderRadius.circular(7)), child: const Text('MOST POPULAR', style: TextStyle(color: AppColors.purple, fontSize: 8, fontWeight: FontWeight.w900)));
}

class _Benefit extends StatelessWidget {
  final IconData icon;
  final String text;
  const _Benefit({required this.icon, required this.text});
  @override Widget build(BuildContext context) => Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5), decoration: BoxDecoration(color: AppColors.dark, borderRadius: BorderRadius.circular(9)), child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 14, color: AppColors.textMuted), const SizedBox(width: 4), Text(text, style: const TextStyle(color: AppColors.textMuted, fontSize: 10))]));
}

class _EmptyShop extends StatelessWidget {
  const _EmptyShop();
  @override Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(24), decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(20)), child: const Center(child: Text('لا توجد باقات نقاط حالياً', style: TextStyle(color: AppColors.textMuted))));
}
