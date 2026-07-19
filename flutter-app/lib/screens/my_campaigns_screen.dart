import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../config/app_theme.dart';
import '../services/api_client.dart';

class MyCampaignsScreen extends ConsumerStatefulWidget {
  const MyCampaignsScreen({super.key});
  @override
  ConsumerState<MyCampaignsScreen> createState() => _MyCampaignsScreenState();
}

class _MyCampaignsScreenState extends ConsumerState<MyCampaignsScreen> {
  List<dynamic> items = [];
  bool loading = true;

  @override
  void initState() { super.initState(); load(); }

  Future<void> load() async {
    try {
      final r = await ApiClient.instance.dio.get('/campaigns/mine');
      setState(() => items = r.data['campaigns'] ?? []);
    } catch (_) {} finally { setState(() => loading = false); }
  }

  Future<void> action(String id, String act) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ApiClient.instance.dio.post('/campaigns/$id/$act');
      messenger.showSnackBar(
        SnackBar(content: Text(act == 'pause' ? 'تم الإيقاف' : 'تم الإلغاء'),
        backgroundColor: AppColors.success));
      load();
    } catch (e) {
      final m = (e as dynamic).response?.data?['message'] ?? 'فشل';
      messenger.showSnackBar(SnackBar(content: Text(m)));
    }
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'ACTIVE':    return AppColors.success;
      case 'PAUSED':    return Colors.amber;
      case 'COMPLETED': return AppColors.blue;
      case 'CANCELLED': return AppColors.red;
      default:          return AppColors.textMuted;
    }
  }

  IconData _typeIcon(String t) {
    switch (t) {
      case 'FOLLOWERS': return Icons.person_add_alt_1_rounded;
      case 'LIKES':     return Icons.favorite_rounded;
      case 'VIEWS':     return Icons.visibility_rounded;
      case 'COMMENTS':  return Icons.chat_bubble_rounded;
      default:          return Icons.campaign_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('حملاتي')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/create'),
        icon: const Icon(Icons.add),
        label: const Text('حملة جديدة'),
        backgroundColor: AppColors.red,
      ),
      body: loading
        ? const Center(child: CircularProgressIndicator())
        : items.isEmpty
          ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.campaign_outlined, size: 64, color: AppColors.textMuted),
              const SizedBox(height: 12),
              const Text('لا توجد حملات'),
              const SizedBox(height: 14),
              ElevatedButton.icon(
                onPressed: () => context.push('/create'),
                icon: const Icon(Icons.add),
                label: const Text('إنشاء أول حملة'),
              ),
            ]))
          : RefreshIndicator(onRefresh: load, child: ListView.builder(
              padding: const EdgeInsets.all(14),
              itemCount: items.length,
              itemBuilder: (_, i) {
                final c = items[i];
                final progress = (c['completed'] / (c['quantity'] == 0 ? 1 : c['quantity']));
                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 6),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Icon(_typeIcon(c['type']), color: AppColors.red),
                        const SizedBox(width: 10),
                        Expanded(child: Text('${c['type']} • @${c['targetUsername']}',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15))),
                        Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: _statusColor(c['status']).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8)),
                          child: Text(c['status'],
                            style: TextStyle(color: _statusColor(c['status']),
                              fontWeight: FontWeight.w700, fontSize: 11))),
                      ]),
                      const SizedBox(height: 10),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: LinearProgressIndicator(
                          value: progress.clamp(0, 1).toDouble(),
                          minHeight: 8,
                          backgroundColor: AppColors.border,
                          color: AppColors.red,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(children: [
                        Text('${c['completed']} / ${c['quantity']}',
                          style: const TextStyle(color: AppColors.textMuted)),
                        const Spacer(),
                        Text('${c['perTaskReward']} نقطة لكل مهمة',
                          style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w700)),
                      ]),
                      const SizedBox(height: 10),
                      if (c['status'] == 'ACTIVE' || c['status'] == 'PAUSED')
                        Row(children: [
                          if (c['status'] == 'ACTIVE')
                            TextButton.icon(
                              onPressed: () => action(c['id'], 'pause'),
                              icon: const Icon(Icons.pause, size: 18),
                              label: const Text('إيقاف مؤقت')),
                          if (c['status'] == 'PAUSED')
                            TextButton.icon(
                              onPressed: () => action(c['id'], 'pause'),
                              icon: const Icon(Icons.play_arrow, size: 18),
                              label: const Text('استئناف')),
                          TextButton.icon(
                            onPressed: () => action(c['id'], 'cancel'),
                            icon: const Icon(Icons.cancel, color: AppColors.red, size: 18),
                            label: const Text('إلغاء',
                              style: TextStyle(color: AppColors.red))),
                        ]),
                    ]),
                  ),
                );
              },
            )),
    );
  }
}
