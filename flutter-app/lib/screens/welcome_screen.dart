import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// First-run welcome screen. The welcome artwork is shown only once per install;
/// the buttons remain real Flutter controls layered over the artwork.
class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  bool _navigating = false;

  Future<void> _continueTo(String route) async {
    if (_navigating) return;
    setState(() => _navigating = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('tikboost_welcome_seen_v1', true);
    } catch (_) {
      // Continue even if preferences are temporarily unavailable.
    }
    if (!mounted) return;
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    if (!mounted) return;
    context.go(route);
  }

  @override
  void initState() {
    super.initState();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  @override
  void dispose() {
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF030514),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final h = constraints.maxHeight;
          return SizedBox.expand(
            child: Stack(
              fit: StackFit.expand,
              children: [
                Image.asset(
                  'assets/icons/tikboost_wh_welcome.png',
                  fit: BoxFit.cover,
                  alignment: Alignment.center,
                  errorBuilder: (_, __, ___) => const _WelcomeFallback(),
                ),
                // The artwork includes button artwork; transparent hit targets
                // make the illustrated controls genuinely interactive.
                Positioned(
                  left: constraints.maxWidth * 0.16,
                  right: constraints.maxWidth * 0.16,
                  bottom: h * 0.065,
                  height: h * 0.075,
                  child: Semantics(
                    button: true,
                    label: 'ابدأ الآن',
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(48),
                        onTap: () => _continueTo('/signup'),
                        child: _navigating
                            ? const Center(
                                child: SizedBox(
                                  width: 25,
                                  height: 25,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                    color: Colors.white,
                                  ),
                                ),
                              )
                            : const SizedBox.expand(),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: constraints.maxWidth * 0.20,
                  right: constraints.maxWidth * 0.20,
                  bottom: h * 0.015,
                  height: h * 0.045,
                  child: Semantics(
                    button: true,
                    label: 'تسجيل الدخول',
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(30),
                        onTap: () => _continueTo('/login'),
                        child: const SizedBox.expand(),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _WelcomeFallback extends StatelessWidget {
  const _WelcomeFallback();

  @override
  Widget build(BuildContext context) => Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF080B24), Color(0xFF24083D), Color(0xFF031B39)],
          ),
        ),
        alignment: Alignment.center,
        padding: const EdgeInsets.all(28),
        child: const Text(
          'مرحبًا بك في\ntikboost.wh\n\nتفاعل أكثر • اربح أكثر • انمُ معنا',
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
