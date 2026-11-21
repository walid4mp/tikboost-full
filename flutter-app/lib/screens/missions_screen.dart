import 'package:dio/dio.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/app_theme.dart';
import '../i18n/tr_text.dart';
import '../providers/auth_provider.dart';
import '../services/rewards_repository.dart';
import '../services/sound_service.dart';

/// Levels + missions hub: XP progress, level ladder with rewards, daily login,
/// daily chest, daily / weekly missions and achievements.
class MissionsScreen extends ConsumerStatefulWidget {
  const MissionsScreen({super.key});

  @override
  ConsumerState<MissionsScreen> createState() => _MissionsScreenState();
}

class _MissionsScreenState extends ConsumerState<MissionsScreen> {
  bool loading = true;
  bool failed = false;
  String? loadError;
  String? busyKey;
  Map<String, dynamic> status = const {};
  Map<String, dynamic> levelsData = const {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() { loading = true; failed = false; });
    try {
      final st = await RewardsRepository.instance.status();
      Map<String, dynamic> lv;
      try {
        lv = await RewardsRepository.instance.levels();
      } catch (_) {
        // Fall back to the level data already included in /rewards/status so
        // the screen still works if the dedicated endpoint is unavailable.
        lv = {
          'level': st['level'] ?? const {},
          'items': st['levels'] ?? const [],
          'xp': (st['profile'] is Map ? (st['profile'] as Map)['xp'] : 0) ?? 0,
          'xpRules': const {},
        };
      }
      if (!mounted) return;
      setState(() {
        status = st;
        levelsData = lv;
        failed = false;
        loadError = null;
      });
      await _checkLevelUp();
    } catch (e) {
      if (mounted && !silent) setState(() { failed = true; loadError = _err(e); });
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  List<Map<String, dynamic>> _list(dynamic v) =>
      (v is List ? v : const []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();

  int _int(dynamic v) => int.tryParse('${v ?? 0}') ?? 0;

  /// Picks the text in the active language (admin can provide En/Fr versions).
  String _loc(Map item, String base) {
    final lang = I18n.instance.lang;
    final suffix = lang == 'en' ? 'En' : (lang == 'fr' ? 'Fr' : '');
    if (suffix.isNotEmpty) {
      final v = '${item['$base$suffix'] ?? ''}'.trim();
      if (v.isNotEmpty) return v;
    }
    return tr('${item[base] ?? ''}');
  }

  String _levelName(Map item) {
    final lang = I18n.instance.lang;
    if (lang == 'fr' && '${item['nameFr'] ?? ''}'.isNotEmpty) return '${item['nameFr']}';
    if (lang == 'ar' && '${item['nameAr'] ?? ''}'.isNotEmpty) return '${item['nameAr']}';
    return '${item['name'] ?? item['key'] ?? ''}';
  }

  Future<void> _checkLevelUp() async {
    try {
      final current = '${Map<String, dynamic>.from(levelsData['level'] ?? const {})['key'] ?? ''}';
      if (current.isEmpty) return;
      final prefs = await SharedPreferences.getInstance();
      final key = 'last_level_${ref.read(authProvider).state.user?.id ?? ''}';
      final saved = prefs.getString(key);
      await prefs.setString(key, current);
      if (saved != null && saved != current && mounted) {
        SoundService.instance.playLevelUp();
        final lv = Map<String, dynamic>.from(levelsData['level'] as Map);
        await showDialog<void>(
          context: context,
          builder: (c) => AlertDialog(
            backgroundColor: const Color(0xff111827),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
            title: Column(children: [
              Text('${lv['icon'] ?? '⭐'}', style: const TextStyle(fontSize: 56)),
              const SizedBox(height: 8),
              const Text('مستوى جديد!', style: TextStyle(fontWeight: FontWeight.w900)),
            ]),
            content: Text(_levelName(lv), textAlign: TextAlign.center, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xffffd166))),
            actions: [TextButton(onPressed: () => Navigator.pop(c), child: const Text('حسناً'))],
          ),
        );
      }
    } catch (_) {}
  }

  String _err(Object e) {
    if (e is DioException) {
      final d = e.response?.data;
      if (d is Map && '${d['message'] ?? ''}'.isNotEmpty) return '${d['message']}';
    }
    return 'حدث خطأ، حاول مرة أخرى.';
  }

