import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../config/app_theme.dart';
import '../services/api_client.dart';

class CreateCampaignScreen extends ConsumerStatefulWidget {
  const CreateCampaignScreen({super.key});

  @override
  ConsumerState<CreateCampaignScreen> createState() =>
      _CreateCampaignScreenState();
}

class _CreateCampaignScreenState extends ConsumerState<CreateCampaignScreen> {
  String type = 'FOLLOWERS';
  final targetUrl = TextEditingController();
  final quantity = TextEditingController(text: '100');
  final commentText = TextEditingController();
  String? error;
  bool busy = false;
  int totalCost = 0;

  static const priceByType = {
    'FOLLOWERS': 100,
    'LIKES': 20,
    'VIEWS': 5,
    'COMMENTS': 50,
  };

  bool get isCommentCampaign => type == 'COMMENTS';

  void recalc() {
    final q = int.tryParse(quantity.text) ?? 0;
    setState(() => totalCost = q * (priceByType[type] ?? 100));
  }

  Future<void> submit() async {
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

    return Scaffold(
      appBar: AppBar(title: const Text('حملة جديدة')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'نوع الحملة',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: opts.map((option) {
                final selected = option == type;
                return ChoiceChip(
                  label: Text(labels[option]!),
                  selected: selected,
                  onSelected: (_) {
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
            TextField(
              controller: targetUrl,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.link),
                hintText: 'رابط TikTok للحساب أو الفيديو',
                helperText:
                    'يدعم vt.tiktok.com و vm.tiktok.com و m.tiktok.com و www.tiktok.com',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: quantity,
              keyboardType: TextInputType.number,
              onChanged: (_) => recalc(),
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.numbers),
                hintText: 'العدد المطلوب',
              ),
            ),
            if (isCommentCampaign) ...[
              const SizedBox(height: 12),
              TextField(
                controller: commentText,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.chat_bubble_outline_rounded),
                  hintText: 'نص التعليق المطلوب من المنفذ',
                ),
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
              child: Row(
                children: [
                  const Icon(
                    Icons.local_fire_department,
                    color: AppColors.red,
                  ),
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
            ),
            const SizedBox(height: 16),
            if (error != null)
              Text(error!, style: const TextStyle(color: AppColors.red)),
            const SizedBox(height: 6),
            ElevatedButton.icon(
              onPressed: busy ? null : submit,
              icon: const Icon(Icons.flash_on),
              label: Text(busy ? 'جاري الإنشاء...' : 'بدء الحملة'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
