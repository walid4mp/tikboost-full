import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/country_picker_field.dart';

class ProfileCompletionScreen extends ConsumerStatefulWidget {
  const ProfileCompletionScreen({super.key});

  @override
  ConsumerState<ProfileCompletionScreen> createState() =>
      _ProfileCompletionScreenState();
}

class _ProfileCompletionScreenState
    extends ConsumerState<ProfileCompletionScreen> {
  final formKey = GlobalKey<FormState>();
  String? gender;
  String? countryCode;
  bool busy = false;
  String? error;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider).state.user;
    gender = user?.gender.isNotEmpty == true ? user!.gender : null;
    countryCode = user?.countryCode.isNotEmpty == true ? user!.countryCode : null;
  }

  Future<void> submit() async {
    if (!formKey.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await ref.read(authProvider).completeProfile(
            gender: gender!,
            countryCode: countryCode!,
          );
      if (mounted) {
        context.go('/profile');
      }
    } catch (e) {
      setState(() {
        error = (e as dynamic).response?.data?['message'] ??
            'تعذر حفظ بيانات الملف الشخصي';
      });
    } finally {
      if (mounted) {
        setState(() => busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        AppColors.red.withValues(alpha: 0.14),
                        AppColors.blue.withValues(alpha: 0.12),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.verified_user_outlined,
                          size: 40, color: AppColors.red),
                      const SizedBox(height: 12),
                      Text(
                        'أكمل ملفك الشخصي أولاً',
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'لاستخدام الحملات والمهام، نحتاج تحديد النوع والدولة للتحقق من استهداف الجمهور بشكل صحيح.',
                        style: TextStyle(color: AppColors.textMuted, height: 1.5),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                Form(
                  key: formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('النوع',
                          style: TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 10,
                        children: [
                          ChoiceChip(
                            selected: gender == 'MALE',
                            onSelected: (_) => setState(() => gender = 'MALE'),
                            label: const Text('ذكر'),
                          ),
                          ChoiceChip(
                            selected: gender == 'FEMALE',
                            onSelected: (_) => setState(() => gender = 'FEMALE'),
                            label: const Text('أنثى'),
                          ),
                        ],
                      ),
                      if (gender == null)
                        const Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: Text('اختر النوع',
                              style: TextStyle(color: AppColors.red)),
                        ),
                      const SizedBox(height: 18),
                      CountryPickerField(
                        value: countryCode,
                        onChanged: (country) => setState(() => countryCode = country.code),
                        validator: (value) => (value == null || value.isEmpty)
                            ? 'اختر الدولة'
                            : null,
                      ),
                      if (error != null) ...[
                        const SizedBox(height: 14),
                        Text(error!,
                            style: const TextStyle(color: AppColors.red)),
                      ],
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: busy ? null : submit,
                          icon: busy
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(Icons.check_circle_outline),
                          label: Text(busy ? 'جاري الحفظ...' : 'حفظ واستكمال المتابعة'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
