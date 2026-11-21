import 'package:flutter/material.dart' hide Text;

import '../i18n/tr_text.dart';
import '../services/sound_service.dart';

/// Compact globe button that opens a language menu (Arabic / English / Français).
/// Used on the sign-in screen so people can switch language before logging in.
class LanguageChip extends StatelessWidget {
  const LanguageChip({super.key});

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      tooltip: tr('تغيير اللغة'),
      icon: const Icon(Icons.language_rounded, color: Colors.white70),
      onOpened: () => SoundService.instance.playTap(),
      onSelected: (code) => I18n.instance.setLang(code),
      itemBuilder: (_) => [
        for (final code in I18n.supported)
          PopupMenuItem<String>(
            value: code,
            child: Row(children: [
              Text(I18n.flags[code] ?? '', style: const TextStyle(fontSize: 20)),
              const SizedBox(width: 10),
              Text(I18n.nativeNames[code] ?? code, style: TextStyle(fontWeight: I18n.instance.lang == code ? FontWeight.w900 : FontWeight.w500)),
            ]),
          ),
      ],
    );
  }
}
