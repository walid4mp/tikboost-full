import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../config/app_theme.dart';
import 'shop_screen.dart';
import '../services/admob_service.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/local_notification_service.dart';
import '../services/rewards_repository.dart';
import '../services/sound_service.dart';

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
  List<dynamic> weekly = const [];
  List<dynamic> offers = const [];
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
      Map<String, dynamic> rewardsData = const {};
      List<dynamic> offersData = const [];
      List<dynamic> campaignsData = const [];
      try { rewardsData = Map<String, dynamic>.from(await RewardsRepository.instance.status()); } catch (_) {}
      try { offersData = await RewardsRepository.instance.personalizedOffers(); } catch (_) {}
      try {
        final r = await ApiClient.instance.dio.get('/campaigns/mine');
        campaignsData = List<dynamic>.from((r.data as Map)['campaigns'] ?? const []);
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        rewardsStatus = Map<String, dynamic>.from(rewardsData['rewards'] ?? const {});
        levelInfo = Map<String, dynamic>.from(rewardsData['level'] ?? const {});
        chest = Map<String, dynamic>.from(rewardsData['chest'] ?? const {});
        dailyLogin = Map<String, dynamic>.from(rewardsData['dailyLogin'] ?? const {});
        dailyTasks = Map<String, dynamic>.from(rewardsData['dailyTasks'] ?? const {'items': []});
        achievements = List<dynamic>.from(rewardsData['achievements'] ?? const []);
        weekly = List<dynamic>.from(rewardsData['weekly'] ?? const []);
        offers = offersData;
        campaigns = campaignsData.take(5).toList();
      });
      if (offersData.isNotEmpty) {
        final prefs = await SharedPreferences.getInstance();
        final offer = Map<String, dynamic>.from(offersData.first as Map);
        final key = 'offer_seen_${offer['id']}';
        if (offer['showNotification'] != false && prefs.getBool(key) != true) {
          await prefs.setBool(key, true);
          await LocalNotificationService.instance.show('🎁 عرض خاص لك', '${offer['title']} — خصم ${offer['discountPct'] ?? 0}%');
        }
      }
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
      await SoundService.instance.playSuccess();
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
      await SoundService.instance.playSuccess();
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
        await SoundService.instance.playSuccess();
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

  Future<void> _claimWeekly(String key) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final result = await RewardsRepository.instance.claimWeekly(key);
      await ref.read(authProvider).bootstrap();
      await _load();
      await SoundService.instance.playSuccess();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(backgroundColor: AppColors.success, content: Text('🏆 حصلت على ${result['rewardPoints']} نقطة')));
    } catch (e) { _showError(e); } finally { if (mounted) setState(() => busy = false); }
  }

  Future<void> _claimAchievement(String key) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final result = await RewardsRepository.instance.claimAchievement(key);
      await ref.read(authProvider).bootstrap();
      await _load();
      await SoundService.instance.playSuccess();
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
    final level = '${levelInfo['name'] ?? 'Aura Starter'}';
    final levelPct = ((levelInfo['progressPercent'] ?? 0) as num).toDouble().clamp(0, 100) / 100;

    return Scaffold(
      body: RefreshIndicator(
        color: AppColors.blue,
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            Row(children: [
              Container(width: 46, height: 46, decoration: BoxDecoration(gradient: AppColors.aurora, borderRadius: BorderRadius.circular(15)), child: const Icon(Icons.auto_awesome_rounded, color: Colors.white)),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('مرحباً، ${user?.name ?? 'صديقي'} 👋', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                Text('TokAura • ${user?.referralCode ?? ''}', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
              ])),
              _NotificationBell(onTap: () async { await SoundService.instance.playTap(); context.push('/notifications'); }),
            ]),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: AppColors.aurora,
                borderRadius: BorderRadius.circular(26),
                boxShadow: const [BoxShadow(color: Color(0x442F7DFF), blurRadius: 28, offset: Offset(0, 12))],
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Expanded(child: Text('رصيدك الآن', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700))),
                  Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: Colors.white.withValues(alpha: .16), borderRadius: BorderRadius.circular(20)), child: const Text('TOKENS', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900))),
                ]),
                const SizedBox(height: 6),
                Text('$balance', style: const TextStyle(color: Colors.white, fontSize: 38, fontWeight: FontWeight.w900)),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: Text('$level • ${levelInfo['multiplier'] ?? 1}x مكافآت', style: const TextStyle(color: Colors.white70, fontSize: 12))),
                  const Icon(Icons.bolt_rounded, color: Colors.white, size: 20),
                ]),
                const SizedBox(height: 8),
                ClipRRect(borderRadius: BorderRadius.circular(99), child: LinearProgressIndicator(value: levelPct, minHeight: 6, backgroundColor: Colors.white24, valueColor: const AlwaysStoppedAnimation(Colors.white))),
              ]),
            ),
            const SizedBox(height: 14),
            Row(children: [
              Expanded(child: _AuraStat(icon: Icons.task_alt_rounded, title: 'مهام اليوم', value: '${tasks.length}', color: AppColors.blue)),
              const SizedBox(width: 10),
              Expanded(child: _AuraStat(icon: Icons.campaign_rounded, title: 'حملاتي', value: '${campaigns.length}', color: AppColors.red)),
              const SizedBox(width: 10),
              Expanded(child: _AuraStat(icon: Icons.stars_rounded, title: 'المستوى', value: level, color: AppColors.purple)),
            ]),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: _AuraAction(icon: Icons.bolt_rounded, title: 'ابدأ الكسب', subtitle: 'مهام + إعلانات', gradient: AppColors.aurora, onTap: () async { await SoundService.instance.playTap(); context.go('/earn'); })),
              const SizedBox(width: 12),
              Expanded(child: _AuraAction(icon: Icons.rocket_launch_rounded, title: 'أنشئ حملة', subtitle: 'روّج الآن', gradient: const LinearGradient(colors: [AppColors.purple, AppColors.blue]), onTap: () async { await SoundService.instance.playTap(); context.go('/create'); })),
            ]),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(22), border: Border.all(color: AppColors.border)),
              child: Row(children: [
                Container(width: 46, height: 46, decoration: BoxDecoration(color: AppColors.blue.withValues(alpha: .12), borderRadius: BorderRadius.circular(15)), child: const Icon(Icons.play_circle_fill_rounded, color: AppColors.blue)),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('شاهد واكسب', style: TextStyle(fontWeight: FontWeight.w900)),
                  Text('${ads['remaining'] ?? 0} إعلانات متبقية • +${ads['rewardPoints'] ?? 0} نقطة', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                ])),
                FilledButton(onPressed: busy || (int.tryParse('${ads['remaining'] ?? 0}') ?? 0) <= 0 ? null : () async { await SoundService.instance.playTap(); await _watchRewardedAd(); }, child: const Text('ابدأ')),
              ]),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: OutlinedButton.icon(onPressed: dailyLogin['claimedToday'] == true || busy ? null : () async { await SoundService.instance.playTap(); await _claimDailyLogin(); }, icon: const Icon(Icons.calendar_today_rounded), label: const Text('مكافأة اليوم'))),
              const SizedBox(width: 10),
              Expanded(child: OutlinedButton.icon(onPressed: chest['available'] == true && !busy ? () async { await SoundService.instance.playTap(); await _openChest(); } : null, icon: const Icon(Icons.card_giftcard_rounded), label: const Text('الصندوق'))),
            ]),
            const SizedBox(height: 10),
            SizedBox(width: double.infinity, child: OutlinedButton.icon(onPressed: () async { await SoundService.instance.playTap(); context.push('/wheel'); }, icon: const Icon(Icons.casino_rounded, color: AppColors.red), label: Text('عجلة TokAura • ${wheel['dailyRemaining'] ?? 0} لفة متبقية'))),
            if (offers.isNotEmpty) ...[const SizedBox(height: 18), _PersonalOfferCard(offer: Map<String, dynamic>.from(offers.first as Map), onBuy: () async {
              await SoundService.instance.playTap();
              final offer = Map<String, dynamic>.from(offers.first as Map);
              try {
                final result = await showOfferPaymentSheet(
                  context: context,
                  offerId: '${offer['id']}',
                  itemName: '${offer['title'] ?? 'عرض خاص'}',
                  priceCents: (offer['newPriceCents'] as num?)?.toInt() ?? 0,
                  currency: '${offer['currency'] ?? 'USD'}',
                );
                if (mounted && result != null) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(backgroundColor: AppColors.success, content: Text(result['instructions'] ?? 'تم إرسال طلب العرض للمراجعة')));
                }
              } catch (e) { _showError(e); }
            })],
            const SizedBox(height: 20),
            _SectionTitle(title: 'مهام اليوم', action: 'عرض الكل', onTap: () => context.go('/earn')),
            const SizedBox(height: 10),
            if (tasks.isEmpty) const _EmptyAura(text: 'لا توجد مهام جديدة حالياً ✨') else ...tasks.take(4).map((task) => _TaskCard(task: Map<String, dynamic>.from(task), onAction: _taskAction)),
            if (weekly.isNotEmpty) ...[
              const SizedBox(height: 20),
              _SectionTitle(title: 'تحديات الأسبوع', action: '', onTap: () {}),
              const SizedBox(height: 10),
              ...weekly.take(3).map((item) => _WeeklyCard(item: Map<String, dynamic>.from(item), onClaim: _claimWeekly)),
            ],
            const SizedBox(height: 20),
            _SectionTitle(title: 'إنجازاتك', action: '', onTap: () {}),
            const SizedBox(height: 10),
            if (achievements.isEmpty) const _EmptyAura(text: 'أكمل مهامك لفتح إنجازات جديدة 🏆') else ...achievements.take(4).map((item) => _AchievementCard(item: Map<String, dynamic>.from(item), onClaim: _claimAchievement)),
            const SizedBox(height: 20),
            _SectionTitle(title: 'حملاتك الأخيرة', action: 'إنشاء حملة', onTap: () => context.go('/create')),
            const SizedBox(height: 10),
            _MyCampaigns(campaigns: campaigns, loading: loading),
          ],
        ),
      ),
    );
  }
}


