import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../config/app_config.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (!mounted) return;
      final auth = context.read<AuthProvider>().state;
      context.go(auth.loggedIn ? '/home' : '/login');
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF0B0B0F), Color(0xFF1A0511)],
            begin: Alignment.topCenter, end: Alignment.bottomCenter,
          ),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 110, height: 110,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.red, AppColors.redDeep],
                    begin: Alignment.topLeft, end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(color: AppColors.red.withOpacity(0.45),
                      blurRadius: 24, spreadRadius: 2),
                  ],
                ),
                child: const Center(
                  child: Text('T',
                    style: TextStyle(color: Colors.white, fontSize: 64, fontWeight: FontWeight.w900)),
                ),
              ),
              const SizedBox(height: 18),
              Text(AppConfig.appName,
                style: GoogleFonts.cairo(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900)),
              const SizedBox(height: 8),
              Text(AppConfig.tagline,
                textAlign: TextAlign.center,
                style: GoogleFonts.cairo(color: Colors.white70, fontSize: 14)),
              const SizedBox(height: 36),
              const CircularProgressIndicator(strokeWidth: 2, color: AppColors.red),
            ],
          ),
        ),
      ),
    );
  }
}
