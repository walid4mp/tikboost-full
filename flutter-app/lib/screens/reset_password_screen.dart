import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config/app_config.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  ConsumerState<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final email = TextEditingController();
  final pwd = TextEditingController();
  bool busy = false;
  String? msg;
  String? error;

  Future<void> submit() async {
    setState(() {
      busy = true;
      msg = null;
      error = null;
    });
    try {
      await ref.read(authProvider).forgot(email.text.trim(), pwd.text);
      setState(() => msg = 'تم تغيير كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن.');
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> openLink(String value) async {
    final uri = Uri.parse(value);
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تعذر فتح وسيلة التواصل.')),
      );
    }
  }

  @override
  void dispose() {
    email.dispose();
    pwd.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final canUseLegacyReset = AppConfig.allowLegacyPasswordReset;

    return Scaffold(
      appBar: AppBar(title: const Text('استعادة الحساب')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'استعادة الحساب',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              Text(
                canUseLegacyReset
                    ? 'أدخل بريدك وكلمة مرور جديدة.'
                    : 'إعادة تعيين كلمة المرور المباشرة معطلة لحين تفعيل تدفق تحقق آمن. تواصل مع الدعم لاستعادة الحساب.',
                style: const TextStyle(color: AppColors.textMuted),
              ),
              const SizedBox(height: 18),
              if (canUseLegacyReset) ...[
                TextField(
                  controller: email,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.email_outlined),
                    hintText: 'البريد الإلكتروني',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: pwd,
                  obscureText: true,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.lock_outline),
                    hintText: 'كلمة مرور جديدة',
                  ),
                ),
                const SizedBox(height: 18),
                if (error != null)
                  Text(error!, style: const TextStyle(color: AppColors.red)),
                if (msg != null)
                  Text(msg!, style: const TextStyle(color: AppColors.success)),
                const SizedBox(height: 8),
                ElevatedButton(
                  onPressed: busy ? null : submit,
                  child: busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('تأكيد'),
                ),
              ] else ...[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.security_rounded, color: AppColors.warning),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'تم تعطيل إعادة التعيين غير الموثقة لتحسين الأمان.',
                                style: TextStyle(fontWeight: FontWeight.w700),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text('البريد: ${AppConfig.email}'),
                        const SizedBox(height: 6),
                        Text('واتساب: ${AppConfig.whatsapp}'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: () => openLink(AppConfig.supportMailTo),
                  icon: const Icon(Icons.email_outlined),
                  label: const Text('التواصل عبر البريد'),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: () => openLink(AppConfig.whatsappChatUrl),
                  icon: const Icon(Icons.support_agent),
                  label: const Text('التواصل عبر واتساب'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
