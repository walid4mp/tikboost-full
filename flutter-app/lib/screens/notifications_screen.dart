import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_theme.dart';
import '../services/api_client.dart';
import '../services/sound_service.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});
  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  List<dynamic> items = [];
  int unreadCount = 0;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final r = await ApiClient.instance.dio.get('/notifications');
      if (!mounted) return;
      setState(() {
        items = List<dynamic>.from(r.data['notifications'] ?? const []);
        unreadCount = int.tryParse('${r.data['unreadCount'] ?? 0}') ?? 0;
      });
    } catch (_) {
      // Keep the previous inbox visible when the network is temporarily unavailable.
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  IconData _icon(String t) {
    switch (t) {
      case 'success': return Icons.check_circle_rounded;
      case 'warning': return Icons.warning_amber_rounded;
      case 'reward': return Icons.card_giftcard_rounded;
      default: return Icons.notifications_rounded;
    }
  }

  Color _color(String t) {
    switch (t) {
      case 'success': return AppColors.success;
      case 'warning': return Colors.amber;
      case 'reward': return AppColors.red;
      default: return AppColors.blue;
    }
  }

  Future<void> _openNotification(Map<String, dynamic> n) async {
    await SoundService.instance.playTap();
    final wasUnread = n['readAt'] == null;

    if (wasUnread) {
      try {
        await ApiClient.instance.dio.post('/notifications/${n['id']}/read');
        if (mounted) {
          setState(() {
            n['readAt'] = DateTime.now().toIso8601String();
            if (unreadCount > 0) unreadCount--;
          });
        }
      } catch (_) {}
    }

    if (!mounted) return;
    final type = '${n['type'] ?? 'info'}';
    final color = _color(type);
    final createdAt = DateTime.tryParse('${n['createdAt'] ?? ''}');

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => SafeArea(
        child: Container(
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 5,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .16),
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: .14),
                      shape: BoxShape.circle,
                      border: Border.all(color: color.withValues(alpha: .28)),
                    ),
                    child: Icon(_icon(type), color: color, size: 28),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      '${n['title'] ?? ''}',
                      style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .035),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.white.withValues(alpha: .07)),
                ),
                child: Text(
                  '${n['body'] ?? ''}',
                  style: const TextStyle(fontSize: 16, height: 1.65),
                ),
              ),
              if (createdAt != null) ...[
                const SizedBox(height: 12),
                Text(
                  _formatDate(createdAt),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                ),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => Navigator.pop(context),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                ),
                child: const Text('تم', style: TextStyle(fontWeight: FontWeight.w800)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    final local = date.toLocal();
    final mm = local.minute.toString().padLeft(2, '0');
    final hh = local.hour.toString().padLeft(2, '0');
    return '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}/${local.year} • $hh:$mm';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(unreadCount > 0 ? 'الإشعارات ($unreadCount)' : 'الإشعارات'),
        actions: [
          if (items.isNotEmpty)
            IconButton(onPressed: load, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: load,
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : items.isEmpty
                ? ListView(children: const [
                    SizedBox(height: 180),
                    Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.notifications_off_outlined, size: 60, color: AppColors.textMuted),
                      SizedBox(height: 10),
                      Text('لا توجد إشعارات'),
                    ])),
                  ])
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 28),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 9),
                    itemBuilder: (_, i) {
                      final n = Map<String, dynamic>.from(items[i] as Map);
                      final type = '${n['type'] ?? 'info'}';
                      final c = _color(type);
                      final unread = n['readAt'] == null;
                      return Material(
                        color: Colors.transparent,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(20),
                          onTap: () => _openNotification(n),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: unread ? Colors.white.withValues(alpha: .055) : Colors.white.withValues(alpha: .025),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: unread ? c.withValues(alpha: .22) : Colors.white.withValues(alpha: .06)),
                              boxShadow: unread ? [BoxShadow(color: c.withValues(alpha: .07), blurRadius: 18)] : const [],
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 50,
                                  height: 50,
                                  decoration: BoxDecoration(color: c.withValues(alpha: .13), shape: BoxShape.circle),
                                  child: Icon(_icon(type), color: c, size: 26),
                                ),
                                const SizedBox(width: 13),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(child: Text('${n['title'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: unread ? FontWeight.w900 : FontWeight.w700, fontSize: 15))),
                                          if (unread) Container(width: 9, height: 9, decoration: const BoxDecoration(color: AppColors.red, shape: BoxShape.circle)),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text('${n['body'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: unread ? Colors.white.withValues(alpha: .86) : AppColors.textMuted, height: 1.35)),
                                      const SizedBox(height: 6),
                                      const Text('اضغط لفتح التفاصيل', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 5),
                                const Icon(Icons.chevron_left_rounded, color: AppColors.textMuted),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}
