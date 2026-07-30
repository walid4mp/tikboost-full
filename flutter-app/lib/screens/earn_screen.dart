import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';

class EarnScreen extends ConsumerStatefulWidget {
  const EarnScreen({super.key});

  @override
  ConsumerState<EarnScreen> createState() => _EarnScreenState();
}

class _EarnScreenState extends ConsumerState<EarnScreen>
    with SingleTickerProviderStateMixin {
  List<dynamic> tasks = [];
  bool loading = true;
  String? error;
  late final TabController tab;
  final Set<String> openedTasks = <String>{};
  final Set<String> submittingTasks = <String>{};

  static const List<String?> typeFilters = <String?>[
    null,
    'FOLLOWERS',
    'LIKES',
    'VIEWS',
    'COMMENTS',
  ];

  @override
  void initState() {
    super.initState();
    tab = TabController(length: 5, vsync: this);
    load();
  }

  @override
  void dispose() {
    tab.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });

    try {
      final response = await ApiClient.instance.dio.get(
        '/campaigns/tasks',
        queryParameters: {'limit': 50},
      );
      tasks = (response.data['tasks'] as List?) ?? <dynamic>[];
    } catch (e) {
      error = (e as dynamic).response?.data?['message'] ?? e.toString();
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> openTask(dynamic task) async {
    final url = Uri.tryParse('${task['targetUrl'] ?? ''}');
    if (url == null) {
      _showError('رابط المهمة غير صالح');
      return;
    }

    try {
      final opened = await launchUrl(
        url,
        mode: LaunchMode.externalApplication,
      );

      if (!opened) {
        _showError('تعذر فتح رابط المهمة');
        return;
      }

      if (!mounted) return;
      setState(() => openedTasks.add('${task['id']}'));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('تم فتح الرابط. بعد تنفيذ المهمة ارجع واضغط "تم التنفيذ".'),
          backgroundColor: AppColors.blue,
        ),
      );
    } catch (_) {
      _showError('تعذر فتح رابط المهمة');
    }
  }

  Future<void> markExecuted(dynamic task) async {
    final taskId = '${task['id']}';

    setState(() => submittingTasks.add(taskId));
    final messenger = ScaffoldMessenger.of(context);

    try {
      await ApiClient.instance.dio.post(
        '/tasks/execute',
        data: {'campaignId': taskId},
      );

      messenger.showSnackBar(
        SnackBar(
          content: Text('تم التنفيذ! ربحت ${task['rewardPoints']} نقطة'),
          backgroundColor: AppColors.success,
        ),
      );

      await ref.read(authProvider).bootstrap();
      openedTasks.remove(taskId);
      await load();
    } catch (e) {
      final message = (e as dynamic).response?.data?['message'] ?? 'تعذر تنفيذ المهمة';
      messenger.showSnackBar(
        SnackBar(content: Text(message), backgroundColor: AppColors.red),
      );
    } finally {
      if (mounted) {
        setState(() => submittingTasks.remove(taskId));
      }
    }
  }

  Future<void> copyComment(dynamic task) async {
    final text = '${task['commentText'] ?? ''}'.trim();
    if (text.isEmpty) return;

    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('تم نسخ نص التعليق'),
        backgroundColor: AppColors.success,
      ),
    );
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.red),
    );
  }

  List<dynamic> _tasksForType(String? type) {
    if (type == null) return tasks;
    return tasks.where((task) => task['type'] == type).toList();
  }

  IconData _icon(String type) {
    switch (type) {
      case 'FOLLOWERS':
        return Icons.person_add_alt_1_rounded;
      case 'LIKES':
        return Icons.favorite_rounded;
      case 'VIEWS':
        return Icons.visibility_rounded;
      case 'COMMENTS':
        return Icons.chat_bubble_rounded;
      default:
        return Icons.task_alt_rounded;
    }
  }

  String _label(String type) {
    switch (type) {
      case 'FOLLOWERS':
        return 'متابعة حساب';
      case 'LIKES':
        return 'إعجاب';
      case 'VIEWS':
        return 'مشاهدة';
      case 'COMMENTS':
        return 'تعليق';
      default:
        return type;
    }
  }

  Color _color(String type) {
    switch (type) {
      case 'FOLLOWERS':
        return AppColors.blue;
      case 'LIKES':
        return AppColors.red;
      case 'VIEWS':
        return Colors.purpleAccent;
      case 'COMMENTS':
        return Colors.tealAccent;
      default:
        return AppColors.success;
    }
  }

  String _targetText(dynamic task) {
    final targetUsername = '${task['targetUsername'] ?? ''}'.trim();
    if (targetUsername.startsWith('@')) return targetUsername;
    return '${task['targetUrl'] ?? ''}'.trim();
  }

  Widget _emptyState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.inbox_outlined,
            size: 64,
            color: AppColors.textMuted,
          ),
          const SizedBox(height: 12),
          const Text('لا توجد مهام حالياً'),
          TextButton(onPressed: load, child: const Text('تحديث')),
        ],
      ),
    );
  }

  Widget _taskList(List<dynamic> items) {
    if (items.isEmpty) return _emptyState();

    return RefreshIndicator(
      onRefresh: load,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: items.length,
        itemBuilder: (_, index) {
          final task = items[index];
          final taskId = '${task['id']}';
          final color = _color('${task['type']}');
          final opened = openedTasks.contains(taskId);
          final submitting = submittingTasks.contains(taskId);
          final commentText = '${task['commentText'] ?? ''}'.trim();

          return Card(
            margin: const EdgeInsets.symmetric(vertical: 6),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Icon(_icon('${task['type']}'), color: color, size: 28),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _label('${task['type']}'),
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 15,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _targetText(task),
                              style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                const Icon(Icons.bolt, color: AppColors.success, size: 16),
                                const SizedBox(width: 4),
                                Text(
                                  '${task['rewardPoints']} نقطة',
                                  style: const TextStyle(
                                    color: AppColors.success,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (commentText.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'نص التعليق المطلوب',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.textMuted,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(commentText),
                          const SizedBox(height: 10),
                          OutlinedButton.icon(
                            onPressed: () => copyComment(task),
                            icon: const Icon(Icons.copy_rounded),
                            label: const Text('نسخ التعليق'),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          onPressed: submitting ? null : () => openTask(task),
                          child: const Text('نفّذ'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: (!opened || submitting)
                              ? null
                              : () => markExecuted(task),
                          child: Text(submitting ? 'جاري التحقق...' : 'تم التنفيذ'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
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
            Tab(text: 'متابعين'),
            Tab(text: 'لايكات'),
            Tab(text: 'مشاهدات'),
            Tab(text: 'تعليقات'),
          ],
        ),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, size: 56, color: AppColors.red),
                        const SizedBox(height: 12),
                        Text(error!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        TextButton(onPressed: load, child: const Text('إعادة المحاولة')),
                      ],
                    ),
                  ),
                )
              : TabBarView(
                  controller: tab,
                  children: typeFilters
                      .map((type) => _taskList(_tasksForType(type)))
                      .toList(),
                ),
    );
  }
}
