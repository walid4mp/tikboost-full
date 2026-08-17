import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/app_config.dart';
import '../config/app_theme.dart';

class ContactScreen extends StatelessWidget {
  const ContactScreen({super.key});

  List<_ContactItem> _items() {
    final source = AppConfig.enabledContactLinks.isNotEmpty
        ? AppConfig.enabledContactLinks
        : AppConfig.buildFallbackContactLinks();

    return source
        .map((item) {
          final key = '${item['key'] ?? ''}'.trim().toLowerCase();
          final label = '${item['label'] ?? key}'.trim();
          final value = '${item['value'] ?? ''}'.trim();
          if (key.isEmpty || value.isEmpty) return null;

          switch (key) {
            case 'whatsapp':
              return _ContactItem(
                key: key,
                title: label.isEmpty ? 'WhatsApp' : label,
                subtitle: AppConfig.whatsappDisplayValue.isNotEmpty
                    ? AppConfig.whatsappDisplayValue
                    : value,
                actionLabel: 'فتح المحادثة',
                url: AppConfig.whatsappChatUrl,
                icon: Icons.chat_bubble_rounded,
                color: const Color(0xFF25D366),
              );
            case 'instagram':
              return _ContactItem(
                key: key,
                title: label.isEmpty ? 'Instagram' : label,
                subtitle: value,
                actionLabel: 'فتح الحساب',
                url: value,
                icon: Icons.camera_alt_rounded,
                color: const Color(0xFFE1306C),
              );
            case 'facebook':
              return _ContactItem(
                key: key,
                title: label.isEmpty ? 'Facebook' : label,
                subtitle: value,
                actionLabel: 'فتح الصفحة',
                url: value,
                icon: Icons.facebook_rounded,
                color: const Color(0xFF1877F2),
              );
            case 'email':
              return _ContactItem(
                key: key,
                title: label.isEmpty ? 'Email' : label,
                subtitle: value,
                actionLabel: 'إرسال بريد',
                url: AppConfig.supportMailTo,
                icon: Icons.email_rounded,
                color: AppColors.blue,
              );
            default:
              return _ContactItem(
                key: key,
                title: label,
                subtitle: value,
                actionLabel: 'فتح الرابط',
                url: value,
                icon: Icons.link_rounded,
                color: AppColors.red,
              );
          }
        })
        .whereType<_ContactItem>()
        .where((item) => item.url.trim().isNotEmpty)
        .toList();
  }

  Future<void> _openContact(BuildContext context, String url) async {
    final uri = Uri.tryParse(url.trim());
    if (uri == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تعذر فتح الرابط المطلوب')),
      );
      return;
    }

    bool launched = false;
    try {
      launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
        webOnlyWindowName: '_blank',
      );
    } catch (_) {
      launched = false;
    }

    if (!launched) {
      try {
        launched = await launchUrl(
          uri,
          mode: LaunchMode.platformDefault,
          webOnlyWindowName: '_blank',
        );
      } catch (_) {
        launched = false;
      }
    }

    if (!launched && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تعذر فتح الوسيلة حالياً')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items();

    return Scaffold(
      appBar: AppBar(title: const Text('تواصل معنا')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.red, AppColors.blue],
                begin: Alignment.topRight,
                end: Alignment.bottomLeft,
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x22000000),
                  blurRadius: 18,
                  offset: Offset(0, 10),
                ),
              ],
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: Colors.white24,
                  child: Icon(Icons.support_agent_rounded, color: Colors.white, size: 30),
                ),
                SizedBox(height: 18),
                Text(
                  'يسعدنا خدمتك',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                SizedBox(height: 8),
                Text(
                  'اختر وسيلة التواصل المناسبة وسنكون معك في أسرع وقت.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    height: 1.6,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          if (items.isEmpty)
            const Card(
              child: ListTile(
                leading: Icon(Icons.info_outline_rounded, color: AppColors.red),
                title: Text('لا توجد بيانات تواصل متاحة حالياً'),
                subtitle: Text('سيتم عرض وسائل التواصل هنا بمجرد تحديث الإعدادات العامة.'),
              ),
            )
          else
            ...items.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Card(
                  child: InkWell(
                    onTap: () => _openContact(context, item.url),
                    borderRadius: BorderRadius.circular(18),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                              color: item.color.withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Icon(item.icon, color: item.color, size: 28),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.title,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  item.subtitle,
                                  style: const TextStyle(
                                    color: AppColors.textMuted,
                                    height: 1.4,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 6,
                                  ),
                                  decoration: BoxDecoration(
                                    color: item.color.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                    item.actionLabel,
                                    style: TextStyle(
                                      color: item.color,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 10),
                          const Icon(
                            Icons.open_in_new_rounded,
                            size: 20,
                            color: AppColors.textMuted,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.blue.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.blue.withValues(alpha: 0.12)),
            ),
            child: const Row(
              children: [
                Icon(Icons.public_rounded, color: AppColors.blue),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'إذا لم يكن التطبيق الخاص بالوسيلة مثبتاً، سيتم فتح الرابط تلقائياً في المتصفح.',
                    style: TextStyle(
                      color: AppColors.blue,
                      fontWeight: FontWeight.w700,
                      height: 1.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ContactItem {
  const _ContactItem({
    required this.key,
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.url,
    required this.icon,
    required this.color,
  });

  final String key;
  final String title;
  final String subtitle;
  final String actionLabel;
  final String url;
  final IconData icon;
  final Color color;
}
