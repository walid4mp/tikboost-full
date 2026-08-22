import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../config/app_config.dart';
import '../config/app_theme.dart';
import '../data/countries.dart';
import '../services/api_client.dart';
import '../widgets/country_picker_field.dart';

class CreateCampaignScreen extends ConsumerStatefulWidget {
  const CreateCampaignScreen({super.key});

  @override
  ConsumerState<CreateCampaignScreen> createState() =>
      _CreateCampaignScreenState();
}

class _CreateCampaignScreenState extends ConsumerState<CreateCampaignScreen> {
  final formKey = GlobalKey<FormState>();
  String type = 'FOLLOWERS';
  String targetGender = 'ALL';
  String targetCountry = 'WORLDWIDE';
  final targetUrl = TextEditingController();
  final quantity = TextEditingController(text: '100');
  final commentText = TextEditingController();
  String? error;
  bool busy = false;
  int totalCost = 0;

  bool get isCommentCampaign => type == 'COMMENTS';
  bool get isWorldwide => targetCountry == 'WORLDWIDE';

  void recalc() {
    final q = int.tryParse(quantity.text) ?? 0;
    setState(() => totalCost = q * AppConfig.priceForCampaign(type));
  }

  Future<void> submit() async {
    if (!formKey.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });

    try {
      final response = await ApiClient.instance.dio.post(
        '/campaigns',
        data: {
          'type': type,
          'targetUrl': targetUrl.text.trim(),
          'quantity': int.tryParse(quantity.text) ?? 0,
          'targetGender': targetGender,
          'targetCountry': targetCountry,
          if (isCommentCampaign) 'commentText': commentText.text.trim(),
        },
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.success,
          content: Text(
            'تم إنشاء الحملة ✅ تم خصم ${response.data['campaign']['pointsCost']} نقطة',
          ),
        ),
      );
      context.pop();
    } catch (e) {
      final message =
          (e as dynamic).response?.data?['message'] ?? 'فشل إنشاء الحملة';
      setState(() => error = message);
    } finally {
      if (mounted) {
        setState(() => busy = false);
      }
    }
  }

  @override
  void initState() {
    super.initState();
    recalc();
  }

  @override
  void dispose() {
    targetUrl.dispose();
    quantity.dispose();
    commentText.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final opts = ['FOLLOWERS', 'LIKES', 'VIEWS', 'COMMENTS'];
    final labels = {
      'FOLLOWERS': 'متابعين',
      'LIKES': 'لايكات',
      'VIEWS': 'مشاهدات',
      'COMMENTS': 'تعليقات',
    };
    final genders = {
      'ALL': 'الجميع',
      'MALE': 'ذكور فقط',
      'FEMALE': 'إناث فقط',
    };
    final selectedCountry = kCountries.where((item) => item.code == targetCountry).cast<CountryItem?>().firstOrNull;

    return Scaffold(
      appBar: AppBar(title: const Text('حملة جديدة')),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: Form(
              key: formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.red.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: AppColors.red.withValues(alpha: 0.18),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'استهداف الجمهور',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'حدد نوع الجمهور والدولة لضمان وصول الحملة للمستخدمين المؤهلين فقط.',
                          style: TextStyle(color: AppColors.textMuted, height: 1.5),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'نوع الحملة',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: opts.map((option) {
                      final selected = option == type;
                      return ChoiceChip(
                        label: Text(labels[option]!),
                        selected: selected,
                        onSelected: busy
                            ? null
                            : (_) {
                                setState(() {
                                  type = option;
                                  if (!isCommentCampaign) {
                                    commentText.clear();
                                  }
                                });
                                recalc();
                              },
                        selectedColor: AppColors.red,
                        labelStyle: TextStyle(
                          color: selected ? Colors.white : null,
                          fontWeight: FontWeight.w700,
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),
                  TextFormField(
                    controller: targetUrl,
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.link),
                      labelText: 'رابط TikTok',
                      hintText: 'رابط الحساب أو الفيديو',
                      helperText:
                          'يدعم vt.tiktok.com و vm.tiktok.com و m.tiktok.com و www.tiktok.com',
                    ),
                    validator: (value) {
                      if ((value ?? '').trim().length < 10) {
                        return 'أدخل رابط TikTok صالح';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: quantity,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => recalc(),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.numbers),
                      labelText: 'العدد المطلوب',
                      helperText:
                          'الحد المسموح: ${AppConfig.minCampaignQuantity} - ${AppConfig.maxCampaignQuantity}',
                    ),
                    validator: (value) {
                      final parsed = int.tryParse(value ?? '');
                      if (parsed == null) return 'أدخل رقماً صحيحاً';
                      if (parsed < AppConfig.minCampaignQuantity ||
                          parsed > AppConfig.maxCampaignQuantity) {
                        return 'العدد يجب أن يكون بين ${AppConfig.minCampaignQuantity} و ${AppConfig.maxCampaignQuantity}';
                      }
                      return null;
                    },
                  ),
                  if (isCommentCampaign) ...[
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: commentText,
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.chat_bubble_outline_rounded),
                        labelText: 'نص التعليق',
                        hintText: 'النص المطلوب من المنفذ',
                      ),
                      validator: (value) {
                        if (isCommentCampaign && (value ?? '').trim().isEmpty) {
                          return 'أدخل نص التعليق';
                        }
                        return null;
                      },
                    ),
                  ],
                  const SizedBox(height: 18),
                  const Text('استهداف النوع',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: genders.entries.map((entry) {
                      final selected = targetGender == entry.key;
                      return ChoiceChip(
                        label: Text(entry.value),
                        selected: selected,
                        onSelected: busy
                            ? null
                            : (_) => setState(() => targetGender = entry.key),
                        selectedColor: AppColors.blue,
                        labelStyle: TextStyle(
                          color: selected ? Colors.white : null,
                          fontWeight: FontWeight.w700,
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: busy
                              ? null
                              : () => setState(() => targetCountry = 'WORLDWIDE'),
                          icon: Icon(
                            Icons.public,
                            color: isWorldwide ? AppColors.blue : null,
                          ),
                          label: const Text('جميع الدول'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  CountryPickerField(
                    value: isWorldwide ? null : targetCountry,
                    label: 'دولة محددة (اختياري)',
                    hint: 'اختر دولة أو اتركها عالمية',
                    onChanged: (country) => setState(() => targetCountry = country.code),
                  ),
                  if (!isWorldwide && selectedCountry != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      'الاستهداف الحالي: ${selectedCountry.flag} ${selectedCountry.nameAr}',
                      style: const TextStyle(color: AppColors.textMuted),
                    ),
                  ],
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.red.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: AppColors.red.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.local_fire_department,
                                color: AppColors.red),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'التكلفة الإجمالية: $totalCost نقطة',
                                style: const TextStyle(
                                  color: AppColors.red,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'المكافأة لكل مهمة: ${AppConfig.rewardForCampaign(type)} نقطة',
                          style: const TextStyle(color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(error!,
                          style: const TextStyle(color: AppColors.red)),
                    ),
                  ElevatedButton.icon(
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
                        : const Icon(Icons.flash_on),
                    label: Text(busy ? 'جاري الإنشاء...' : 'بدء الحملة'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