class _AuraStat extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;
  final Color color;
  const _AuraStat({required this.icon, required this.title, required this.value, required this.color});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(height: 8),
        Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        Text(title, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
      ]),
    );
  }
}

class _AuraAction extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Gradient gradient;
  final VoidCallback onTap;
  const _AuraAction({required this.icon, required this.title, required this.subtitle, required this.gradient, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(22),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(gradient: gradient, borderRadius: BorderRadius.circular(22)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(width: 38, height: 38, decoration: BoxDecoration(color: Colors.white.withValues(alpha: .16), borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: Colors.white)),
          const SizedBox(height: 12),
          Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
          const SizedBox(height: 3),
          Text(subtitle, style: const TextStyle(color: Colors.white70, fontSize: 10)),
        ]),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;
  final String action;
  final VoidCallback onTap;
  const _SectionTitle({required this.title, required this.action, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Expanded(child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900))),
      if (action.isNotEmpty) TextButton(onPressed: () async { await SoundService.instance.playTap(); onTap(); }, child: Text(action)),
    ]);
  }
}

class _EmptyAura extends StatelessWidget {
  final String text;
  const _EmptyAura({required this.text});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border)),
      child: Center(child: Text(text, style: const TextStyle(color: AppColors.textMuted))),
    );
  }
}

