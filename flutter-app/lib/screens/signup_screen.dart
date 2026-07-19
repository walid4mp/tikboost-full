import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import 'package:go_router/go_router.dart';

class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key});
  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  final referral = TextEditingController();
  bool busy = false;
  String? error;

  Future<void> submit() async {
    setState(() { busy = true; error = null; });
    try {
      await ref.read(authProvider).signup(
        email: email.text.trim(), password: password.text, name: name.text.trim(),
        referralCode: referral.text.trim().isEmpty ? null : referral.text.trim(),
      );
      if (!mounted) return;
      context.go('/home');
    } catch (e) {
      setState(() => error = e.toString());
    } finally { setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('إنشاء حساب')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('انضم لـ TikBoost اليوم 🎉',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              const Text('تحصل على 5000 نقطة ترحيبية فورًا.',
                style: TextStyle(color: AppColors.textMuted)),
              const SizedBox(height: 18),
              TextField(controller: name,
                decoration: const InputDecoration(prefixIcon: Icon(Icons.person_outline),
                  hintText: 'الاسم الكامل')),
              const SizedBox(height: 12),
              TextField(controller: email, keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(prefixIcon: Icon(Icons.email_outlined),
                  hintText: 'البريد الإلكتروني')),
              const SizedBox(height: 12),
              TextField(controller: password, obscureText: true,
                decoration: const InputDecoration(prefixIcon: Icon(Icons.lock_outline),
                  hintText: 'كلمة المرور')),
              const SizedBox(height: 12),
              TextField(controller: referral,
                decoration: const InputDecoration(prefixIcon: Icon(Icons.card_giftcard),
                  hintText: 'كود الدعوة (اختياري)')),
              const SizedBox(height: 18),
              if (error != null) Text(error!, style: const TextStyle(color: AppColors.red)),
              const SizedBox(height: 8),
              ElevatedButton(onPressed: busy ? null : submit,
                child: busy ? const SizedBox(width: 18, height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Text('إنشاء الحساب')),
              const SizedBox(height: 16),
              Center(child: TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('لديك حساب؟ تسجيل الدخول'))),
            ],
          ),
        ),
      ),
    );
  }
}
