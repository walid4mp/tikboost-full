import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).state.user;
    final balance = user?.points ?? 0;
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          await ref.read(authProvider).bootstrap();
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const SizedBox(height: 4),
            Row(children: [
              CircleAvatar(radius: 22, backgroundColor: AppColors.red.withOpacity(0.2),
                child: const Icon(Icons.person, color: AppColors.red)),
              const SizedBox(width: 10),
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('أهلاً ${user?.name ?? ""} 👋',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  Text('#${user?.referralCode ?? ""}',
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                ])),
              IconButton(
                onPressed: () => context.push('/notifications'),
                icon: const Icon(Icons.notifications_none),
                tooltip: 'الإشعارات',
              ),
            ]),
            const SizedBox(height: 16),
            _BalanceCard(balance: balance),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: ElevatedButton.icon(
                onPressed: () => context.go('/earn'),
                icon: const Icon(Icons.bolt),
                label: const Text('ابدأ جمع النقاط'),
                style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 18)),
              )),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: OutlinedButton.icon(
                onPressed: () => context.go('/create'),
                icon: const Icon(Icons.add_circle_outline, color: AppColors.red),
                label: const Text('إنشاء حملة',
                  style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w700)),
              )),
              const SizedBox(width: 10),
              Expanded(child: OutlinedButton.icon(
                onPressed: () => context.push('/referrals'),
                icon: const Icon(Icons.card_giftcard, color: AppColors.blue),
                label: const Text('الإحالات',
                  style: TextStyle(color: AppColors.blue, fontWeight: FontWeight.w700)),
              )),
            ]),
            const SizedBox(height: 16),
            const Text('آخر الحملات', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            _MyCampaigns(),
          ],
        ),
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  final int balance;
  const _BalanceCard({required this.balance});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.red, AppColors.redDeep],
          begin: Alignment.topLeft, end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: AppColors.red.withOpacity(0.35),
          blurRadius: 18, offset: const Offset(0, 8))],
      ),
      child: Row(children: [
        const Icon(Icons.local_fire_department, color: Colors.white, size: 44),
        const SizedBox(width: 12),
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('رصيد النقاط', style: TextStyle(color: Colors.white70)),
            const SizedBox(height: 4),
            Text('$balance',
              style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900)),
          ],
        )),
      ]),
    );
  }
}

class _MyCampaigns extends ConsumerStatefulWidget {
  @override
  ConsumerState<_MyCampaigns> createState() => _MyCampaignsState();
}

class _MyCampaignsState extends ConsumerState<_MyCampaigns> {
  List<dynamic> items = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final r = await ApiClient.instance.dio.get('/campaigns/mine');
      setState(() { items = (r.data['campaigns'] as List).take(5).toList(); });
    } catch (_) {} finally { setState(() => loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Padding(padding: EdgeInsets.all(20),
      child: Center(child: CircularProgressIndicator()));
    if (items.isEmpty) {
      return Card(child: const ListTile(
        leading: Icon(Icons.campaign_outlined, color: AppColors.red),
        title: Text('لا توجد حملات بعد'),
        subtitle: Text('اضغط "إنشاء حملة" للبدء.'),
      ));
    }
    return Card(child: Column(children: [
      for (final c in items)
        ListTile(
          leading: const Icon(Icons.bolt, color: AppColors.red),
          title: Text('${c['type']} • @${c['targetUsername']}'),
          subtitle: Text('${c['completed']}/${c['quantity']} • ${c['status']}'),
          trailing: Text('${c['perTaskReward']}',
            style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w700)),
        ),
    ]));
  }
}