class _PersonalOfferCard extends StatelessWidget {
  final Map<String,dynamic> offer; final VoidCallback onBuy;
  const _PersonalOfferCard({required this.offer, required this.onBuy});
  @override Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(gradient: const LinearGradient(colors:[Color(0xFFFF3B5C),Color(0xFF9B1C35)]), borderRadius: BorderRadius.circular(20), boxShadow:[BoxShadow(color:Color(0x55FF3B5C),blurRadius:18,offset:Offset(0,8))]),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children:[
      const Text('🎁 عرض خاص لك', style: TextStyle(color:Colors.white70,fontWeight:FontWeight.w700)),
      const SizedBox(height:5), Text(offer['title']?.toString() ?? 'عرض مخصص لك', style: const TextStyle(color:Colors.white,fontSize:19,fontWeight:FontWeight.w900)),
      if('${offer['description']??''}'.trim().isNotEmpty) ...[const SizedBox(height:6),Text('${offer['description']}',style:const TextStyle(color:Colors.white70))],
      const SizedBox(height:12), Row(children:[Text('\$${double.tryParse('${offer['newPrice']??0}')?.toStringAsFixed(2) ?? '0.00'}',style:const TextStyle(color:Colors.white,fontSize:28,fontWeight:FontWeight.w900)), const SizedBox(width:10), if(offer['oldPrice'] != null && double.tryParse('${offer['oldPrice']}') != null) Text('\$${double.parse('${offer['oldPrice']}').toStringAsFixed(2)}',style:const TextStyle(color:Colors.white60,decoration:TextDecoration.lineThrough))]),
      const SizedBox(height:10), SizedBox(width:double.infinity,child:ElevatedButton(onPressed:onBuy,style:ElevatedButton.styleFrom(backgroundColor:Colors.white,foregroundColor:AppColors.red),child:const Text('استفد من العرض الآن')))
    ])
  );
}

