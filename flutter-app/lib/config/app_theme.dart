import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  static const Color black     = Color(0xFF0B0B0F);
  static const Color dark      = Color(0xFF14141A);
  static const Color card      = Color(0xFF1C1C24);
  static const Color border    = Color(0xFF26262F);
  static const Color red       = Color(0xFFFF3B5C);
  static const Color redDeep   = Color(0xFFD7263D);
  static const Color blue      = Color(0xFF2D7BFF);
  static const Color blueLite  = Color(0xFF61A0FF);
  static const Color white     = Color(0xFFFFFFFF);
  static const Color text      = Color(0xFFF2F2F5);
  static const Color textMuted = Color(0xFF8C8C99);
  static const Color success   = Color(0xFF22C55E);
  static const Color warning   = Color(0xFFF59E0B);
}

class AppTheme {
  static ThemeData get dark => _build(Brightness.dark);
  static ThemeData get light => _build(Brightness.light);

  static ThemeData _build(Brightness b) {
    final isDark = b == Brightness.dark;
    final bg      = isDark ? AppColors.black     : const Color(0xFFF6F7FB);
    final surface = isDark ? AppColors.dark      : Colors.white;
    final text    = isDark ? AppColors.text      : const Color(0xFF15151B);

    final base = ThemeData(
      brightness: b,
      useMaterial3: true,
      scaffoldBackgroundColor: bg,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.red,
        brightness: b,
        primary: AppColors.red,
        secondary: AppColors.blue,
        surface: surface,
        onPrimary: Colors.white,
      ),
    );

    return base.copyWith(
      textTheme: GoogleFonts.cairoTextTheme(base.textTheme).apply(
        bodyColor: text, displayColor: text,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: bg.withOpacity(0.85),
        elevation: 0,
        centerTitle: true,
        iconTheme: IconThemeData(color: text),
        titleTextStyle: GoogleFonts.cairo(
          color: text, fontSize: 17, fontWeight: FontWeight.w700,
        ),
      ),
      cardTheme: CardTheme(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.red,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 22),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: GoogleFonts.cairo(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: AppColors.border),
          foregroundColor: text,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 22),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.red, width: 1.4),
        ),
        hintStyle: TextStyle(color: AppColors.textMuted),
      ),
    );
  }
}
