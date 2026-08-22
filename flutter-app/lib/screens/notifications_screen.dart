import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_theme.dart';
import '../services/api_client.dart';

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
  void initState() { super.initState(); load(); }

  Future<void> load() async {
    try {
      final r = await ApiClient.instance.dio.get('/notifications');
      setState(() { items = r.data['notifications'] ?? []; unreadCount = int.tryParse('${r.data['unreadCount'] ?? 0}') ?? 0; });
    } catch (_) {} finally { setState(() => loading = false); }
  }

  IconData _icon(String t) {
    switch (t) {
      case 'success': return Icons.check_circle;
      case 'warning': return Icons.warning_rounded;
      case 'reward':  return Icons.card_giftcard;
      default:        return Icons.info_outline;
    }
  }

  Color _color(String t) {
    switch (t) {
      case 'success': return AppColors.success;
      case 'warning': return Colors.amber;
      case 'reward':  return AppColors.red;
      default:        return AppColors.blue;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(unreadCount > 0 ? 'الإشعارات ($unreadCount)' : 'الإشعارات')),
      body: RefreshIndicator(
        onRefresh: load,
        child: loading
          ? const Center(child: CircularProgressIndicator())
          : items.isEmpty
            ? const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.notifications_off_outlined, size: 60, color: AppColors.textMuted),
                SizedBox(height: 10),
                Text('لا توجد إشعارات'),
              ]))
            : ListView.builder(
                itemCount: items.length,
                itemBuilder: (_, i) {
                  final n = items[i];
                  final c = _color(n['type'] ?? 'info');
                  return ListTile(
                    onTap: () async {
                      if (n['readAt'] == null) {
                        try { await ApiClient.instance.dio.post('/notifications/${n['id']}/read'); } catch (_) {}
                        if (mounted) setState(() { n['readAt'] = DateTime.now().toIso8601String(); if (unreadCount > 0) unreadCount--; });
                      }
                    },
                    leading: CircleAvatar(
                      backgroundColor: c.withValues(alpha: 0.18),
                      child: Icon(_icon(n['type'] ?? 'info'), color: c)),
                    title: Text(n['title'] ?? '',
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text(n['body'] ?? ''),
                    trailing: (n['readAt'] == null)
                      ? Container(width: 8, height: 8,
                          decoration: const BoxDecoration(color: AppColors.red, shape: BoxShape.circle))
                      : null,
                  );
                }),
      ),
    );
  }
}
