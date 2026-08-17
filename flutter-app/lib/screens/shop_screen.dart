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
  bool loading = true;
  bool vipBusy = false;


  @override
  void initState() { super.initState(); load(); }

  Future<void> load() async {
    try {
      final results = await Future.wait([
        ApiClient.instance.dio.get('/packages'),
        ApiClient.instance.dio.get('/vip/status'),
      ]);
      setState(() {
        packages = results[0].data['packages'];
        vip = Map<String, dynamic>.from(results[1].data['vipPro'] ?? {});
      });
    } catch (_) {} finally { setState(() => loading = false); }
  }


  Future<void> buyVip() async {
    if (vipBusy) return;
    setState(() => vipBusy = true);
    try {
      final r = await ApiClient.instance.dio.post('/vip/subscribe', data: {'method': 'manual_transfer'});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(backgroundColor: AppColors.success, content: Text(r.data['instructions'] ?? 'تم إرسال الطلب')));
      await load();
    } catch (e) {
      if (!mounted) return;
      final m = (e as dynamic).response?.data?['message'] ?? 'تعذر إرسال طلب VIP PRO';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$m'), backgroundColor: AppColors.red));
    } finally { if (mounted) setState(() => vipBusy = false); }
  }

  Future<void> buy(dynamic pkg) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final r = await ApiClient.instance.dio.post('/packages/buy', data: {
        'packageId': pkg['id'], 'method': 'manual_transfer',
      });
      messenger.showSnackBar(SnackBar(
        backgroundColor: AppColors.success,
        content: Text(r.data['instructions'] ?? 'تم إنشاء الطلب'),
      ));
      final url = AppConfig.whatsappUrlWithText(
        'مرحبًا، أريد شراء باقة ${pkg['name']} بكمية ${pkg['points']} نقطة',
      );
      final uri = Uri.tryParse(url);
      if (uri != null) {
        var opened = false;
        try {
          opened = await launchUrl(
            uri,
            mode: LaunchMode.externalApplication,
            webOnlyWindowName: '_blank',
          );
        } catch (_) {
          opened = false;
        }
        if (!opened) {
          try {
            await launchUrl(
              uri,
              mode: LaunchMode.platformDefault,
              webOnlyWindowName: '_blank',
            );
          } catch (_) {}
        }
      }
    } catch (e) {
      final m = (e as dynamic).response?.data?['message'] ?? 'تعذر الشراء';
      messenger.showSnackBar(SnackBar(content: Text(m), backgroundColor: AppColors.red));
    }
  }

  Color _color(int i) {
    const colors = [AppColors.blue, AppColors.success, AppColors.red, Colors.purple, Colors.amber];
    return colors[i % colors.length];
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    return Scaffold(
      appBar: AppBar(title: const Text('شراء النقاط')),
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [

          Card(
            elevation: 2,
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(gradient: LinearGradient(colors: [Colors.amber.shade800, Colors.orange.shade700]), borderRadius: BorderRadius.circular(14)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('👑 VIP PRO', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
                const SizedBox(height: 6),
                Text(vip['active'] == true ? 'مفعل حتى ${vip['until']}'.replaceAll('T', ' ') : 'أولوية للحملات + نقاط إضافية لكل مهمة', style: const TextStyle(color: Colors.white70)),
                const SizedBox(height: 10),
                Text('\$${((vip['priceCents'] ?? 1000) as num) / 100}/شهر', style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900)),
                const SizedBox(height: 10),
                SizedBox(width: double.infinity, child: ElevatedButton.icon(onPressed: vip['active'] == true || vipBusy ? null : buyVip, icon: vipBusy ? const SizedBox(width: 18,height:18,child:CircularProgressIndicator(strokeWidth:2)) : const Icon(Icons.workspace_premium), label: Text(vip['active'] == true ? 'VIP PRO مفعل' : 'اشترك الآن'), style: ElevatedButton.styleFrom(backgroundColor: Colors.white, foregroundColor: Colors.orange.shade800))),
              ]),
            ),
          ),
          const SizedBox(height: 14),
          const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: Text('اختر الباقة المناسبة لك',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          ),
          GridView.builder(
            shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
            itemCount: packages.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12,
              childAspectRatio: 0.78,
            ),
            itemBuilder: (_, i) {
              final p = packages[i];
              final c = _color(i);
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: c.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(8)),
                      child: Text((p['name'] ?? '').toString().toUpperCase(),
                        style: TextStyle(color: c, fontWeight: FontWeight.w900, fontSize: 12)),
                    ),
                    const Spacer(),
                    Text('\$${(((p['priceCents'] ?? 0) as num) / 100).toStringAsFixed(2)}',
                      style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 4),
                    Text('${p['points']} نقطة',
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                    if ((p['bonusPoints'] ?? '0') != '0')
                      Text('+${p['bonusPoints']} هدية',
                        style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    SizedBox(width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => buy(p),
                        style: ElevatedButton.styleFrom(backgroundColor: c),
                        child: const Text('شراء'))),
                  ]),
                ),
              );
            },
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.blue.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(14)),
            child: const Row(children: [
              Icon(Icons.support_agent, color: AppColors.blue),
              SizedBox(width: 10),
              Expanded(child: Text(
                'لشراء النقاط تواصل عبر واتساب أو البريد.',
                style: TextStyle(color: AppColors.blue))),
            ]),
          ),
        ],
      ),
    );
  }
}
