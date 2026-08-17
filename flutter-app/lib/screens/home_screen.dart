import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../config/app_theme.dart';
import '../services/admob_service.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/rewards_repository.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  Map<String, dynamic> rewardsStatus = const {};
  Map<String, dynamic> levelInfo = const {};
  Map<String, dynamic> chest = const {};
  Map<String, dynamic> dailyLogin = const {};
  Map<String, dynamic> dailyTasks = const {'items': []};
  List<dynamic> achievements = const [];
  List<dynamic> campaigns = const [];
  bool loading = true;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        RewardsRepository.instance.status(),
        ApiClient.instance.dio.get('/campaigns/mine'),
      ]);
      final rewardsData = Map<String, dynamic>.from(results[0] as Map);
      final campaignsResponse = results[1] as Response;
      final campaignsData = Map<String, dynamic>.from(campaignsResponse.data as Map);
      if (!mounted) return;
      setState(() {
        rewardsStatus = Map<String, dynamic>.from(rewardsData['rewards'] ?? const {});
        levelInfo = Map<String, dynamic>.from(rewardsData['level'] ?? const {});
        chest = Map<String, dynamic>.from(rewardsData['chest'] ?? const {});
        dailyLogin = Map<String, dynamic>.from(rewardsData['dailyLogin'] ?? const {});
        dailyTasks = Map<String, dynamic>.from(rewardsData['dailyTasks'] ?? const {'items': []});
        achievements = List<dynamic>.from(rewardsData['achievements'] ?? const []);
        campaigns = List<dynamic>.from(campaignsData['campaigns'] ?? const []).take(5).toList();
      });
    } catch (_) {
      // keep screen usable even if some requests fail
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _claimDailyLogin() async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final result = await RewardsRepository.instance.claimDailyLogin();
      await ref.read(authProvider).bootstrap();
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.success,
          content: Text('تمت إضافة ${result['rewardPoints']} نقطة كمكافأة دخول يومية'),
        ),
      );
    } catch (e) {
      _showError(e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _watchRewardedAd() async {
    if (busy) return;
    final ads = Map<String, dynamic>.from(rewardsStatus['ads'] ?? const {});
    final remaining = int.tryParse('${ads['remaining'] ?? 0}') ?? 0;
    if (remaining <= 0) {
      _showErrorMessage('لقد وصلت إلى الحد الأقصى للإعلانات اليومية. عد غداً.');
      return;
    }
    if (!AdMobService.instance.rewardedEnabled) {
      _showErrorMessage('الإعلانات بالمكافأة غير مفعّلة حالياً.');
      return;
    }

    setState(() => busy = true);
    try {
      final session = await RewardsRepository.instance.startDailyAd();
      final rewarded = await AdMobService.instance.showRewardedAd();
      if (!rewarded) {
        _showErrorMessage('لم يكتمل الإعلان، لذلك لم تتم إضافة النقاط.');
        return;
      }
      final result = await RewardsRepository.instance.claimDailyAd('${session['sessionId']}');
      await ref.read(authProvider).bootstrap();
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.success,
          content: Text('مبروك! حصلت على ${result['rewardPoints'] ?? session['rewardPoints'] ?? 0} نقطة 🎁'),
        ),
      );
    } catch (e) {
      _showError(e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void _showErrorMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(backgroundColor: AppColors.red, content: Text(message)),
    );
  }

  Future<void> _openChest() async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final result = await RewardsRepository.instance.openChest();
      await ref.read(authProvider).bootstrap();
      await _load();
      if (!mounted) return;
      final rewardText = result['type'] == 'extra_spin'
          ? '${result['extraSpins'] ?? 0} لفة إضافية'
          : '${result['rewardPoints'] ?? 0} نقطة';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.success,
          content: Text('مبروك! ربحت $rewardText من الصندوق اليومي'),
        ),
      );
    } catch (e) {
      _showError(e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _taskAction(Map<String, dynamic> task) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      if (task['completed'] == true && task['claimed'] != true) {
        final result = await RewardsRepository.instance.claimDailyTask('${task['key']}');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: AppColors.success,
              content: Text('تم استلام ${result['rewardPoints']} نقطة'),
            ),
          );
        }
      } else if (task['manual'] == true) {
        final isReview = task['type'] == 'review_app';
        if (isReview) {
          final raw = '${task['url'] ?? ''}'.trim();
          final uri = Uri.tryParse(raw);
          if (uri == null || !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
            _showErrorMessage('رابط المتجر غير مضبوط حالياً. حاول لاحقاً.');
            return;
          }
        }
        await RewardsRepository.instance.completeManualTask('${task['key']}');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('تم تسجيل المهمة اليدوية، يمكنك استلام المكافأة الآن')),
          );
        }
      }
      await ref.read(authProvider).bootstrap();
      await _load();
    } catch (e) {
      _showError(e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _claimAchievement(String key) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final result = await RewardsRepository.instance.claimAchievement(key);
      await ref.read(authProvider).bootstrap();
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.success,
          content: Text('تم استلام ${result['rewardPoints']} نقطة كمكافأة إنجاز'),
        ),
      );
    } catch (e) {
      _showError(e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void _showError(Object error) {
    final message = error is DioException
        ? '${error.response?.data?['message'] ?? error.message ?? 'حدث خطأ'}'
        : 'حدث خطأ غير متوقع';
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(backgroundColor: AppColors.red, content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).state.user;
    final balance = user?.points ?? 0;
    final wheel = Map<String, dynamic>.from(rewardsStatus['wheel'] ?? const {});
    final ads = Map<String, dynamic>.from(rewardsStatus['ads'] ?? const {});
    final tasks = List<dynamic>.from(dailyTasks['items'] ?? const []);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const SizedBox(height: 4),
            Row(
              children: [
                CircleAvatar(
                  radius: 22,
                  backgroundColor: AppColors.red.withValues(alpha: 0.2),
                  child: const Icon(Icons.person, color: AppColors.red),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'أهلاً ${user?.name ?? ''} 👋',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                      ),
                      Text(
                        '#${user?.referralCode ?? ''}',
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => context.push('/notifications'),
                  icon: const Icon(Icons.notifications_none),
                  tooltip: 'الإشعارات',
                ),
              ],
            ),
            const SizedBox(height: 16),
            _BalanceCard(balance: balance),
            const SizedBox(height: 14),
            _LevelCard(levelInfo: levelInfo),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: loading || busy || dailyLogin['claimedToday'] == true ? null : _claimDailyLogin,
                    icon: const Icon(Icons.login),
                    label: Text(dailyLogin['claimedToday'] == true ? 'تم استلام دخول اليوم' : 'استلام مكافأة الدخول'),
                    style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: loading || busy || chest['available'] != true ? null : _openChest,
                    icon: const Icon(Icons.inventory_2_outlined, color: AppColors.blue),
                    label: Text(
                      chest['available'] == true ? 'فتح الصندوق اليومي' : 'الصندوق فُتح اليوم',
                      style: const TextStyle(color: AppColors.blue, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => context.push('/wheel'),
                    icon: const Icon(Icons.casino, color: AppColors.red),
                    label: const Text(
                      'عجلة الحظ',
                      style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: loading || busy || (int.tryParse('${ads['remaining'] ?? 0}') ?? 0) <= 0
                    ? null
                    : _watchRewardedAd,
                icon: busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.ondemand_video),
                label: Text(
                  busy
                      ? 'جاري تجهيز الإعلان...'
                      : '📺 شاهد إعلان واحصل على ${ads['rewardPoints'] ?? 0} نقطة',
                ),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
              ),
            ),
            const SizedBox(height: 8),
            _InfoStrip(
              icon: Icons.play_circle_outline,
              title: 'الإعلانات اليومية',
              subtitle: 'المتبقي ${ads['remaining'] ?? 0} من ${ads['limit'] ?? 0} • ${ads['rewardPoints'] ?? 0} نقطة لكل إعلان',
            ),
            const SizedBox(height: 10),
            _InfoStrip(
              icon: Icons.casino_outlined,
              title: 'لفات اليوم',
              subtitle: 'اليومية ${wheel['dailyRemaining'] ?? 0} • الإضافية ${wheel['extraAvailableToUse'] ?? 0}',
            ),
            const SizedBox(height: 18),
            const Text('مهام اليوم', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            if (tasks.isEmpty)
              const Card(child: ListTile(title: Text('لا توجد مهام حالياً')))
            else
              ...tasks.map((task) => _TaskCard(task: Map<String, dynamic>.from(task), onAction: _taskAction)),
            const SizedBox(height: 18),
            const Text('الإنجازات', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            if (achievements.isEmpty)
              const Card(child: ListTile(title: Text('لا توجد إنجازات حالياً')))
            else
              ...achievements.map(
                (item) => _AchievementCard(
                  item: Map<String, dynamic>.from(item),
                  onClaim: _claimAchievement,
                ),
              ),
            const SizedBox(height: 18),
            const Text('اختصارات', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            _QuickAction(icon: Icons.bolt_rounded, title: 'جمع النقاط', subtitle: 'مهام وإعلانات', color: AppColors.blue, onTap: () => context.go('/earn')),
            _QuickAction(icon: Icons.campaign_rounded, title: 'إنشاء حملة', subtitle: 'روّج لحسابك', color: AppColors.red, onTap: () => context.go('/create')),
            _QuickAction(icon: Icons.card_giftcard_rounded, title: 'الإحالات', subtitle: 'اربح من دعوة الأصدقاء', color: AppColors.success, onTap: () => context.push('/referrals')),
            _QuickAction(icon: Icons.workspace_premium_rounded, title: 'VIP PRO', subtitle: 'أولوية ومكافآت إضافية', color: Colors.amber.shade700, onTap: () => context.go('/shop')),

            const SizedBox(height: 16),
            const Text('آخر الحملات', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            _MyCampaigns(campaigns: campaigns, loading: loading),
          ],
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon; final String title; final String subtitle; final Color color; final VoidCallback onTap;
  const _QuickAction({required this.icon, required this.title, required this.subtitle, required this.color, required this.onTap});
  @override Widget build(BuildContext context) => Card(child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(14), child: Padding(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13), child: Row(children: [Container(width: 44, height: 44, decoration: BoxDecoration(color: color.withValues(alpha: .12), borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: color)), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontWeight: FontWeight.w800)), const SizedBox(height: 3), Text(subtitle, style: const TextStyle(color: AppColors.textMuted, fontSize: 12))])), Icon(Icons.chevron_left_rounded, color: color)]))));
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
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.red.withValues(alpha: 0.35),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.local_fire_department, color: Colors.white, size: 44),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('رصيد النقاط', style: TextStyle(color: Colors.white70)),
                const SizedBox(height: 4),
                Text(
                  '$balance',
                  style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LevelCard extends StatelessWidget {
  final Map<String, dynamic> levelInfo;
  const _LevelCard({required this.levelInfo});

  @override
  Widget build(BuildContext context) {
    final next = levelInfo['nextLevel'] is Map ? Map<String, dynamic>.from(levelInfo['nextLevel']) : null;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${levelInfo['icon'] ?? '⭐'} ${levelInfo['name'] ?? 'Starter'}',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text('الخبرة: ${levelInfo['xp'] ?? 0} • مضاعف المكافآت: ${levelInfo['multiplier'] ?? 1}x'),
            const SizedBox(height: 8),
            LinearProgressIndicator(
              value: ((levelInfo['progressPercent'] ?? 0) as num).toDouble() / 100,
              minHeight: 8,
              borderRadius: BorderRadius.circular(99),
            ),
            if (next != null) ...[
              const SizedBox(height: 8),
              Text('المستوى التالي: ${next['name']} عند ${next['minXp']} XP'),
            ],
          ],
        ),
      ),
    );
  }
}

