import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  bool busy = false;
  String? error;

  Future<void> doLogin() async {
    setState(() { busy = true; error = null; });
    try {
      await ref.read(authProvider).login(email: email.text.trim(), password: password.text);
      if (!mounted) return;
      context.go('/home');
    } catch (e) {
      setState(() => error = _readError(e));
    } finally { setState(() => busy = false); }
  }

  String _readError(Object e) {
    try { return (e as dynamic).response?.data?['message']?.toString() ?? e.toString(); }
    catch (_) { return e.toString(); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    width: 46, height: 46,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.red, AppColors.redDeep],
                        begin: Alignment.topLeft, end: Alignment.bottomRight),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Center(child: Text('T',
                      style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w900))),
                  ),
                  const SizedBox(width: 12),
                  const Text('TikBoost',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
                ],
              ),
              const SizedBox(height: 28),
              const Text('مرحباً بعودتك 👋',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text('سجّل دخولك لجمع النقاط وإدارة حملاتك.',
                style: TextStyle(color: AppColors.textMuted)),
              const SizedBox(height: 24),

              TextField(controller: email, keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(prefixIcon: Icon(Icons.email_outlined),
                  hintText: 'البريد الإلكتروني')),
              const SizedBox(height: 12),
              TextField(controller: password, obscureText: true,
                decoration: const InputDecoration(prefixIcon: Icon(Icons.lock_outline),
                  hintText: 'كلمة المرور')),
              const SizedBox(height: 16),
              if (error != null) Text(error!, style: const TextStyle(color: AppColors.red)),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: busy ? null : doLogin,
                child: busy
                    ? const SizedBox(height: 18, width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('تسجيل الدخول'),
              ),
              const SizedBox(height: 14),

              OutlinedButton.icon(
                onPressed: busy ? null : () async {
                  setState(() { busy = true; error = null; });
                  try {
                    await ref.read(authProvider).loginWithGoogle(
                      email: 'demo@gmail.com', name: 'مستخدم Google', googleId: DateTime.now().toString(),
                    );
                    if (!mounted) return;
                    context.go('/home');
                  } catch (e) {
                    setState(() => error = 'تعذر الدخول عبر Google الآن.');
                  } finally { setState(() => busy = false); }
                },
                icon: const Icon(Icons.login, color: AppColors.blue),
                label: const Text('متابعة باستخدام Google'),
              ),

              const SizedBox(height: 18),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                TextButton(onPressed: () => context.push('/forgot'),
                  child: const Text('نسيت كلمة المرور؟')),
                TextButton(onPressed: () => context.push('/signup'),
                  child: const Text('إنشاء حساب جديد', style: TextStyle(color: AppColors.red))),
              ]),
            ],
          ),
        ),
      ),
    );
  }
}
