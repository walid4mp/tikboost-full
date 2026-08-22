import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../config/app_theme.dart';
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
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(children: [
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
              if (dest != GoRouterState.of(context).matchedLocation) { SoundService.instance.play('notify.wav'); context.go(dest); }
            },
            backgroundColor: Colors.transparent,
            indicatorColor: const Color(0x334DD7FF),
            destinations: _tabs.map((t) => NavigationDestination(
              icon: Icon(t.$2, color: AppColors.textMuted),
              selectedIcon: Icon(t.$2, color: AppColors.blue),
              label: t.$3,
            )).toList(),
          ),
        ),
      ),
    );
  }
}
