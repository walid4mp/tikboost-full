import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../config/app_config.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import '../services/sound_service.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  bool busy = false;
  bool hidePassword = true;
  String? error;

  Future<void> doLogin() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await ref.read(authProvider).login(
            email: email.text.trim(),
            password: password.text,
          );
      if (!mounted) return;
      context.go('/home');
    } catch (e) {
      setState(() => error = _readError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  String _readError(Object e) {
    try {
      return (e as dynamic).response?.data?['message']?.toString() ?? e.toString();
    } catch (_) {
      return e.toString();
    }
  }

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF07080D), Color(0xFF151126), Color(0xFF09141B)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(22, 34, 22, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 92,
                    height: 92,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(28),
                      gradient: AppColors.aurora,
                      boxShadow: const [BoxShadow(color: Color(0x554DD7FF), blurRadius: 30, spreadRadius: 2)],
                    ),
                    padding: const EdgeInsets.all(2),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(26),
                      child: Image.asset('assets/icons/icon_original.png', fit: BoxFit.cover),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                const Center(child: Text('TokAura', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w900, letterSpacing: .4))),
                const SizedBox(height: 6),
                const Center(child: Text('تفاعل أكثر • اكسب أكثر • تألق أكثر ✨', style: TextStyle(color: AppColors.textMuted))),
                const SizedBox(height: 30),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.card.withValues(alpha: .92),
                    borderRadius: BorderRadius.circular(26),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text('تسجيل الدخول', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                      const SizedBox(height: 6),
                      const Text('سجّل دخولك وابدأ بجمع المكافآت.', style: TextStyle(color: AppColors.textMuted)),
                      const SizedBox(height: 22),
                      TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(prefixIcon: Icon(Icons.alternate_email_rounded), hintText: 'البريد الإلكتروني')),
                      const SizedBox(height: 12),
                      TextField(controller: password, obscureText: hidePassword, decoration: InputDecoration(prefixIcon: const Icon(Icons.lock_rounded), hintText: 'كلمة المرور', suffixIcon: IconButton(onPressed: () { SoundService.instance.play('notify.wav'); setState(() => hidePassword = !hidePassword); }, icon: Icon(hidePassword ? Icons.visibility_rounded : Icons.visibility_off_rounded)))),
                      if (error != null) ...[
                        const SizedBox(height: 12),
                        Text(error!, style: const TextStyle(color: Color(0xFFFF6B7A))),
                      ],
                      const SizedBox(height: 18),
                      ElevatedButton.icon(
                        onPressed: busy ? null : doLogin,
                        icon: busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.arrow_forward_rounded),
                        label: Text(busy ? 'جارٍ الدخول...' : 'دخول إلى TokAura'),
                      ),
                      const SizedBox(height: 10),
                      OutlinedButton.icon(
                        onPressed: busy ? null : () { SoundService.instance.play('notify.wav'); context.push('/signup'); },
                        icon: const Icon(Icons.person_add_alt_1_rounded),
                        label: const Text('إنشاء حساب جديد'),
                      ),
                      const SizedBox(height: 4),
                      TextButton.icon(
                        onPressed: busy ? null : () { SoundService.instance.play('notify.wav'); context.push('/forgot'); },
                        icon: const Icon(Icons.lock_reset_rounded),
                        label: const Text('نسيت كلمة المرور؟'),
                      ),
                      if (AppConfig.enableGoogleLogin) ...[
                        const SizedBox(height: 14),
                        Row(children: const [Expanded(child: Divider()), Padding(padding: EdgeInsets.symmetric(horizontal: 10), child: Text('أو', style: TextStyle(color: AppColors.textMuted))), Expanded(child: Divider())]),
                        const SizedBox(height: 14),
                        OutlinedButton.icon(
                          onPressed: busy ? null : () => setState(() => error = 'ربط Google Sign-In يحتاج إلى إعداد OAuth داخل نسخة Android.'),
                          icon: const Icon(Icons.g_mobiledata_rounded, size: 30, color: AppColors.blue),
                          label: const Text('متابعة باستخدام Google'),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                const Center(child: Text('TokAura • مجتمع المكافآت والتفاعل', style: TextStyle(color: AppColors.textMuted, fontSize: 12))),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
