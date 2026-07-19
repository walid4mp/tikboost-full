import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';

class EarnScreen extends ConsumerStatefulWidget {
  const EarnScreen({super.key});
  @override
  ConsumerState<EarnScreen> createState() => _EarnScreenState();
}

class _EarnScreenState extends ConsumerState<EarnScreen> with SingleTickerProviderStateMixin {
  List<dynamic> tasks = [];
  bool loading = true;
  String? error;
  String filter = 'ALL';
  late final TabController tab;

  @override
  void initState() {
    super.initState();
    tab = TabController(length: 5, vsync: this);
    load();
  }

  Future<void> load() async {
    setState(() { loading = true; error = null; });
    try {
      final r = await ApiClient.instance.dio.get('/tasks/feed', queryParameters: {'limit': 30});
      tasks = r.data['tasks'] as List;
    } catch (e) {
      error = e.toString();
    } finally { setState(() => loading = false); }
  }

  Future<void> execute(dynamic task) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final r = await ApiClient.instance.dio.post('/tasks/execute', data: {'campaignId': task['id']});
      messenger.showSnackBar(SnackBar(
        content: Text('تم! ربحت ${task['rewardPoints']} نقطة'),
        backgroundColor: AppColors.success,
      ));
      await ref.read(authProvider).bootstrap();
      load();
    } catch (e) {
      final msg = (e as dynamic).response?.data?['message'] ?? 'تعذر تنفيذ المهمة';
      messenger.showSnackBar(SnackBar(content: Text(msg), backgroundColor: AppColors.red));
    }
  }

  IconData _icon(String type) {
    switch (type) {
      case 'FOLLOWERS': return Icons.person_add_alt_1_rounded;
      case 'LIKES':     return Icons.favorite_rounded;
      case 'VIEWS':     return Icons.visibility_rounded;
      case 'COMMENTS':  return Icons.chat_bubble_rounded;
      default:          return Icons.task_alt_rounded;
    }
  }
  String _label(String type) {
    switch (type) {
      case 'FOLLOWERS': return 'متابعة حساب';
      case 'LIKES':     return 'إعجاب';
      case 'VIEWS':     return 'مشاهدة';
      case 'COMMENTS':  return 'تعليق';
      default:          return type;
    }
  }
  Color _color(String type) {
    switch (type) {
      case 'FOLLOWERS': return AppColors.blue;
      case 'LIKES':     return AppColors.red;
      case 'VIEWS':     return Colors.purpleAccent;
      case 'COMMENTS':  return Colors.tealAccent;
      default:          return AppColors.success;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('جمع النقاط'),
        bottom: TabBar(
          controller: tab,
          isScrollable: true,
          indicatorColor: AppColors.red,
          labelColor: AppColors.red,
          unselectedLabelColor: AppColors.textMuted,
          tabs: const [
            Tab(text: 'الكل'),
            Tab(text: 'متابعة'),
            Tab(text: 'لايكات'),
            Tab(text: 'مشاهدات'),
            Tab(text: 'تعليقات'),
          ],
        ),
      ),
      body: loading
        ? const Center(child: CircularProgressIndicator())
        : tasks.isEmpty
          ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.inbox_outlined, size: 64, color: AppColors.textMuted),
              const SizedBox(height: 12),
              const Text('لا توجد مهام حالياً'),
              TextButton(onPressed: load, child: const Text('تحديث')),
            ]))
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: tasks.length,
              itemBuilder: (_, i) {
                final t = tasks[i];
                final c = _color(t['type']);
                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 6),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(children: [
                      Container(
                        width: 52, height: 52,
                        decoration: BoxDecoration(
                          color: c.withOpacity(0.15), borderRadius: BorderRadius.circular(14)),
                        child: Icon(_icon(t['type']), color: c, size: 28)),
                      const SizedBox(width: 12),
                      Expanded(child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_label(t['type']),
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                          const SizedBox(height: 4),
                          Text('@${t['targetUsername']}',
                            style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                          const SizedBox(height: 6),
                          Row(children: [
                            const Icon(Icons.bolt, color: AppColors.success, size: 16),
                            const SizedBox(width: 4),
                            Text('${t['rewardPoints']} نقطة',
                              style: const TextStyle(color: AppColors.success,
                                fontWeight: FontWeight.w700)),
                          ]),
                        ])),
                      ElevatedButton(
                        onPressed: () => execute(t),
                        child: const Text('نفّذ'),
                      ),
                    ]),
                  ),
                );
              },
            ),
    );
  }
}
