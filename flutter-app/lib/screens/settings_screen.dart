import 'package:flutter/material.dart' hide Text;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/app_config.dart';
import '../config/app_theme.dart';
import '../i18n/tr_text.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../services/sound_service.dart';

const _adminRoles = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'FINANCE'];

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  Future<void> _pickLanguage() async {
    await SoundService.instance.playTap();
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          for (final code in I18n.supported)
            ListTile(
              leading: Text(I18n.flags[code] ?? '', style: const TextStyle(fontSize: 26)),
              title: Text(I18n.nativeNames[code] ?? code, style: const TextStyle(fontWeight: FontWeight.w800)),
              trailing: I18n.instance.lang == code ? const Icon(Icons.check_circle_rounded, color: AppColors.success) : null,
              onTap: () async {
                Navigator.pop(ctx);
                await I18n.instance.setLang(code);
              },
            ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = ref.watch(themeProvider);
    final user = ref.watch(authProvider).state.user;
    final isAdmin = user != null && _adminRoles.contains(user.role);
    return Scaffold(
      appBar: AppBar(title: const Text('الإعدادات')),
      body: ListView(
        children: [
          SwitchListTile(
            secondary: const Icon(Icons.dark_mode, color: AppColors.red),
            title: const Text('الوضع الداكن'),
            value: theme.isDark,
            onChanged: (_) async { await SoundService.instance.playTap(); theme.toggle(); },
          ),
          ListTile(
            leading: const Icon(Icons.language, color: AppColors.blue),
            title: const Text('تغيير اللغة'),
            subtitle: Text('${I18n.flags[I18n.instance.lang] ?? ''} ${I18n.nativeNames[I18n.instance.lang] ?? ''}'),
            trailing: const Icon(Icons.keyboard_arrow_down_rounded),
            onTap: _pickLanguage,
          ),
          SwitchListTile(
            secondary: const Icon(Icons.volume_up_rounded, color: AppColors.blue),
            title: const Text('أصوات التطبيق'),
            subtitle: const Text('صوت الإشعارات وعجلة الحظ'),
            value: SoundService.instance.enabled,
            onChanged: (value) async {
              await SoundService.instance.setEnabled(value);
              if (mounted) setState(() {});
              if (value) SoundService.instance.playTap();
            },
          ),
          SwitchListTile(
            secondary: const Icon(Icons.vibration_rounded, color: AppColors.purple),
            title: const Text('الاهتزاز'),
            subtitle: const Text('اهتزاز خفيف عند اللمس والفوز'),
            value: SoundService.instance.hapticsEnabled,
            onChanged: (value) async {
              await SoundService.instance.setHaptics(value);
              if (mounted) setState(() {});
            },
          ),
          const ListTile(
            leading: Icon(Icons.notifications, color: AppColors.red),
            title: Text('الإشعارات الفورية'),
            subtitle: Text('مفعّلة عبر Socket.io'),
            trailing: Icon(Icons.check_circle, color: AppColors.success),
            onTap: null,
          ),
          ListTile(
            leading: const Icon(Icons.emoji_events_rounded, color: Colors.amber),
            title: const Text('المستويات والمهام'),
            onTap: () async { await SoundService.instance.playTap(); if (context.mounted) context.push('/missions'); },
          ),
          if (isAdmin)
            ListTile(
              leading: const Icon(Icons.admin_panel_settings_rounded, color: AppColors.success),
              title: const Text('لوحة الإدارة'),
              subtitle: const Text('التحكم الكامل بالتطبيق'),
              onTap: () async { await SoundService.instance.playTap(); if (context.mounted) context.push('/admin'); },
            ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.privacy_tip, color: AppColors.blue),
            title: const Text('سياسة الخصوصية'),
            onTap: () async { await SoundService.instance.playTap(); launchUrl(Uri.parse(AppConfig.privacyUrl), mode: LaunchMode.externalApplication); },
          ),
          ListTile(
            leading: const Icon(Icons.description, color: AppColors.blue),
            title: const Text('الشروط والأحكام'),
            onTap: () async { await SoundService.instance.playTap(); launchUrl(Uri.parse(AppConfig.termsUrl), mode: LaunchMode.externalApplication); },
          ),
          ListTile(
            leading: const Icon(Icons.support_agent, color: AppColors.red),
            title: const Text('اتصل بنا'),
            onTap: () async { await SoundService.instance.playTap(); context.push('/contact'); },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout, color: AppColors.red),
            title: const Text('تسجيل الخروج'),
            onTap: () async {
              await SoundService.instance.playTap();
              await ref.read(authProvider).logout();
              if (context.mounted) context.go('/login');
            },
          ),
          const SizedBox(height: 20),
          const Center(
            child: Text('tikboost.wh v1.4.0', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}
