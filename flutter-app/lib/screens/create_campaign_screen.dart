import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../config/app_theme.dart';
import '../services/api_client.dart';

class CreateCampaignScreen extends ConsumerStatefulWidget {
  const CreateCampaignScreen({super.key});
  @override
  ConsumerState<CreateCampaignScreen> createState() => _CreateCampaignScreenState();
}

class _CreateCampaignScreenState extends ConsumerState<CreateCampaignScreen> {
  String type = 'FOLLOWERS';
  final targetUrl = TextEditingController();
  final quantity = TextEditingController(text: '100');
  String? error;
  bool busy = false;
  int totalCost = 0;

  // pricing mirror from backend
  static const PRICE = {
    'FOLLOWERS': 100, 'LIKES': 20, 'VIEWS': 5, 'COMMENTS': 50,
  };

  void recalc() {
    final q = int.tryParse(quantity.text) ?? 0;
    setState(() => totalCost = q * (PRICE[type] ?? 100));
  }

  Future<void> submit() async {
    setState(() { busy = true; error = null; });
    try {
      final r = await ApiClient.instance.dio.post('/campaigns', data: {
        'type': type,
        'targetUrl': targetUrl.text.trim(),
        'quantity': int.tryParse(quantity.text) ?? 0,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        backgroundColor: AppColors.success,
        content: Text('تم إنشاء الحملة ✅ تم خصم ${r.data['campaign']['pointsCost']} نقطة'),
      ));
      context.pop();
    } catch (e) {
      final m = (e as dynamic).response?.data?['message'] ?? 'فشل إنشاء الحملة';
      setState(() => error = m);
    } finally { setState(() => busy = false); }
  }

  @override
  void initState() { super.initState(); recalc(); }

  @override
  Widget build(BuildContext context) {
    final opts = ['FOLLOWERS','LIKES','VIEWS','COMMENTS'];
    final labels = {'FOLLOWERS':'متابعين','LIKES':'لايكات','VIEWS':'مشاهدات','COMMENTS':'تعليقات'};
    return Scaffold(
      appBar: AppBar(title: const Text('حملة جديدة')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text('نوع الحملة',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 8),
            Wrap(spacing: 8, children: opts.map((o) {
              final sel = o == type;
              return ChoiceChip(
                label: Text(labels[o]!),
                selected: sel,
                onSelected: (_) { setState(() => type = o); recalc(); },
                selectedColor: AppColors.red,
                labelStyle: TextStyle(color: sel ? Colors.white : null,
                  fontWeight: FontWeight.w700),
              );
            }).toList()),
            const SizedBox(height: 20),
            TextField(controller: targetUrl,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.link),
                hintText: 'رابط حساب TikTok أو الفيديو',
              )),
            const SizedBox(height: 12),
            TextField(controller: quantity, keyboardType: TextInputType.number,
              onChanged: (_) => recalc(),
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.numbers),
                hintText: 'العدد المطلوب',
              )),
            const SizedBox(height: 20),

            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.red.withOpacity(0.10),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.red.withOpacity(0.3)),
              ),
              child: Row(children: [
                const Icon(Icons.local_fire_department, color: AppColors.red),
                const SizedBox(width: 10),
                Expanded(child: Text('التكلفة الإجمالية: $totalCost نقطة',
                  style: const TextStyle(color: AppColors.red, fontWeight: FontWeight.w800))),
              ]),
            ),
            const SizedBox(height: 16),
            if (error != null) Text(error!, style: const TextStyle(color: AppColors.red)),
            const SizedBox(height: 6),
            ElevatedButton.icon(
              onPressed: busy ? null : submit,
              icon: const Icon(Icons.flash_on),
              label: Text(busy ? 'جاري الإنشاء...' : 'بدء الحملة'),
              style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
            ),
          ],
        ),
      ),
    );
  }
}