class _WeeklyCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final Future<void> Function(String) onClaim;

  const _WeeklyCard({
    required this.item,
    required this.onClaim,
  });

  @override
  Widget build(BuildContext context) {
    final target = double.tryParse('${item['target'] ?? 1}') ?? 1;
    final progress = double.tryParse('${item['progress'] ?? 0}') ?? 0;
    final pct = (progress / target).clamp(0, 1).toDouble();
    final done = item['completed'] == true;
    final claimed = item['claimed'] == true;

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
                    '${item['title'] ?? ''}',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                Text(
                  '+${item['rewardPoints'] ?? 0}',
                  style: const TextStyle(
                    color: AppColors.success,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 5),
            Text(
              '${item['description'] ?? ''}',
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 10),
            LinearProgressIndicator(
              value: pct,
              minHeight: 7,
              borderRadius: BorderRadius.circular(20),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Text(
                  '$progress / $target',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Spacer(),
                ElevatedButton(
                  onPressed: done && !claimed
                      ? () async { await SoundService.instance.playTap(); await onClaim('${item['key']}'); }
                      : null,
                  child: Text(
                    claimed
                        ? 'تم الاستلام'
                        : done
                            ? 'استلام'
                            : 'أكمل المهمة',
                  ),
                ),
              ],
            ),
          ],
        ),
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
                onPressed: claimed || (!completed && !manual) ? null : () async { await SoundService.instance.playTap(); await onAction(task); },
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
          onPressed: claimed || !completed ? null : () async { await SoundService.instance.playTap(); await onClaim('${item['key']}'); },
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


class _NotificationBell extends StatefulWidget {
  final VoidCallback onTap;
  const _NotificationBell({required this.onTap});
  @override
  State<_NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends State<_NotificationBell> {
  int count = 0;
  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    try {
      final r = await ApiClient.instance.dio.get('/notifications');
      if (mounted) setState(() => count = int.tryParse('${r.data['unreadCount'] ?? 0}') ?? 0);
    } catch (_) {}
  }
  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: () { widget.onTap(); _load(); },
      tooltip: count > 0 ? 'لديك $count رسالة جديدة' : 'الإشعارات',
      icon: Stack(clipBehavior: Clip.none, children: [
        const Icon(Icons.notifications_none_rounded),
        if (count > 0)
          Positioned(
            right: -7,
            top: -7,
            child: Container(
              constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              decoration: const BoxDecoration(color: AppColors.red, shape: BoxShape.circle),
              child: Text(count > 99 ? '99+' : '$count', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900)),
            ),
          ),
      ]),
    );
  }
}
