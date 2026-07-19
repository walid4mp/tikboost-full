import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key});
  @override
  ConsumerState<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final email = TextEditingController();
  final pwd   = TextEditingController();
  bool busy = false;
  String? msg;
  String? error;

  Future<void> submit() async {
    setState(() { busy = true; msg = null; error = null; });
    try {
      await ref.read(authProvider).forgot(email.text.trim(), pwd.text);
      setState(() => msg = 'تم تغيير كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن.');
    } catch (e) {
      setState(() => error = e.toString());
    } finally { setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('نسيت كلمة المرور')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('استعادة الحساب',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              const Text('أدخل بريدك وكلمة مرور جديدة.',
                style: TextStyle(color: AppColors.textMuted)),
              const SizedBox(height: 18),
              TextField(controller: email,
                decoration: const InputDecoration(prefixIcon: Icon(Icons.email_outlined),
                  hintText: 'البريد الإلكتروني')),
              const SizedBox(height: 12),
              TextField(controller: pwd,
                obscureText: true,
                decoration: const InputDecoration(prefixIcon: Icon(Icons.lock_outline),
                  hintText: 'كلمة مرور جديدة')),
              const SizedBox(height: 18),
              if (error != null) Text(error!, style: const TextStyle(color: AppColors.red)),
              if (msg != null) Text(msg!, style: const TextStyle(color: AppColors.success)),
              const SizedBox(height: 8),
              ElevatedButton(onPressed: busy ? null : submit,
                child: busy ? const SizedBox(width: 18, height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Text('تأكيد')),
            ],
          ),
        ),
      ),
    );
  }
}
