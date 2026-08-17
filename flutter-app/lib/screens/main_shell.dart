import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import '../widgets/ad_widgets.dart';

class MainShell extends ConsumerWidget {
  final Widget child;
  const MainShell({super.key, required this.child});

  static const _tabs = [
    ('/home', Icons.dashboard_rounded, 'الرئيسية'),
    ('/earn', Icons.bolt_rounded, 'جمع النقاط'),
    ('/create', Icons.add_circle_rounded, 'حملة جديدة'),
    ('/shop', Icons.shopping_bag_rounded, 'المتجر'),
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
    if (target == '/profile' && user != null && !user.isProfileComplete) {
      return '/profile/complete';
    }
    return target;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final idx = _currentIndex(context);
    final user = ref.watch(authProvider).state.user;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            BannerAdCard(userId: user?.id),
            Expanded(child: child),
          ],
        ),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          border: const Border(top: BorderSide(color: AppColors.border)),
        ),
        child: SafeArea(
          top: false,
          child: NavigationBar(
            selectedIndex: idx,
            onDestinationSelected: (i) {
              final dest = _destinationForIndex(i, user);
              final current = GoRouterState.of(context).matchedLocation;
              if (dest != current) {
                context.go(dest);
              }
            },
            backgroundColor: Colors.transparent,
            indicatorColor: AppColors.red.withValues(alpha: 0.18),
            destinations: _tabs.map((t) => NavigationDestination(
              icon: Icon(t.$2, color: AppColors.textMuted),
              selectedIcon: Icon(t.$2, color: AppColors.red),
              label: t.$3,
            )).toList(),
          ),
        ),
      ),
    );
  }
}
