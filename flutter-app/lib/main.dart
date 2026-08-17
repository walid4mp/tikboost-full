import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'config/app_config.dart';
import 'config/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/client_config_provider.dart';
import 'providers/theme_provider.dart';
import 'screens/contact_screen.dart';
import 'screens/create_campaign_screen.dart';
import 'screens/earn_screen.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/lucky_wheel_screen.dart';
import 'screens/main_shell.dart';
import 'screens/my_campaigns_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/profile_completion_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/referrals_screen.dart';
import 'screens/reset_password_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/shop_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/splash_screen.dart';
import 'services/admob_service.dart';
import 'services/socket_service.dart';
import 'services/local_notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final container = ProviderContainer();
  await container.read(clientConfigProvider).load();
  await AdMobService.instance.initialize();
  await LocalNotificationService.instance.initialize();

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );

  final token = await container.read(authProvider).bootstrap();
  if (token != null) {
    await AdMobService.instance.loadUserAdConfig();
    SocketService.instance.connect(token);
    final notifications = Map<String, dynamic>.from(container.read(clientConfigProvider).config['notifications'] ?? const {});
    if (notifications['reminderEnabled'] != false) {
      await LocalNotificationService.instance.scheduleReminder(hours: int.tryParse('${notifications['reminderAfterHours'] ?? 24}') ?? 24);
    }
  }

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const TikBoostApp(),
    ),
  );
}

class TikBoostApp extends ConsumerStatefulWidget {
  const TikBoostApp({super.key});

  @override
  ConsumerState<TikBoostApp> createState() => _TikBoostAppState();
}

class _TikBoostAppState extends ConsumerState<TikBoostApp> with WidgetsBindingObserver {
  late final GoRouter _router;
  late final GoRouterRefreshStream _refreshStream;
  Timer? _interstitialTimer;
  DateTime? _nextInterstitialAt;
  bool _showingAutomaticInterstitial = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startAutomaticInterstitialTimer();
    final auth = ref.read(authProvider).state;
    _refreshStream = GoRouterRefreshStream(auth);
    _initRouter(auth);
  }

  void _startAutomaticInterstitialTimer() {
    _interstitialTimer?.cancel();
    _interstitialTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _maybeShowAutomaticInterstitial();
    });
  }

  Future<void> _maybeShowAutomaticInterstitial() async {
    if (!mounted || _showingAutomaticInterstitial || WidgetsBinding.instance.lifecycleState != AppLifecycleState.resumed) return;
    final user = ref.read(authProvider).state.user;
    if (user == null || !AdMobService.instance.interstitialEnabled || !AdMobService.instance.autoInterstitialEnabled) {
      _nextInterstitialAt = null;
      return;
    }

    final now = DateTime.now();
    final interval = Duration(minutes: AdMobService.instance.interstitialIntervalMinutes);
    _nextInterstitialAt ??= now.add(interval);
    if (now.isBefore(_nextInterstitialAt!)) return;

    _showingAutomaticInterstitial = true;
    final shown = await AdMobService.instance.showInterstitialAd();
    _showingAutomaticInterstitial = false;
    if (!mounted) return;
    _nextInterstitialAt = DateTime.now().add(Duration(minutes: AdMobService.instance.interstitialIntervalMinutes));
    if (!shown) {
      // Keep the 20-minute schedule even if an ad could not be loaded.
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _maybeShowAutomaticInterstitial();
    }
  }

  void _initRouter(AuthState auth) {
    _router = GoRouter(
      initialLocation: '/',
      refreshListenable: _refreshStream,
      redirect: (ctx, state) {
        final loggedIn = auth.user != null;
        final loc = state.matchedLocation;
        final isAuthScreen =
            loc == '/login' || loc == '/signup' || loc == '/forgot';
        final needsProfileCompletion =
            auth.user != null && !auth.user!.isProfileComplete;
        final isProfileCompletionScreen = loc.startsWith('/profile/complete');
        final requiresCompletedProfile = [
          '/earn',
          '/create',
          '/campaigns',
          '/wheel',
        ].any(loc.startsWith);

        if (!loggedIn && !isAuthScreen) return '/login';
        if (loggedIn && isAuthScreen) {
          return needsProfileCompletion ? '/profile/complete' : '/home';
        }
        if (needsProfileCompletion && loc == '/profile') {
          return '/profile/complete';
        }
        if (needsProfileCompletion && requiresCompletedProfile && !isProfileCompletionScreen) {
          return '/profile/complete';
        }
        if (!needsProfileCompletion && isProfileCompletionScreen) {
          return '/profile';
        }
        return null;
      },
      routes: [
        GoRoute(path: '/', builder: (_, __) => const SplashScreen()),
        GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
        GoRoute(path: '/signup', builder: (_, __) => const SignupScreen()),
        GoRoute(path: '/forgot', builder: (_, __) => const ResetPasswordScreen()),
        ShellRoute(
          builder: (_, __, child) => MainShell(child: child),
          routes: [
            GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
            GoRoute(path: '/earn', builder: (_, __) => const EarnScreen()),
            GoRoute(
              path: '/create',
              builder: (_, __) => const CreateCampaignScreen(),
            ),
            GoRoute(path: '/shop', builder: (_, __) => const ShopScreen()),
            GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
            GoRoute(
              path: '/profile/complete',
              builder: (_, __) => const ProfileCompletionScreen(),
            ),
          ],
        ),
        GoRoute(
          path: '/campaigns',
          builder: (_, __) => const MyCampaignsScreen(),
        ),
        GoRoute(
          path: '/referrals',
          builder: (_, __) => const ReferralsScreen(),
        ),
        GoRoute(
          path: '/notifications',
          builder: (_, __) => const NotificationsScreen(),
        ),
        GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
        GoRoute(path: '/contact', builder: (_, __) => const ContactScreen()),
        GoRoute(path: '/wheel', builder: (_, __) => const LuckyWheelScreen()),
      ],
    );
  }

  @override
  void didUpdateWidget(covariant TikBoostApp oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Router stays stable — do NOT rebuild here
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _interstitialTimer?.cancel();
    _refreshStream.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(clientConfigProvider);
    final themeMode = ref.watch(themeProvider).mode;

    return MaterialApp.router(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      themeMode: themeMode,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      routerConfig: _router,
      builder: (ctx, child) => MediaQuery(
        data: MediaQuery.of(ctx).copyWith(
          textScaler: const TextScaler.linear(1.0),
        ),
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: child!,
        ),
      ),
    );
  }
}

class GoRouterRefreshStream extends ChangeNotifier {
  late final VoidCallback _listener;
  late final AuthState _authState;

  GoRouterRefreshStream(AuthState s) {
    _authState = s;
    _listener = () => notifyListeners();
    _authState.addListener(_listener);
  }

  @override
  void dispose() {
    _authState.removeListener(_listener);
    super.dispose();
  }
}
