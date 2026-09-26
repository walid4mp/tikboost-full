import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../config/app_config.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});
  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _scale = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack),
    );
    _fade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeIn),
    );
    _ctrl.forward();

    Future.delayed(const Duration(milliseconds: 1800), () {
      if (!mounted) return;
      final auth = ref.read(authProvider).state;
      context.go(auth.loggedIn ? '/home' : '/login');
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF0B0B0F), Color(0xFF1A0511), Color(0xFF2A0816)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── Animated logo badge ──
              AnimatedBuilder(
                animation: _ctrl,
                builder: (_, child) {
                  return Transform.scale(
                    scale: _scale.value,
                    child: Opacity(
                      opacity: _fade.value.clamp(0.0, 1.0),
                      child: child,
                    ),
                  );
                },
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(30),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.red.withValues(alpha: 0.5),
                        blurRadius: 30,
                        spreadRadius: 4,
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(30),
                    child: Image.asset(
                      'assets/icons/icon_original.png',
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // ── App name ──
              FadeTransition(
                opacity: _fade,
                child: Text(
                  AppConfig.appName,
                  style: GoogleFonts.cairo(
                    color: Colors.white,
                    fontSize: 36,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // ── Tagline ──
              FadeTransition(
                opacity: _fade,
                child: Text(
                  AppConfig.tagline,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.cairo(
                    color: Colors.white70,
                    fontSize: 15,
                  ),
                ),
              ),
              const SizedBox(height: 40),

              // ── Loading indicator ──
              FadeTransition(
                opacity: _fade,
                child: const SizedBox(
                  width: 28,
                  height: 28,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: AppColors.red,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
