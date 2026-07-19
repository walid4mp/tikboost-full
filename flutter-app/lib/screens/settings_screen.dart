import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = ref.watch(themeProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('الإعدادات')),
      body: ListView(
        children: [
          SwitchListTile(
            secondary: const Icon(Icons.dark_mode, color: AppColors.red),
            title: const Text('الوضع الداكن'),
            value: theme.isDark,
            onChanged: (_) => theme.toggle(),
          ),
          ListTile(
            leading: const Icon(Icons.language, color: AppColors.blue),
            title: const Text('تغيير اللغة'),
            subtitle: const Text('العربية / English'),
            onTap: () => theme.setLanguage('ar'),
          ),
          ListTile(
            leading: const Icon(Icons.notifications, color: AppColors.red),
            title: const Text('الإشعارات الفورية'),
            subtitle: const Text('مفعّلة عبر Socket.io'),
            trailing: const Icon(Icons.check_circle, color: AppColors.success),
            onTap: null,
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.privacy_tip, color: AppColors.blue),
            title: const Text('سياسة الخصوصية'),
            onTap: () => launchUrl(Uri.parse('https://example.com/privacy'), mode: LaunchMode.externalApplication),
          ),
          ListTile(
            leading: const Icon(Icons.description, color: AppColors.blue),
            title: const Text('الشروط والأحكام'),
            onTap: () => launchUrl(Uri.parse('https://example.com/terms'),  mode: LaunchMode.externalApplication),
          ),
          ListTile(
            leading: const Icon(Icons.support_agent, color: AppColors.red),
            title: const Text('اتصل بنا'),
            onTap: () => context.push('/contact'),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout, color: AppColors.red),
            title: const Text('تسجيل الخروج'),
            onTap: () async {
              await ref.read(authProvider).logout();
              if (context.mounted) context.go('/login');
            },
          ),
          const SizedBox(height: 20),
          const Center(child: Text(
            'TikBoost v1.0.0',
            style: TextStyle(color: AppColors.textMuted, fontSize: 12),
          )),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}
