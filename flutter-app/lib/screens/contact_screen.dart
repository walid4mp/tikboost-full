import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config/app_config.dart';
import '../config/app_theme.dart';

class ContactScreen extends StatelessWidget {
  const ContactScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('اتصل بنا')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const SizedBox(height: 8),
          const Center(child: Icon(Icons.support_agent, size: 80, color: AppColors.red)),
          const SizedBox(height: 14),
          const Center(
            child: Text('فريق TikBoost في خدمتك 🎧',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          ),
          const SizedBox(height: 22),

          _card(
            icon: Icons.chat,
            color: Colors.green,
            title: 'WhatsApp',
            value: AppConfig.whatsapp,
            url: 'https://wa.me/${AppConfig.whatsapp.replaceAll(' ', '')}',
          ),
          const SizedBox(height: 10),
          _card(
            icon: Icons.email,
            color: AppColors.blue,
            title: 'Email',
            value: AppConfig.email,
            url: 'mailto:${AppConfig.email}',
          ),

          const SizedBox(height: 26),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.red.withOpacity(0.10),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Row(children: [
              Icon(Icons.info_outline, color: AppColors.red),
              SizedBox(width: 10),
              Expanded(child: Text(
                'لشراء النقاط أو الاستفسار، يرجى التواصل عبر واتساب أو البريد الإلكتروني.',
                style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w700),
              )),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _card({
    required IconData icon, required Color color,
    required String title, required String value, required String url,
  }) {
    return Card(
      child: InkWell(
        onTap: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            CircleAvatar(backgroundColor: color.withOpacity(0.18),
              child: Icon(icon, color: color)),
            const SizedBox(width: 14),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
                Text(value, style: const TextStyle(color: AppColors.textMuted)),
              ])),
            const Icon(Icons.arrow_forward_ios, size: 16),
          ]),
        ),
      ),
    );
  }
}
