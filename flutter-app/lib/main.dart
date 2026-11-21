import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'config/app_config.dart';
import 'config/app_theme.dart';
import 'i18n/i18n.dart';
import 'providers/auth_provider.dart';
import 'providers/client_config_provider.dart';
import 'providers/theme_provider.dart';
import 'screens/admin_screen.dart';
import 'screens/contact_screen.dart';
import 'screens/missions_screen.dart';
import 'screens/create_campaign_screen.dart';
import 'screens/earn_screen.dart';
import 'screens/home_screen.dart';
import 'screens/welcome_screen.dart';
import 'screens/login_screen.dart';
import 'screens/lucky_wheel_screen.dart';
import 'screens/main_shell.dart';
import 'screens/my_campaigns_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/profile_completion_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/payment_history_screen.dart';
import 'screens/referrals_screen.dart';
import 'screens/reset_password_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/shop_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/splash_screen.dart';
import 'services/admob_service.dart';
import 'services/sound_service.dart';
import 'services/socket_service.dart';
import 'services/local_notification_service.dart';
import 'services/push_notification_service.dart';


Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Local-only, fast: language + sound preferences must be known before the
  // first frame so the UI never flashes the wrong language.
  try {
    await I18n.instance.load();
    await SoundService.instance.load();
  } catch (_) {}
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    debugPrint('[flutter-error] ${details.exceptionAsString()}');
  };

  final container = ProviderContainer();

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );

  // Render the first Flutter frame immediately. Network/auth/ads/FCM
  // initialization must never block the UI and cause a black screen.
  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const TikBoostApp(),
    ),
  );

  unawaited(_bootstrapApp(container));
}

Future<void> _bootstrapApp(ProviderContainer container) async {
  final auth = container.read(authProvider);

  // 1) Restore the saved session from the phone first (no network). A signed-in
  //    user is therefore recognised instantly, even offline or while the
  //    server is waking up, and never sees the login page by mistake.
  final restored = await auth.restoreLocal();
  if (restored) auth.markBootstrapped();

  try {
    await container.read(clientConfigProvider).load();
  } catch (error, stackTrace) {
    debugPrint('[startup] client config failed: $error');
    debugPrintStack(stackTrace: stackTrace);
  }

  try {
    await AdMobService.instance.initialize();
  } catch (error) {
    debugPrint('[startup] admob failed: $error');
  }

  try {
    await LocalNotificationService.instance.initialize();
  } catch (error) {
    debugPrint('[startup] local notifications failed: $error');
  }

  try {
    await PushNotificationService.instance.initialize();
  } catch (error) {
    debugPrint('[startup] push notifications failed: $error');
  }

  // 2) Validate the session with the server. Network trouble keeps the user
  //    signed in; only an explicit server rejection signs them out.
  String? token;
  try {
    token = await auth.bootstrap();
  } catch (error, stackTrace) {
    debugPrint('[startup] auth bootstrap failed: $error');
    debugPrintStack(stackTrace: stackTrace);
  }

  auth.markBootstrapped();

  if (token != null && token.isNotEmpty) {
    try {
      await AdMobService.instance.loadUserAdConfig();
    } catch (error) {
      debugPrint('[startup] user ad config failed: $error');
    }

    try {
      SocketService.instance.connect(token);
    } catch (error) {
      debugPrint('[startup] socket connect failed: $error');
    }

    try {
      await PushNotificationService.instance.registerToken();
    } catch (error) {
      debugPrint('[startup] push token registration failed: $error');
    }

    try {
      final notifications = Map<String, dynamic>.from(
        container.read(clientConfigProvider).config['notifications'] ?? const {},
      );
      if (notifications['reminderEnabled'] != false) {
        await LocalNotificationService.instance.scheduleReminder(
          hours: int.tryParse(
                '${notifications['reminderAfterHours'] ?? 24}',
              ) ??
              24,
        );
      }
    } catch (error) {
      debugPrint('[startup] reminder scheduling failed: $error');
    }
  }
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
    PushNotificationService.instance.onOpenNotifications = () {
      if (ref.read(authProvider).state.loggedIn) _router.push('/notifications');
    };
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
      PushNotificationService.instance.onAppResumed();
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
            loc == '/login' || loc == '/signup' || loc == '/forgot' || loc == '/welcome';
        // Keep the splash and first-run welcome reachable before authentication.
        final isEntryScreen = loc == '/' || loc == '/welcome';
        final needsProfileCompletion =
            auth.user != null && !auth.user!.isProfileComplete;
        final isProfileCompletionScreen = loc.startsWith('/profile/complete');
        final requiresCompletedProfile = [
          '/earn',
          '/create',
          '/campaigns',
          '/wheel',
          '/missions',
        ].any(loc.startsWith);

        if (!loggedIn && !isAuthScreen && !isEntryScreen) return '/login';
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
        GoRoute(path: '/welcome', builder: (_, __) => const WelcomeScreen()),
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
            GoRoute(path: '/payments/history', builder: (_, __) => const PaymentHistoryScreen()),
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
        GoRoute(path: '/missions', builder: (_, __) => const MissionsScreen()),
        GoRoute(path: '/admin', builder: (_, __) => const AdminScreen()),
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

    // Rebuild the whole tree when the language changes so every `tr()` string
    // (and the text direction) updates instantly, without restarting the app.
    return ListenableBuilder(
      listenable: I18n.instance,
      builder: (context, _) {
        final i18n = I18n.instance;
        return MaterialApp.router(
          title: AppConfig.appName,
          debugShowCheckedModeBanner: false,
          themeMode: themeMode,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          routerConfig: _router,
          locale: i18n.locale,
          supportedLocales: const [Locale('ar'), Locale('en'), Locale('fr')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          builder: (ctx, child) => MediaQuery(
            data: MediaQuery.of(ctx).copyWith(
              textScaler: const TextScaler.linear(1.0),
            ),
            child: Directionality(
              textDirection: i18n.direction,
              child: KeyedSubtree(
                key: ValueKey<String>('lang-${i18n.lang}'),
                child: child ?? const SizedBox.shrink(),
              ),
            ),
          ),
        );
      },
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
