import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';

/// Cinematic branded intro for tikboost.wh.
/// The artwork is bundled locally, so the first screen does not depend on network.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _zoom;
  late final Animation<double> _fade;
  Timer? _navigationTimer;

  @override
  void initState() {
    super.initState();
    // The artwork already contains a designed status/navigation-bar treatment.
    unawaited(SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky));
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2800),
    );
    _zoom = Tween<double>(begin: 1.0, end: 1.075).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    _fade = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.0, 0.28, curve: Curves.easeOut),
    );
    _controller.forward();

    _navigationTimer = Timer(const Duration(milliseconds: 3000), () async {
      if (!mounted) return;
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
      if (!mounted) return;
      final prefs = await SharedPreferences.getInstance();
      final hasSeenWelcome = prefs.getBool('tikboost_welcome_seen_v1') ?? false;
      final auth = ref.read(authProvider).state;
      if (auth.loggedIn) {
        context.go('/home');
      } else if (!hasSeenWelcome) {
        context.go('/welcome');
      } else {
        context.go('/login');
      }
    });
  }

  @override
  void dispose() {
    _navigationTimer?.cancel();
    _controller.dispose();
    // Restore system bars if the route is disposed unexpectedly.
    unawaited(SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge));
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF030514),
      body: SizedBox.expand(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) => Opacity(
            opacity: _fade.value.clamp(0.0, 1.0),
            child: ClipRect(
              child: Transform.scale(
                scale: _zoom.value,
                child: Image.asset(
                  'assets/icons/tikboost_wh_splash.png',
                  fit: BoxFit.cover,
                  alignment: Alignment.center,
                  errorBuilder: (context, error, stackTrace) => const _FallbackSplash(),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FallbackSplash extends StatelessWidget {
  const _FallbackSplash();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF080B24), Color(0xFF24083D), Color(0xFF031B39)],
        ),
      ),
      alignment: Alignment.center,
      child: const Text(
        'tikboost.wh\nتفاعل أكثر • اربح أكثر • انمُ معنا',
        textAlign: TextAlign.center,
        style: TextStyle(
          color: Colors.white,
          fontSize: 27,
          fontWeight: FontWeight.w800,
          height: 1.8,
        ),
      ),
    );
  }
}
