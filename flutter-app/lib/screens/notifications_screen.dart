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
  bool loading = true;

  @override
  void initState() { super.initState(); load(); }

  Future<void> load() async {
    try {
      final r = await ApiClient.instance.dio.get('/notifications');
      setState(() => items = r.data['notifications'] ?? []);
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
      appBar: AppBar(title: const Text('الإشعارات')),
      body: RefreshIndicator(
        onRefresh: load,
        child: loading
          ? const Center(child: CircularProgressIndicator())
          : items.isEmpty
            ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.notifications_off_outlined, size: 60, color: AppColors.textMuted),
                const SizedBox(height: 10),
                const Text('لا توجد إشعارات'),
              ]))
            : ListView.builder(
                itemCount: items.length,
                itemBuilder: (_, i) {
                  final n = items[i];
                  final c = _color(n['type'] ?? 'info');
                  return ListTile(
                    leading: CircleAvatar(
                      backgroundColor: c.withOpacity(0.18),
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
