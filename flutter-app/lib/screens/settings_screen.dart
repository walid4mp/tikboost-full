import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config/app_config.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../services/sound_service.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  @override
  Widget build(BuildContext context) {
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
          SwitchListTile(
            secondary: const Icon(Icons.volume_up_rounded, color: AppColors.blue),
            title: const Text('أصوات التطبيق'),
            subtitle: const Text('صوت الإشعارات وعجلة الحظ'),
            value: SoundService.instance.enabled,
            onChanged: (value) {
              setState(() => SoundService.instance.enabled = value);
              if (value) SoundService.instance.play('notify.wav');
            },
          ),
          const ListTile(
            leading: Icon(Icons.notifications, color: AppColors.red),
            title: Text('الإشعارات الفورية'),
            subtitle: Text('مفعّلة عبر Socket.io'),
            trailing: Icon(Icons.check_circle, color: AppColors.success),
            onTap: null,
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.privacy_tip, color: AppColors.blue),
            title: const Text('سياسة الخصوصية'),
            onTap: () => launchUrl(Uri.parse(AppConfig.privacyUrl), mode: LaunchMode.externalApplication),
          ),
          ListTile(
            leading: const Icon(Icons.description, color: AppColors.blue),
            title: const Text('الشروط والأحكام'),
            onTap: () => launchUrl(Uri.parse(AppConfig.termsUrl), mode: LaunchMode.externalApplication),
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
          const Center(
            child: Text(
              'TokAura v1.2.0',
              style: TextStyle(color: AppColors.textMuted, fontSize: 12),
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}
