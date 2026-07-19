import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_theme.dart';
import '../services/api_client.dart';

class ReferralsScreen extends ConsumerStatefulWidget {
  const ReferralsScreen({super.key});
  @override
  ConsumerState<ReferralsScreen> createState() => _ReferralsScreenState();
}

class _ReferralsScreenState extends ConsumerState<ReferralsScreen> {
  Map<String, dynamic>? data;
  bool loading = true;

  @override
  void initState() { super.initState(); load(); }

  Future<void> load() async {
    try {
      final r = await ApiClient.instance.dio.get('/referrals');
      setState(() => data = r.data as Map<String, dynamic>);
    } catch (_) {} finally { setState(() => loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    final d = data ?? {};
    final code = d['code'] ?? '';
    final link = d['link'] ?? '';
    return Scaffold(
      appBar: AppBar(title: const Text('الإحالات')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.blue, Color(0xFF1E40AF)],
                begin: Alignment.topLeft, end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(children: [
              const Icon(Icons.card_giftcard, color: Colors.white, size: 50),
              const SizedBox(height: 8),
              Text('${d['friends'] ?? 0}',
                style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w900)),
              const Text('صديق انضم عبر رابطك',
                style: TextStyle(color: Colors.white70)),
              const SizedBox(height: 12),
              Text('ربحت ${d['earned'] ?? 0} نقطة',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
            ]),
          ),
          const SizedBox(height: 20),
          Card(child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('كود الدعوة',
                style: TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Row(children: [
                Expanded(child: SelectableText(code,
                  style: const TextStyle(fontSize: 18, color: AppColors.red, fontWeight: FontWeight.w900))),
                IconButton(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: code));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('تم النسخ')));
                  },
                  icon: const Icon(Icons.copy, color: AppColors.blue)),
              ]),
              if (link.toString().isNotEmpty) ...[
                const SizedBox(height: 10),
                SelectableText(link,
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
              ],
            ]),
          )),
          const SizedBox(height: 10),
          Card(child: ListTile(
            leading: const Icon(Icons.person_add, color: AppColors.blue),
            title: const Text('قائمة الأصدقاء'),
            subtitle: Text('انضم ${(d['referrals'] as List?)?.length ?? 0} أصدقاء'),
          )),
        ],
      ),
    );
  }
}
