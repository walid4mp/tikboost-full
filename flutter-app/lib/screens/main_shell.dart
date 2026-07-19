import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../config/app_theme.dart';

class MainShell extends StatelessWidget {
  final Widget child;
  const MainShell({super.key, required this.child});

  static const _tabs = [
    ('/home',     Icons.dashboard_rounded,        'الرئيسية'),
    ('/earn',     Icons.bolt_rounded,             'جمع النقاط'),
    ('/create',   Icons.add_circle_rounded,       'حملة جديدة'),
    ('/shop',     Icons.shopping_bag_rounded,     'المتجر'),
    ('/profile',  Icons.person_rounded,           'حسابي'),
  ];

  int _currentIndex(BuildContext ctx) {
    final loc = GoRouterState.of(ctx).matchedLocation;
    for (var i = 0; i < _tabs.length; i++) {
      if (loc.startsWith(_tabs[i].$1)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final idx = _currentIndex(context);
    return Scaffold(
      body: SafeArea(bottom: false, child: child),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: SafeArea(
          top: false,
          child: NavigationBar(
            selectedIndex: idx,
            onDestinationSelected: (i) => context.go(_tabs[i].$1),
            backgroundColor: Colors.transparent,
            indicatorColor: AppColors.red.withOpacity(0.18),
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