class _InfoStrip extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  const _InfoStrip({required this.icon, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Icon(icon, color: AppColors.red),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(subtitle),
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  final Map<String, dynamic> task;
  final Future<void> Function(Map<String, dynamic>) onAction;
  const _TaskCard({required this.task, required this.onAction});

  @override
  Widget build(BuildContext context) {
    final completed = task['completed'] == true;
    final claimed = task['claimed'] == true;
    final manual = task['manual'] == true;
    final buttonText = claimed
        ? 'تم الاستلام'
        : completed
            ? 'استلام المكافأة'
            : manual
                ? 'تسجيل المهمة'
                : 'قيد الإنجاز';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${task['title']}',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                Text(
                  '+${task['rewardPoints']} نقطة',
                  style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w700),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text('${task['description'] ?? ''}'),
            const SizedBox(height: 10),
            LinearProgressIndicator(
              value: ((task['progress'] ?? 0) as num).toDouble() / (((task['target'] ?? 1) as num).toDouble().clamp(1, 999999)),
              minHeight: 8,
              borderRadius: BorderRadius.circular(99),
            ),
            const SizedBox(height: 8),
            Text('التقدم: ${task['progress'] ?? 0}/${task['target'] ?? 1}'),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: claimed || (!completed && !manual) ? null : () => onAction(task),
                child: Text(buttonText),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AchievementCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final Future<void> Function(String key) onClaim;
  const _AchievementCard({required this.item, required this.onClaim});

  @override
  Widget build(BuildContext context) {
    final claimed = item['claimed'] == true;
    final completed = item['completed'] == true;
    return Card(
      child: ListTile(
        leading: Icon(completed ? Icons.emoji_events : Icons.emoji_events_outlined, color: AppColors.blue),
        title: Text('${item['title']}', style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text('${item['description']} • ${item['progress']}/${item['target']}'),
        trailing: TextButton(
          onPressed: claimed || !completed ? null : () => onClaim('${item['key']}'),
          child: Text(claimed ? 'تم' : '+${item['rewardPoints']}'),
        ),
      ),
    );
  }
}

class _MyCampaigns extends StatelessWidget {
  final List<dynamic> campaigns;
  final bool loading;
  const _MyCampaigns({required this.campaigns, required this.loading});

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Padding(
        padding: EdgeInsets.all(20),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (campaigns.isEmpty) {
      return const Card(
        child: ListTile(
          leading: Icon(Icons.campaign_outlined, color: AppColors.red),
          title: Text('لا توجد حملات بعد'),
          subtitle: Text('اضغط "إنشاء حملة" للبدء.'),
        ),
      );
    }
    return Card(
      child: Column(
        children: [
          for (final campaign in campaigns)
            ListTile(
              leading: const Icon(Icons.bolt, color: AppColors.red),
              title: Text('${campaign['type']} • ${campaign['targetUsername']}'),
              subtitle: Text('${campaign['completed']}/${campaign['quantity']} • ${campaign['status']}'),
              trailing: Text(
                '${campaign['perTaskReward']}',
                style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w700),
              ),
            ),
        ],
      ),
    );
  }
}
