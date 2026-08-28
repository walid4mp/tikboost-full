import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../config/app_theme.dart';
import '../data/countries.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';
import '../services/sound_service.dart';
import '../config/app_config.dart';
import 'package:url_launcher/url_launcher.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  List<dynamic> logs = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final history = await ApiClient.instance.dio
          .get('/user/points/history')
          .timeout(const Duration(seconds: 12), onTimeout: () => throw Exception('timeout'));
      logs = history.data['logs'] ?? [];
      await ref.read(authProvider).refreshCurrentUser();
    } catch (e) {
      error = (e as dynamic).response?.data?['message'] ?? 'تعذر تحميل البيانات';
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).state.user;
    final country = kCountries.where((item) => item.code == user?.countryCode).cast<CountryItem?>().firstOrNull;

    return Scaffold(
      appBar: AppBar(
        title: const Text('الملف الشخصي'),
        actions: [
          IconButton(
            onPressed: () => context.push('/settings'),
            icon: const Icon(Icons.settings),
          ),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(error!, style: const TextStyle(color: Colors.redAccent)),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: load, child: const Text('إعادة المحاولة')),
                    ],
                  ),
                )
              : RefreshIndicator(
        onRefresh: load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.red.withValues(alpha: 0.14),
                    AppColors.blue.withValues(alpha: 0.12),
                  ],
                ),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: AppColors.red.withValues(alpha: 0.15),
                    child: const Icon(Icons.person, color: AppColors.red, size: 34),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    user?.name ?? '',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    user?.email ?? '',
                    style: const TextStyle(color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    alignment: WrapAlignment.center,
                    children: [
                      _infoChip(
                        icon: Icons.badge_outlined,
                        text: user?.gender == 'FEMALE' ? 'أنثى' : 'ذكر',
                      ),
                      _infoChip(
                        icon: Icons.flag_outlined,
                        text: country == null
                            ? 'غير محددة'
                            : '${country.flag} ${country.nameAr}',
                      ),
                      _infoChip(
                        icon: Icons.account_balance_wallet_outlined,
                        text: '${user?.points ?? 0} نقطة',
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _statCard(
                    title: 'الرصيد',
                    value: '${user?.points ?? 0}',
                    color: AppColors.success,
                    icon: Icons.savings_outlined,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _statCard(
                    title: 'إجمالي الأرباح',
                    value: '${user?.totalEarned ?? 0}',
                    color: AppColors.blue,
                    icon: Icons.trending_up_rounded,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _statCard(
              title: 'إجمالي الإنفاق',
              value: '${user?.totalSpent ?? 0}',
              color: AppColors.warning,
              icon: Icons.shopping_bag_outlined,
            ),
            Card(
              child: ListTile(
                leading: const Icon(Icons.receipt_long_rounded, color: AppColors.blue),
                title: const Text('طلبات الدفع وحالتها'),
                subtitle: const Text('راجع طلبات الشراء، الإثباتات، والموافقة أو الرفض.'),
                trailing: const Icon(Icons.chevron_left_rounded),
                onTap: () { SoundService.instance.playTap(); context.push('/payments/history'); },
              ),
            ),
            const SizedBox(height: 10),
            Card(
              child: ListTile(
                leading: const Icon(Icons.star_rate_rounded, color: Colors.amber),
                title: const Text('قيّم التطبيق ⭐'),
                subtitle: const Text('ساعدنا بتقييم التطبيق واحصل على المكافأة إن كانت مفعلة.'),
                trailing: const Icon(Icons.open_in_new_rounded),
                onTap: () async {
                  await SoundService.instance.playTap();
                  final raw = AppConfig.notifications['reviewUrl']?.toString().trim() ?? '';
                  final uri = Uri.tryParse(raw);
                  if (uri == null || raw.isEmpty || !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
                    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('رابط تقييم التطبيق غير مضبوط حالياً.')));
                  }
                },
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: Card(
                    child: ListTile(
                      leading: const Icon(Icons.campaign_outlined,
                          color: AppColors.red),
                      title: const Text('حملاتي'),
                      onTap: () async { await SoundService.instance.playTap(); context.push('/campaigns'); },
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Card(
                    child: ListTile(
                      leading: const Icon(Icons.casino, color: Colors.purple),
                      title: const Text('عجلة الحظ'),
                      onTap: () async { await SoundService.instance.playTap(); context.push('/wheel'); },
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: Card(
                    child: ListTile(
                      leading: const Icon(Icons.notifications_none,
                          color: AppColors.red),
                      title: const Text('الإشعارات'),
                      onTap: () { SoundService.instance.playTap(); context.push('/notifications'); },
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Card(
                    child: ListTile(
                      leading: const Icon(Icons.support_agent,
                          color: AppColors.blue),
                      title: const Text('اتصل بنا'),
                      onTap: () { SoundService.instance.playTap(); context.push('/contact'); },
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Card(
              child: ListTile(
                leading: const Icon(Icons.card_giftcard_rounded, color: AppColors.blue),
                title: const Text('برنامج الإحالة'),
                subtitle: const Text('ادعُ أصدقاءك واحصل على مكافآت إضافية'),
                trailing: const Icon(Icons.chevron_left_rounded),
                onTap: () { SoundService.instance.playTap(); context.push('/referrals'); },
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                const Text(
                  'آخر العمليات',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: load,
                  icon: const Icon(Icons.refresh),
                  label: const Text('تحديث'),
                ),
              ],
            ),
            if (loading)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (error != null)
              _stateCard(
                icon: Icons.wifi_off_rounded,
                title: 'تعذر التحميل',
                subtitle: error!,
                actionLabel: 'إعادة المحاولة',
                onTap: load,
              )
            else if (logs.isEmpty)
              _stateCard(
                icon: Icons.inbox_outlined,
                title: 'لا توجد عمليات حتى الآن',
                subtitle: 'ابدأ بتنفيذ المهام أو إنشاء الحملات ليظهر السجل هنا.',
                actionLabel: 'تحديث',
                onTap: load,
              )
            else
              ...logs.take(20).map(
                (l) {
                  final delta = int.tryParse('${l['delta']}') ?? 0;
                  final positive = delta >= 0;
                  return Card(
                    child: ListTile(
                      dense: true,
                      leading: Icon(
                        positive ? Icons.add_circle : Icons.remove_circle,
                        color: positive ? AppColors.success : AppColors.red,
                      ),
                      title: Text(prettyReason('${l['reason']}')),
                      subtitle: Text(l['createdAt']?.toString() ?? ''),
                      trailing: Text(
                        '${l['delta']}',
                        style: TextStyle(
                          color: positive ? AppColors.success : AppColors.red,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _infoChip({required IconData icon, required String text}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: AppColors.textMuted),
          const SizedBox(width: 6),
          Text(text),
        ],
      ),
    );
  }

  Widget _statCard({
    required String title,
    required String value,
    required Color color,
    required IconData icon,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(color: AppColors.textMuted)),
                  const SizedBox(height: 4),
                  Text(value,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 18)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stateCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required String actionLabel,
    required VoidCallback onTap,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Icon(icon, size: 42, color: AppColors.textMuted),
            const SizedBox(height: 12),
            Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textMuted, height: 1.5),
            ),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onTap, child: Text(actionLabel)),
          ],
        ),
      ),
    );
  }

  String prettyReason(String r) {
    switch (r) {
      case 'TASK_REWARD':
        return 'مكافأة مهمة';
      case 'CAMPAIGN_SPEND':
        return 'إنشاء حملة';
      case 'PURCHASE':
        return 'شراء نقاط';
      case 'ADMIN_GRANT':
        return 'إضافة من الإدارة';
      case 'ADMIN_DEDUCT':
        return 'خصم من الإدارة';
      case 'REFERRAL_BONUS':
        return 'مكافأة إحالة';
      case 'SPIN_REWARD':
        return 'عجلة الحظ';
      case 'REFUND':
        return 'استرداد';
      case 'SIGNUP_BONUS':
        return 'مكافأة ترحيب';
      default:
        return r;
    }
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
