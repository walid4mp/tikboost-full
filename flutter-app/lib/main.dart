import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/earn_screen.dart';
import 'screens/create_campaign_screen.dart';
import 'screens/shop_screen.dart';
import 'screens/referrals_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/contact_screen.dart';
import 'screens/reset_password_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/main_shell.dart';
import 'screens/my_campaigns_screen.dart';
import 'screens/lucky_wheel_screen.dart';

import 'providers/auth_provider.dart';
import 'providers/theme_provider.dart';
import 'services/socket_service.dart';
import 'config/app_config.dart';
import 'config/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );
  final container = ProviderContainer();
  final token = await container.read(authProvider.notifier).bootstrap();
  if (token != null) SocketService.instance.connect(token);
  runApp(UncontrolledProviderScope(container: container, child: const TikBoostApp()));
}

class TikBoostApp extends ConsumerWidget {
  const TikBoostApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeProvider);
    final auth = ref.watch(authProvider);

    final router = GoRouter(
      initialLocation: '/',
      refreshListenable: GoRouterRefreshStream(auth),
      redirect: (ctx, state) {
        final loggedIn = auth.user != null;
        final loc = state.matchedLocation;
        final isAuthScreen = loc == '/login' || loc == '/signup' || loc == '/forgot';
        if (!loggedIn && !isAuthScreen) return '/login';
        if (loggedIn && isAuthScreen) return '/home';
        return null;
      },
      routes: [
        GoRoute(path: '/',          builder: (_, __) => const SplashScreen()),
        GoRoute(path: '/login',     builder: (_, __) => const LoginScreen()),
        GoRoute(path: '/signup',    builder: (_, __) => const SignupScreen()),
        GoRoute(path: '/forgot',    builder: (_, __) => const ResetPasswordScreen()),

        ShellRoute(
          builder: (_, __, child) => MainShell(child: child),
          routes: [
            GoRoute(path: '/home',           builder: (_, __) => const HomeScreen()),
            GoRoute(path: '/earn',           builder: (_, __) => const EarnScreen()),
            GoRoute(path: '/create',         builder: (_, __) => const CreateCampaignScreen()),
            GoRoute(path: '/shop',           builder: (_, __) => const ShopScreen()),
            GoRoute(path: '/profile',        builder: (_, __) => const ProfileScreen()),
          ],
        ),

        GoRoute(path: '/campaigns',       builder: (_, __) => const MyCampaignsScreen()),
        GoRoute(path: '/referrals',       builder: (_, __) => const ReferralsScreen()),
        GoRoute(path: '/notifications',   builder: (_, __) => const NotificationsScreen()),
        GoRoute(path: '/settings',        builder: (_, __) => const SettingsScreen()),
        GoRoute(path: '/contact',         builder: (_, __) => const ContactScreen()),
        GoRoute(path: '/wheel',           builder: (_, __) => const LuckyWheelScreen()),
      ],
    );

    return MaterialApp.router(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      themeMode: themeMode,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      routerConfig: router,
      builder: (ctx, child) => MediaQuery(
        data: MediaQuery.of(ctx).copyWith(textScaler: const TextScaler.linear(1.0)),
        child: child!,
      ),
    );
  }
}

// Helper to refresh router on auth changes
class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(AuthState s) {
    s.addListener((_) => notifyListeners());
  }
}
