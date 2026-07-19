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
  bool loading = true;

  static const PRICE_USD = {
    'starter': 1, 'basic': 5, 'pro': 10, 'elite': 25, 'vip': 50,
  };

  @override
  void initState() { super.initState(); load(); }

  Future<void> load() async {
    try {
      final r = await ApiClient.instance.dio.get('/packages');
      setState(() => packages = r.data['packages']);
    } catch (_) {} finally { setState(() => loading = false); }
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
      final url = Uri.parse(
        'https://wa.me/${AppConfig.whatsapp.replaceAll(' ', '')}?text=${Uri.encodeComponent('مرحبًا، أريد شراء باقة ${pkg['name']} بكمية ${pkg['points']} نقطة')}'
      );
      launchUrl(url, mode: LaunchMode.externalApplication);
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
                      decoration: BoxDecoration(color: c.withOpacity(0.18),
                        borderRadius: BorderRadius.circular(8)),
                      child: Text((p['name'] ?? '').toString().toUpperCase(),
                        style: TextStyle(color: c, fontWeight: FontWeight.w900, fontSize: 12)),
                    ),
                    const Spacer(),
                    Text('\$${PRICE_USD[p['slug']] ?? '-'}',
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
              color: AppColors.blue.withOpacity(0.10),
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
