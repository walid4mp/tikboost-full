import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';

/// Displays the supplied TikBoost artwork as the only splash-screen content.
/// The progress bar and all text are part of the image itself; no widgets are
/// layered over it. After a short viewing period, continue to the app entry.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  Timer? _navigationTimer;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    unawaited(SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky));
    _navigationTimer = Timer(const Duration(seconds: 4), _continueToApp);
  }

  void _continueToApp() {
    if (!mounted || _navigated) return;
    _navigated = true;
    final auth = ref.read(authProvider).state;
    unawaited(SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge));
    context.go(auth.loggedIn ? '/home' : '/login');
  }

  @override
  void dispose() {
    _navigationTimer?.cancel();
    unawaited(SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge));
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Color(0xFF030514),
      body: SizedBox.expand(
        child: Image(
          image: AssetImage('assets/icons/tikboost_wh_splash.png'),
          fit: BoxFit.fill,
          filterQuality: FilterQuality.high,
        ),
      ),
    );
  }
}
