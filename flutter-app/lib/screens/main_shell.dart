import 'package:flutter/material.dart' hide Text;
import '../i18n/tr_text.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:url_launcher/url_launcher.dart';

import '../config/app_config.dart';
import '../config/app_theme.dart';
import '../providers/client_config_provider.dart';
import '../providers/auth_provider.dart';
import '../widgets/ad_widgets.dart';
import '../services/sound_service.dart';

class MainShell extends ConsumerWidget {
  final Widget child;
  const MainShell({super.key, required this.child});

  static const _tabs = [
    ('/home', Icons.auto_awesome_rounded, 'الرئيسية'),
    ('/earn', Icons.bolt_rounded, 'اكسب'),
    ('/create', Icons.add_rounded, 'حملة'),
    ('/shop', Icons.workspace_premium_rounded, 'VIP'),
    ('/profile', Icons.person_rounded, 'حسابي'),
  ];

  int _currentIndex(BuildContext ctx) {
    final loc = GoRouterState.of(ctx).matchedLocation;
    for (var i = 0; i < _tabs.length; i++) {
      if (loc.startsWith(_tabs[i].$1)) return i;
    }
    return 0;
  }

  String _destinationForIndex(int index, AuthUser? user) {
    final target = _tabs[index].$1;
    if (target == '/profile' && user != null && !user.isProfileComplete) return '/profile/complete';
    return target;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final idx = _currentIndex(context);
    final user = ref.watch(authProvider).state.user;
    ref.watch(clientConfigProvider);
    final isStaff = user != null && ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'FINANCE'].contains(user.role);
    if (AppConfig.maintenance['enabled'] == true && !isStaff) {
      return const _MaintenanceView();
    }
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(children: [
          const _AnnouncementBar(),
          BannerAdCard(userId: user?.id),
          Expanded(child: child),
        ]),
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.dark,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: SafeArea(
          top: false,
          child: NavigationBar(
            selectedIndex: idx,
            onDestinationSelected: (i) {
              final dest = _destinationForIndex(i, user);
              if (dest != GoRouterState.of(context).matchedLocation) { SoundService.instance.playTap(); context.go(dest); }
            },
            backgroundColor: Colors.transparent,
            indicatorColor: const Color(0x334DD7FF),
            destinations: _tabs.map((t) => NavigationDestination(
              icon: Icon(t.$2, color: AppColors.textMuted),
              selectedIcon: Icon(t.$2, color: AppColors.blue),
              label: tr(t.$3),
            )).toList(),
          ),
        ),
      ),
    );
  }
}


String _localized(Map<String, dynamic> m, String base) {
  final lang = I18n.instance.lang;
  final suffix = lang == 'en' ? 'En' : (lang == 'fr' ? 'Fr' : '');
  if (suffix.isNotEmpty) {
    final v = '${m['$base$suffix'] ?? ''}'.trim();
    if (v.isNotEmpty) return v;
  }
  return '${m[base] ?? ''}'.trim();
}

/// Admin-controlled announcement strip shown above every main page.
class _AnnouncementBar extends StatefulWidget {
  const _AnnouncementBar();
  @override
  State<_AnnouncementBar> createState() => _AnnouncementBarState();
}

class _AnnouncementBarState extends State<_AnnouncementBar> {
  String? dismissed;

  @override
  Widget build(BuildContext context) {
    final a = AppConfig.announcement;
    final text = _localized(a, 'text');
    if (a['enabled'] != true || text.isEmpty || dismissed == text) return const SizedBox.shrink();
    final level = '${a['level'] ?? 'info'}';
    final color = level == 'warning' ? AppColors.warning : (level == 'success' ? AppColors.success : AppColors.blue);
    final url = '${a['url'] ?? ''}'.trim();
    return Material(
      color: color.withValues(alpha: .16),
      child: InkWell(
        onTap: url.isEmpty ? null : () { final u = Uri.tryParse(url); if (u != null) launchUrl(u, mode: LaunchMode.externalApplication); },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(children: [
            Icon(Icons.campaign_rounded, size: 20, color: color),
            const SizedBox(width: 8),
            Expanded(child: Text(text, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, height: 1.35))),
            InkWell(onTap: () => setState(() => dismissed = text), child: const Padding(padding: EdgeInsets.all(4), child: Icon(Icons.close_rounded, size: 18))),
          ]),
        ),
      ),
    );
  }
}

class _MaintenanceView extends StatelessWidget {
  const _MaintenanceView();

  @override
  Widget build(BuildContext context) {
    var msg = _localized(AppConfig.maintenance, 'message');
    if (msg.isEmpty) msg = 'التطبيق قيد الصيانة حالياً، سنعود قريباً.';
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.build_circle_rounded, size: 84, color: AppColors.warning),
            const SizedBox(height: 18),
            Text('صيانة', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            Text(msg, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textMuted, height: 1.6)),
          ]),
        ),
      ),
    );
  }
}