  Future<void> _run(String key, Future<Map<String, dynamic>> Function() action, {String? okText}) async {
    if (busyKey != null) return;
    setState(() => busyKey = key);
    try {
      final res = await action();
      SoundService.instance.playCoin();
      final pts = res['rewardPoints'];
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          backgroundColor: AppColors.success,
          content: Text(okText ?? (pts == null ? 'تم الاستلام' : 'حصلت على $pts نقطة')),
        ));
      }
      ref.read(authProvider).refreshCurrentUser().catchError((_) {});
      await _load(silent: true);
    } catch (e) {
      SoundService.instance.playError();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(backgroundColor: AppColors.red, content: Text(_err(e))));
      }
    } finally {
      if (mounted) setState(() => busyKey = null);
    }
  }

  Future<void> _manualTask(Map<String, dynamic> item) async {
    final url = '${item['url'] ?? ''}'.trim();
    if (url.isNotEmpty) {
      final uri = Uri.tryParse(url);
      if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    await _run('t:${item['key']}', () => RewardsRepository.instance.completeManualTask('${item['key']}'),
        okText: 'تم تسجيل المهمة اليدوية، يمكنك استلام المكافأة الآن');
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('المستويات والمهام'),
          bottom: TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [
              Tab(text: tr('المستوى')),
              Tab(text: tr('مهام اليوم')),
              Tab(text: tr('تحديات الأسبوع')),
              Tab(text: tr('إنجازاتك')),
            ],
          ),
        ),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : failed
                ? Center(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.cloud_off_rounded, size: 46, color: AppColors.textMuted),
                      const SizedBox(height: 10),
                      Padding(padding: const EdgeInsets.symmetric(horizontal: 24), child: Text(loadError ?? '', textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textMuted))),
                      OutlinedButton(onPressed: _load, child: const Text('إعادة المحاولة')),
                    ]),
                  )
                : RefreshIndicator(
                    onRefresh: () => _load(silent: true),
                    child: TabBarView(children: [_levelTab(), _questTab(_list(Map<String, dynamic>.from(status['dailyTasks'] ?? const {})['items']), 'd'), _questTab(_list(status['weekly']), 'w'), _questTab(_list(status['achievements']), 'a')]),
                  ),
      ),
    );
  }

  // ---------------------------------------------------------------- level tab
  Widget _levelTab() {
    final level = Map<String, dynamic>.from(levelsData['level'] ?? const {});
    final next = level['nextLevel'] is Map ? Map<String, dynamic>.from(level['nextLevel']) : null;
    final xp = _int(levelsData['xp']);
    final progress = (_int(level['progressPercent']) / 100).clamp(0.0, 1.0).toDouble();
    final login = Map<String, dynamic>.from(status['dailyLogin'] ?? const {});
    final chest = Map<String, dynamic>.from(status['chest'] ?? const {});
    final levels = _list(levelsData['items']);
    final rules = Map<String, dynamic>.from(levelsData['xpRules'] ?? const {});

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 30),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(26),
            gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xff2e1065), Color(0xff172554)]),
            border: Border.all(color: Colors.white12),
          ),
          child: Column(children: [
            Row(children: [
              Container(
                width: 74, height: 74, alignment: Alignment.center,
                decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.black26, border: Border.all(color: const Color(0xffffd166), width: 2)),
                child: Text('${level['icon'] ?? '⭐'}', style: const TextStyle(fontSize: 38)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_levelName(level), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 4),
                  Text('XP: $xp', style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text('x${level['multiplier'] ?? 1} ${tr('مكافآت')}', style: const TextStyle(color: Color(0xffffd166), fontWeight: FontWeight.w800, fontSize: 12)),
                ]),
              ),
            ]),
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: LinearProgressIndicator(value: progress, minHeight: 11, backgroundColor: Colors.white12, color: const Color(0xffffd166)),
            ),
            const SizedBox(height: 8),
            Text(
              next == null ? '${tr('المستوى')} MAX 🏆' : '${_levelName(next)} • ${_int(next['minXp']) - xp} XP',
              style: const TextStyle(color: Colors.white70, fontSize: 12),
            ),
          ]),
        ),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: _actionTile(
            icon: Icons.local_fire_department_rounded, color: Colors.orange,
            title: 'مكافأة اليوم', subtitle: '${_int(login['streak'])} 🔥',
            enabled: login['claimedToday'] != true && busyKey == null,
            onTap: () => _run('login', RewardsRepository.instance.claimDailyLogin),
          )),
          const SizedBox(width: 10),
          Expanded(child: _actionTile(
            icon: Icons.card_giftcard_rounded, color: AppColors.purple,
            title: 'الصندوق', subtitle: chest['available'] == true ? '🎁' : '✔',
            enabled: chest['available'] == true && chest['enabled'] != false && busyKey == null,
            onTap: () => _run('chest', RewardsRepository.instance.openChest),
          )),
        ]),
        const SizedBox(height: 18),
        Text(tr('المستوى'), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
        const SizedBox(height: 10),
        ...levels.map((lv) {
          final reached = lv['reached'] == true;
          final claimable = lv['claimable'] == true;
          final reward = _int(lv['rewardPoints']);
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(
              color: lv['current'] == true ? AppColors.purple.withValues(alpha: .18) : AppColors.card,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: lv['current'] == true ? AppColors.purple : AppColors.border),
            ),
            child: Row(children: [
              Opacity(opacity: reached ? 1 : .4, child: Text('${lv['icon'] ?? '⭐'}', style: const TextStyle(fontSize: 30))),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_levelName(lv), style: TextStyle(fontWeight: FontWeight.w900, color: reached ? AppColors.text : AppColors.textMuted)),
                  const SizedBox(height: 2),
                  Text('${_int(lv['minXp'])} XP • x${lv['multiplier']}${reward > 0 ? '  •  +$reward' : ''}', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                ]),
              ),
              if (claimable)
                FilledButton(
                  onPressed: busyKey != null ? null : () => _run('l:${lv['key']}', () => RewardsRepository.instance.claimLevel('${lv['key']}')),
                  child: const Text('استلام'),
                )
              else if (reached && (lv['claimed'] == true))
                const Icon(Icons.check_circle_rounded, color: AppColors.success)
              else
                const Icon(Icons.lock_outline_rounded, color: AppColors.textMuted, size: 20),
            ]),
          );
        }),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
          child: Text(
            'XP: ${tr('مهام')} +${rules['taskRewardXp'] ?? 8} • ${tr('حملة')} +${rules['campaignCreateXp'] ?? 12} • ${tr('شراء')} +${rules['purchaseXp'] ?? 25} • ${tr('الإحالات')} +${rules['referralXp'] ?? 30}',
            style: const TextStyle(color: AppColors.textMuted, fontSize: 12, height: 1.5),
          ),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(onPressed: () => context.push('/wheel'), icon: const Icon(Icons.casino_rounded), label: const Text('عجلة الحظ')),
      ],
    );
  }

  Widget _actionTile({required IconData icon, required Color color, required String title, required String subtitle, required bool enabled, required VoidCallback onTap}) {
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(18),
      child: Opacity(
        opacity: enabled ? 1 : .5,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(18), border: Border.all(color: enabled ? color : AppColors.border)),
          child: Column(children: [
            Icon(icon, color: color, size: 30),
            const SizedBox(height: 6),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
            Text(subtitle, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
          ]),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------- quest tab
  Widget _questTab(List<Map<String, dynamic>> items, String kind) {
    if (items.isEmpty) {
      return ListView(children: const [SizedBox(height: 140), Center(child: Text('لا توجد مهام جديدة حالياً ✨', style: TextStyle(color: AppColors.textMuted)))]);
    }
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 30),
      children: items.map((item) {
        final target = _int(item['target']) == 0 ? 1 : _int(item['target']);
        final progress = _int(item['progress']).clamp(0, target);
        final completed = item['completed'] == true;
        final claimed = item['claimed'] == true;
        final manual = item['manual'] == true;
        final key = '${item['key']}';
        final busy = busyKey == '$kind:$key' || busyKey == 't:$key';
        Future<void> claim() => _run('$kind:$key', () {
              final repo = RewardsRepository.instance;
              return kind == 'd' ? repo.claimDailyTask(key) : (kind == 'w' ? repo.claimWeekly(key) : repo.claimAchievement(key));
            });
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: completed && !claimed ? AppColors.success : AppColors.border),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(_loc(item, 'title'), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: const Color(0xffffd166).withValues(alpha: .15), borderRadius: BorderRadius.circular(20)),
                child: Text('+${_int(item['rewardPoints'])}', style: const TextStyle(color: Color(0xffffd166), fontWeight: FontWeight.w900)),
              ),
            ]),
            if ('${item['description'] ?? ''}'.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(_loc(item, 'description'), style: const TextStyle(color: AppColors.textMuted, fontSize: 12.5, height: 1.4)),
            ],
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(value: progress / target, minHeight: 8, backgroundColor: Colors.white12, color: completed ? AppColors.success : AppColors.blue),
                ),
              ),
              const SizedBox(width: 10),
              Text('$progress/$target', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
            ]),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: claimed
                  ? const OutlinedButton(onPressed: null, child: Text('تم الاستلام'))
                  : completed
                      ? FilledButton(onPressed: busy || busyKey != null ? null : claim, child: Text(busy ? '...' : 'استلام المكافأة'))
                      : manual
                          ? OutlinedButton(onPressed: busyKey != null ? null : () => _manualTask(item), child: const Text('تسجيل المهمة'))
                          : const OutlinedButton(onPressed: null, child: Text('قيد الإنجاز')),
            ),
          ]),
        );
      }).toList(),
    );
  }
}
