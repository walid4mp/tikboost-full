import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../config/app_config.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import '../services/sound_service.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  final email = TextEditingController();
  final password = TextEditingController();
  final emailFocus = FocusNode();
  final passwordFocus = FocusNode();

  bool busy = false;
  bool hidePassword = true;
  String? error;

  late final AnimationController _intro;
  late final Animation<double> _fade;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _intro = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 850),
    )..forward();
    _fade = CurvedAnimation(parent: _intro, curve: Curves.easeOutCubic);
    _slide = Tween<Offset>(
      begin: const Offset(0, .08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _intro, curve: Curves.easeOutCubic));
  }

  Future<void> doLogin() async {
    FocusScope.of(context).unfocus();
    if (email.text.trim().isEmpty || password.text.isEmpty) {
      setState(() => error = 'أدخل البريد الإلكتروني وكلمة المرور للمتابعة.');
      return;
    }

    setState(() {
      busy = true;
      error = null;
    });

    try {
      await ref.read(authProvider).login(
            email: email.text.trim(),
            password: password.text,
          );
      if (!mounted) return;
      await SoundService.instance.playTap();
      context.go('/home');
    } catch (e) {
      if (mounted) setState(() => error = _readError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  String _readError(Object e) {
    try {
      return (e as dynamic).response?.data?['message']?.toString() ??
          'تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.';
    } catch (_) {
      return 'تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.';
    }
  }

  void _openSignup() {
    SoundService.instance.playTap();
    context.push('/signup');
  }

  void _openForgot() {
    SoundService.instance.playTap();
    context.push('/forgot');
  }

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    emailFocus.dispose();
    passwordFocus.dispose();
    _intro.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          const _LoginBackdrop(),
          SafeArea(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: EdgeInsets.fromLTRB(20, 18, 20, 28 + bottom),
              child: FadeTransition(
                opacity: _fade,
                child: SlideTransition(
                  position: _slide,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 520),
                    child: Column(
                      children: [
                        _buildTopBar(),
                        const SizedBox(height: 26),
                        _buildBrand(),
                        const SizedBox(height: 30),
                        _buildCard(),
                        const SizedBox(height: 22),
                        _buildTrustRow(),
                        const SizedBox(height: 18),
                        Text(
                          '${AppConfig.appName} • مجتمع المكافآت والتفاعل',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopBar() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const SizedBox(width: 42),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 7,
              height: 7,
              decoration: const BoxDecoration(
                color: AppColors.success,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(color: Color(0x6647E6A1), blurRadius: 10),
                ],
              ),
            ),
            const SizedBox(width: 7),
            const Text(
              'آمن • سريع • موثوق',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(width: 42),
      ],
    );
  }

  Widget _buildBrand() {
    return Column(
      children: [
        Container(
          width: 94,
          height: 94,
          padding: const EdgeInsets.all(2.5),
          decoration: BoxDecoration(
            gradient: AppColors.aurora,
            borderRadius: BorderRadius.circular(30),
            boxShadow: const [
              BoxShadow(
                color: Color(0x554DD7FF),
                blurRadius: 34,
                spreadRadius: 2,
              ),
              BoxShadow(
                color: Color(0x44FF4FA3),
                blurRadius: 48,
                spreadRadius: -4,
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(27),
            child: Image.asset(
              'assets/icons/icon_original.png',
              fit: BoxFit.cover,
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          AppConfig.appName,
          style: const TextStyle(
            fontSize: 31,
            fontWeight: FontWeight.w900,
            letterSpacing: .5,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'تفاعل أكثر • اكسب أكثر • تألق أكثر ✨',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _buildCard() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(30),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
          decoration: BoxDecoration(
            color: const Color(0xDD121621),
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: const Color(0x262BDAFF)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x55000000),
                blurRadius: 34,
                offset: Offset(0, 18),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'مرحبًا بعودتك 👋',
                textAlign: TextAlign.right,
                style: TextStyle(fontSize: 25, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 5),
              const Text(
                'سجّل دخولك للوصول إلى حسابك ومكافآتك.',
                textAlign: TextAlign.right,
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 22),
              _field(
                controller: email,
                focusNode: emailFocus,
                nextFocus: passwordFocus,
                label: 'البريد الإلكتروني',
                hint: 'example@email.com',
                icon: Icons.alternate_email_rounded,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 13),
              _field(
                controller: password,
                focusNode: passwordFocus,
                label: 'كلمة المرور',
                hint: '••••••••',
                icon: Icons.lock_outline_rounded,
                obscureText: hidePassword,
                suffix: IconButton(
                  tooltip: hidePassword ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور',
                  onPressed: () async {
                    await SoundService.instance.playTap();
                    if (mounted) setState(() => hidePassword = !hidePassword);
                  },
                  icon: Icon(
                    hidePassword
                        ? Icons.visibility_rounded
                        : Icons.visibility_off_rounded,
                    color: AppColors.textMuted,
                  ),
                ),
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: busy ? null : _openForgot,
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.blueLite,
                    padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 8),
                  ),
                  child: const Text(
                    'نسيت كلمة المرور؟',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                  ),
                ),
              ),
              if (error != null) ...[
                const SizedBox(height: 3),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                  decoration: BoxDecoration(
                    color: const Color(0x22FF5F6D),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0x44FF5F6D)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded, color: Color(0xFFFF7580), size: 19),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          error!,
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                            color: Color(0xFFFFA2A9),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 10),
              _loginButton(),
              const SizedBox(height: 13),
              Row(
                children: [
                  const Expanded(child: Divider(color: AppColors.border)),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 12),
                    child: Text('أو', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                  ),
                  const Expanded(child: Divider(color: AppColors.border)),
                ],
              ),
              const SizedBox(height: 13),
              OutlinedButton.icon(
                onPressed: busy ? null : _openSignup,
                icon: const Icon(Icons.person_add_alt_1_rounded, size: 20),
                label: const Text('إنشاء حساب جديد'),
              ),
              if (AppConfig.enableGoogleLogin) ...[
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: busy
                      ? null
                      : () {
                          SoundService.instance.playTap();
                          setState(() => error = 'ربط Google Sign-In يحتاج إلى إعداد OAuth داخل نسخة Android.');
                        },
                  icon: const Icon(Icons.g_mobiledata_rounded, size: 29, color: AppColors.blue),
                  label: const Text('متابعة باستخدام Google'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required FocusNode focusNode,
    FocusNode? nextFocus,
    required String label,
    required String hint,
    required IconData icon,
    TextInputType? keyboardType,
    bool obscureText = false,
    Widget? suffix,
  }) {
    return TextField(
      controller: controller,
      focusNode: focusNode,
      keyboardType: keyboardType,
      obscureText: obscureText,
      textInputAction: nextFocus == null ? TextInputAction.done : TextInputAction.next,
      onSubmitted: (_) {
        if (nextFocus != null) {
          FocusScope.of(context).requestFocus(nextFocus);
        } else if (!busy) {
          doLogin();
        }
      },
      style: const TextStyle(fontWeight: FontWeight.w600),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: Icon(icon, color: AppColors.blueLite),
        suffixIcon: suffix,
        floatingLabelBehavior: FloatingLabelBehavior.auto,
      ),
    );
  }

  Widget _loginButton() {
    return Container(
      decoration: BoxDecoration(
        gradient: AppColors.aurora,
        borderRadius: BorderRadius.circular(17),
        boxShadow: const [
          BoxShadow(color: Color(0x445D8CFF), blurRadius: 22, offset: Offset(0, 9)),
        ],
      ),
      child: ElevatedButton(
        onPressed: busy
            ? null
            : () async {
                await SoundService.instance.playTap();
                await doLogin();
              },
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.transparent,
          disabledBackgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          minimumSize: const Size(0, 56),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17)),
        ),
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 180),
          child: busy
              ? const SizedBox(
                  key: ValueKey('loading'),
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                )
              : const Row(
                  key: ValueKey('login'),
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('تسجيل الدخول', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
                    SizedBox(width: 8),
                    Icon(Icons.arrow_forward_rounded, size: 21),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _buildTrustRow() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: const [
        _TrustItem(icon: Icons.shield_outlined, text: 'حماية الحساب'),
        SizedBox(width: 18),
        _TrustItem(icon: Icons.flash_on_rounded, text: 'دخول سريع'),
        SizedBox(width: 18),
        _TrustItem(icon: Icons.verified_rounded, text: 'موثوق'),
      ],
    );
  }
}

class _TrustItem extends StatelessWidget {
  final IconData icon;
  final String text;

  const _TrustItem({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Flexible(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: AppColors.success),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              text,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LoginBackdrop extends StatelessWidget {
  const _LoginBackdrop();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Color(0xFF05060A),
            Color(0xFF0E1020),
            Color(0xFF08151B),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -100,
            right: -80,
            child: _GlowOrb(
              size: 280,
              color: const Color(0x553F7CFF),
            ),
          ),
          Positioned(
            top: 260,
            left: -120,
            child: _GlowOrb(
              size: 260,
              color: const Color(0x44FF3D9A),
            ),
          ),
          Positioned(
            bottom: -100,
            right: -70,
            child: _GlowOrb(
              size: 240,
              color: const Color(0x443FDFFF),
            ),
          ),
        ],
      ),
    );
  }
}

class _GlowOrb extends StatelessWidget {
  final double size;
  final Color color;

  const _GlowOrb({required this.size, required this.color});

  @override
  Widget build(BuildContext context) {
    return ImageFiltered(
      imageFilter: ImageFilter.blur(sigmaX: 55, sigmaY: 55),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color,
        ),
      ),
    );
  }
}
