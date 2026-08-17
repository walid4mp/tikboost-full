import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../config/app_theme.dart';
import '../services/api_client.dart';

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  ConsumerState<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final emailCtrl = TextEditingController();
  final codeCtrl = TextEditingController();
  final pwdCtrl = TextEditingController();
  final confirmPwdCtrl = TextEditingController();
  bool busy = false;
  String? msg;
  String? error;


  String friendly(Object e) {
    try {
      final d = (e as dynamic).response?.data;
      final m = d is Map ? d['message'] : null;
      if (m != null) return m.toString();
    } catch (_) {}
    return 'حدث خطأ، حاول مرة أخرى.';
  }

  Future<void> sendReset() async {
    setState(() { busy = true; msg = null; error = null; });
    try {
      final r = await ApiClient.instance.dio.post('/auth/forgot', data: {'email': emailCtrl.text.trim()});
      setState(() => msg = (r.data['message'] ?? 'إذا كان هذا البريد مسجلًا لدينا، فقد أرسلنا إليه رابط إعادة التعيين.').toString());
    } catch (e) {
      setState(() => error = friendly(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> applyNewPassword() async {
    setState(() { busy = true; msg = null; error = null; });
    try {
      final r = await ApiClient.instance.dio.post('/auth/reset', data: {
        'email': emailCtrl.text.trim(),
        'code': codeCtrl.text.trim(),
        'newPassword': pwdCtrl.text,
        'confirmPassword': confirmPwdCtrl.text,
      });
      setState(() => msg = (r.data['message'] ?? 'تم تغيير كلمة المرور بنجاح.').toString());
      await Future.delayed(const Duration(milliseconds: 600));
      if (mounted) context.go('/login');
    } catch (e) {
      setState(() => error = friendly(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    emailCtrl.dispose();
    codeCtrl.dispose();
    pwdCtrl.dispose();
    confirmPwdCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('نسيت كلمة المرور')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.all(20),
            children: [
              TextField(
                controller: emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'البريد الإلكتروني'),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: busy ? null : sendReset,
                child: Text(busy ? '...' : 'طلب رمز الاستعادة'),
              ),
              const Divider(height: 32),
              TextField(
                controller: codeCtrl,
                decoration: const InputDecoration(labelText: 'رمز الاستعادة (يرسله لك الدعم يدويًا)'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: pwdCtrl,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'كلمة المرور الجديدة'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: confirmPwdCtrl,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'تأكيد كلمة المرور الجديدة'),
              ),
              const Text(
                'بعد طلب الرمز، سيظهر الطلب لدى الإدارة. سيرسل لك الدعم الرمز يدويًا عبر وسيلة التواصل المتاحة.',
                style: TextStyle(color: AppColors.textMuted),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: busy ? null : applyNewPassword,
                child: Text(busy ? '...' : 'تغيير كلمة المرور'),
              ),
              if (msg != null) ...[
                const SizedBox(height: 12),
                Text(msg!, style: const TextStyle(color: AppColors.success)),
              ],
              if (error != null) ...[
                const SizedBox(height: 12),
                Text(error!, style: const TextStyle(color: Colors.redAccent)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
