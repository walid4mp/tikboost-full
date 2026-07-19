import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});
  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  List<dynamic> logs = [];
  bool loading = true;

  @override
  void initState() { super.initState(); load(); }

  Future<void> load() async {
    try {
      final r = await ApiClient.instance.dio.get('/user/points/history');
      setState(() => logs = r.data['logs'] ?? []);
    } catch (_) {} finally { setState(() => loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).state.user;
    return Scaffold(
      appBar: AppBar(
        title: const Text('الملف الشخصي'),
        actions: [IconButton(onPressed: () => context.push('/settings'),
          icon: const Icon(Icons.settings))],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(children: [
              CircleAvatar(radius: 32, backgroundColor: AppColors.red.withOpacity(0.15),
                child: const Icon(Icons.person, color: AppColors.red, size: 32)),
              const SizedBox(width: 14),
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(user?.name ?? '',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  Text(user?.email ?? '',
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: AppColors.success.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(8)),
                    child: Text('${user?.points ?? 0} نقطة',
                      style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w700)),
                  ),
                ])),
            ]),
          )),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(child: Card(child: ListTile(
              leading: const Icon(Icons.campaign_outlined, color: AppColors.red),
              title: const Text('حملاتي'),
              onTap: () => context.push('/campaigns'),
            ))),
            const SizedBox(width: 10),
            Expanded(child: Card(child: ListTile(
              leading: const Icon(Icons.history, color: AppColors.blue),
              title: const Text('السجل'),
              onTap: () {},
            ))),
          ]),
          const SizedBox(height: 14),
          Card(child: Column(children: [
            const ListTile(
              leading: Icon(Icons.notifications, color: AppColors.red),
              title: Text('الإشعارات'),
            ),
            ListTile(
              leading: const Icon(Icons.support_agent, color: AppColors.blue),
              title: const Text('اتصل بنا'),
              onTap: () => context.push('/contact'),
            ),
            ListTile(
              leading: const Icon(Icons.casino, color: Colors.purple),
              title: const Text('عجلة الحظ'),
              onTap: () => context.push('/wheel'),
            ),
          ])),
          const SizedBox(height: 18),
          const Text('آخر العمليات',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 8),
          if (loading) const Padding(padding: EdgeInsets.all(20),
            child: Center(child: CircularProgressIndicator()))
          else if (logs.isEmpty) Card(child: const Padding(
              padding: EdgeInsets.all(20),
              child: Text('لا توجد عمليات')))
          else for (final l in logs.take(20))
            Card(child: ListTile(
              dense: true,
              leading: Icon(int.parse('${l['delta']}') >= 0
                ? Icons.add_circle : Icons.remove_circle,
                color: int.parse('${l['delta']}') >= 0
                  ? AppColors.success : AppColors.red),
              title: Text(prettyReason('${l['reason']}')),
              subtitle: Text(l['createdAt']?.toString() ?? ''),
              trailing: Text('${l['delta']}',
                style: TextStyle(color: int.parse('${l['delta']}') >= 0
                  ? AppColors.success : AppColors.red, fontWeight: FontWeight.w800)),
            )),
        ],
      ),
    );
  }

  String prettyReason(String r) {
    switch (r) {
      case 'TASK_REWARD':    return 'مكافأة مهمة';
      case 'CAMPAIGN_SPEND': return 'إنشاء حملة';
      case 'PURCHASE':       return 'شراء نقاط';
      case 'ADMIN_GRANT':    return 'إضافة من الإدارة';
      case 'ADMIN_DEDUCT':   return 'خصم من الإدارة';
      case 'REFERRAL_BONUS': return 'مكافأة إحالة';
      case 'SPIN_REWARD':    return 'عجلة الحظ';
      case 'REFUND':         return 'استرداد';
      case 'SIGNUP_BONUS':   return 'مكافأة ترحيب';
      default: return r;
    }
  }
}
