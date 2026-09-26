import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config/app_config.dart';
import '../config/app_theme.dart';
import '../config/app_localizations.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../services/sound_service.dart';
import '../services/push_notification_service.dart';

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
      appBar: AppBar(title: Text(context.tr('settings'))),
      body: ListView(
        children: [
          SwitchListTile(
            secondary: const Icon(Icons.dark_mode, color: AppColors.red),
            title: Text(context.tr('dark_mode')),
            value: theme.isDark,
            onChanged: (_) async { await SoundService.instance.playTap(); theme.toggle(); },
          ),
          ListTile(
            leading: const Icon(Icons.language, color: AppColors.blue),
            title: Text(context.tr('change_language')),
            subtitle: Text(context.tr('language_subtitle')),
            onTap: () async {
              await SoundService.instance.playTap();
              if (!context.mounted) return;
              await showModalBottomSheet<void>(
                context: context,
                showDragHandle: true,
                builder: (sheetContext) => SafeArea(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Padding(padding: const EdgeInsets.all(16), child: Text(context.tr('choose_language'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900))),
                    for (final item in const [('ar','العربية'), ('fr','Français'), ('en','English')])
                      ListTile(leading: Text(item.$1 == 'ar' ? '🇩🇿' : item.$1 == 'fr' ? '🇫🇷' : '🇬🇧', style: const TextStyle(fontSize: 22)), title: Text(item.$2), trailing: theme.languageCode == item.$1 ? const Icon(Icons.check_circle, color: AppColors.success) : null, onTap: () async { await theme.setLanguage(item.$1); if (sheetContext.mounted) Navigator.pop(sheetContext); }),
                    const SizedBox(height: 8),
                  ]),
                ),
              );
            },
          ),
          SwitchListTile(
            secondary: const Icon(Icons.volume_up_rounded, color: AppColors.blue),
            title: Text(context.tr('sounds')),
            subtitle: Text(context.tr('sounds_subtitle')),
            value: SoundService.instance.enabled,
            onChanged: (value) {
              setState(() => SoundService.instance.enabled = value);
              if (value) SoundService.instance.playTap();
            },
          ),
          ListTile(
            leading: const Icon(Icons.notifications, color: AppColors.red),
            title: Text(context.tr('push')),
            subtitle: Text(
              PushNotificationService.instance.notificationsAllowed
                  ? context.tr('notifications_allowed')
                  : context.tr('notifications_denied'),
            ),
            trailing: Icon(
              PushNotificationService.instance.notificationsAllowed
                  ? Icons.check_circle
                  : Icons.notifications_off,
              color: PushNotificationService.instance.notificationsAllowed
                  ? AppColors.success
                  : AppColors.textMuted,
            ),
            onTap: () async {
              await SoundService.instance.playTap();
              await PushNotificationService.instance.requestPermission();
              if (mounted) setState(() {});
            },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.privacy_tip, color: AppColors.blue),
            title: Text(context.tr('privacy')),
            onTap: () async { await SoundService.instance.playTap(); launchUrl(Uri.parse(AppConfig.privacyUrl), mode: LaunchMode.externalApplication); },
          ),
          ListTile(
            leading: const Icon(Icons.description, color: AppColors.blue),
            title: Text(context.tr('terms')),
            onTap: () async { await SoundService.instance.playTap(); launchUrl(Uri.parse(AppConfig.termsUrl), mode: LaunchMode.externalApplication); },
          ),
          ListTile(
            leading: const Icon(Icons.support_agent, color: AppColors.red),
            title: Text(context.tr('contact')),
            onTap: () async { await SoundService.instance.playTap(); context.push('/contact'); },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout, color: AppColors.red),
            title: Text(context.tr('logout')),
            onTap: () async {
              await SoundService.instance.playTap();
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
