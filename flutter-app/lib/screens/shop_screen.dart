import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config/app_theme.dart';
import '../services/api_client.dart';
import '../services/sound_service.dart';

Future<Map<String, dynamic>?> showOfferPaymentSheet({
  required BuildContext context,
  required String offerId,
  required String itemName,
  required int priceCents,
  required String currency,
}) async {
  try {
    final response = await ApiClient.instance.dio.get('/config/client');
    final config = Map<String, dynamic>.from(response.data['config'] ?? {});
    final payments = Map<String, dynamic>.from(config['payments'] ?? {});
    final methods = List<dynamic>.from(payments['methods'] ?? const [])
        .where((m) => m is Map && m['enabled'] != false)
        .toList();
    if (methods.isEmpty) throw Exception('لا توجد طرق دفع متاحة حالياً.');
    final result = await showModalBottomSheet<_PaymentData>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PaymentSheet(
        methods: methods,
        itemName: itemName,
        priceCents: priceCents,
        currency: currency,
      ),
    );
    if (result == null) return null;
    final payment = await ApiClient.instance.dio.post('/offers/$offerId/buy', data: {
      'method': result.method['key'],
      'transactionId': result.transactionId,
      'receiptImageData': result.receiptImageData,
    });
    return Map<String, dynamic>.from(payment.data as Map);
  } catch (e) {
    rethrow;
  }
}

class ShopScreen extends ConsumerStatefulWidget {
  const ShopScreen({super.key});
  @override
  ConsumerState<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends ConsumerState<ShopScreen> {
  List<dynamic> packages = [];
  List<dynamic> vipPlans = [];
  List<dynamic> paymentMethods = [];
  List<dynamic> offers = [];
  Map<String, dynamic> vip = {};
  bool loading = true;
  bool submitting = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final results = await Future.wait([
        ApiClient.instance.dio.get('/packages'),
        ApiClient.instance.dio.get('/vip/status'),
        ApiClient.instance.dio.get('/config/client'),
        ApiClient.instance.dio.get('/offers/personalized'),
      ]);
      final vipData = Map<String, dynamic>.from(results[1].data['vipPro'] ?? {});
      final config = Map<String, dynamic>.from(results[2].data['config'] ?? {});
      final payments = Map<String, dynamic>.from(config['payments'] ?? {});
      final offersData = List<dynamic>.from(results[3].data['offers'] ?? const []);
      if (!mounted) return;
      setState(() {
        packages = List<dynamic>.from(results[0].data['packages'] ?? const []);
        vip = vipData;
        vipPlans = List<dynamic>.from(vipData['plans'] ?? const []);
        paymentMethods = List<dynamic>.from(payments['methods'] ?? const [])
            .where((m) => m is Map && m['enabled'] != false)
            .toList();
        offers = offersData;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _startPayment({
    required String type,
    required String itemId,
    required String name,
    required int priceCents,
    required String currency,
    String? planKey,
  }) async {
    if (submitting) return;
    if (paymentMethods.isEmpty) {
      _message('لا توجد طرق دفع متاحة حالياً.', error: true);
      return;
    }

    final result = await showModalBottomSheet<_PaymentData>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PaymentSheet(
        methods: paymentMethods,
        itemName: name,
        priceCents: priceCents,
        currency: currency,
      ),
    );
    if (result == null) return;

    setState(() => submitting = true);
    try {
      final isPayPal = '${result.method['key'] ?? ''}'.toLowerCase() == 'paypal' || '${result.method['type'] ?? ''}'.toLowerCase() == 'paypal';
      dynamic response;
      if (type == 'package' && isPayPal) {
        // Real PayPal Checkout: no transaction ID or receipt is requested.
        response = await ApiClient.instance.dio.post('/payments/paypal/create', data: {'packageId': itemId});
        final approvalUrl = '${response.data['approvalUrl'] ?? ''}';
        final orderId = '${response.data['orderId'] ?? ''}';
        if (approvalUrl.isEmpty || orderId.isEmpty) throw Exception('تعذر فتح صفحة PayPal.');
        final opened = await launchUrl(Uri.parse(approvalUrl), mode: LaunchMode.externalApplication);
        if (!opened) throw Exception('تعذر فتح PayPal.');
        if (!mounted) return;
        final confirm = await showDialog<bool>(
          context: context,
          barrierDismissible: false,
          builder: (_) => AlertDialog(
            title: const Text('إتمام الدفع'),
            content: const Text('أكمل الدفع في PayPal باستخدام PayPal أو البطاقة البنكية إذا ظهر خيار البطاقة، ثم ارجع إلى التطبيق واضغط «لقد دفعت». لا تغلق الطلب قبل التأكيد.'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
              FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('لقد دفعت')),
            ],
          ),
        );
        if (confirm != true) return;
        response = await ApiClient.instance.dio.post('/payments/paypal/capture', data: {'orderId': orderId});
        if (!mounted) return;
        await SoundService.instance.playTap();
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => _PaymentSuccessPage(
          title: 'تم الدفع بنجاح',
          reference: '${response.data['purchaseId'] ?? ''}',
          message: 'تم تأكيد الدفع عبر PayPal وإضافة الرصيد إلى حسابك.',
        )));
        return;
      }

      Map<String, dynamic> body = {
        'method': result.method['key'],
        'transactionId': result.transactionId,
        'receiptImageData': result.receiptImageData,
      };

      if (type == 'package') {
        body['packageId'] = itemId;
        response = await ApiClient.instance.dio.post('/packages/buy', data: body);
      } else {
        body['planKey'] = planKey ?? itemId;
        response = await ApiClient.instance.dio.post('/vip/subscribe', data: body);
      }

      if (!mounted) return;
      await SoundService.instance.playTap();
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => _PaymentSuccessPage(
            title: type == 'vip' ? 'تم إرسال طلب VIP' : 'تم إرسال طلب الشحن',
            reference: '${response.data['purchase']?['id'] ?? response.data['subscription']?['id'] ?? ''}',
            message: response.data['instructions'] ?? 'سيتم مراجعة إثبات الدفع وتحديث حسابك بعد الموافقة.',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      _message(userFriendlyApiError(e, fallback: 'تعذر إرسال طلب الدفع.'), error: true);
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  void _message(String text, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(text), backgroundColor: error ? AppColors.redDeep : AppColors.success),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    final plans = vipPlans;
    return Scaffold(
      appBar: AppBar(
        title: const Text('المتجر'),
        centerTitle: true,
        actions: [
          IconButton(onPressed: load, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 30),
          children: [
            _hero(),
            if (offers.isNotEmpty) ...[
              const SizedBox(height: 18),
              _sectionTitle('🎁 عروض خاصة لك', '${offers.length} عروض'),
              const SizedBox(height: 10),
              ...offers.map((item) => _offerCard(Map<String, dynamic>.from(item))),
            ],
            const SizedBox(height: 18),
            if (plans.isNotEmpty) ...[
              _sectionTitle('👑 VIP PRO', '${plans.length} باقات'),
              const SizedBox(height: 10),
              ...plans.asMap().entries.map((e) => _vipCard(Map<String, dynamic>.from(e.value), e.key)),
              const SizedBox(height: 18),
            ],
            _sectionTitle('💎 باقات النقاط', '${packages.length} باقات'),
            const SizedBox(height: 10),
            if (packages.isEmpty)
              const _EmptyShop()
            else
              ...packages.asMap().entries.map((e) => _packageCard(Map<String, dynamic>.from(e.value), e.key)),
            const SizedBox(height: 16),
            _securityNote(),
          ],
        ),
      ),
    );
  }

  Widget _hero() => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      gradient: AppColors.aurora,
      borderRadius: BorderRadius.circular(28),
      boxShadow: const [BoxShadow(color: Color(0x331F8FFF), blurRadius: 24, offset: Offset(0, 10))],
    ),
    child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(Icons.account_balance_wallet_rounded, color: Colors.white, size: 34),
      SizedBox(height: 14),
      Text('شحن حسابك', style: TextStyle(color: Colors.white, fontSize: 25, fontWeight: FontWeight.w900)),
      SizedBox(height: 5),
      Text('اختر باقة VIP أو نقاط، ثم ادفع وأرسل رقم المعاملة وصورة الإثبات.', style: TextStyle(color: Colors.white70, fontSize: 12)),
    ]),
  );

  Widget _sectionTitle(String title, String count) => Row(children: [
    Expanded(child: Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900))),
    Text(count, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
  ]);

  Widget _offerCard(Map<String, dynamic> offer) {
    final cents = (offer['newPriceCents'] as num?)?.toInt() ?? 0;
    final old = (offer['oldPriceCents'] as num?)?.toInt() ?? 0;
    final currency = '${offer['currency'] ?? 'USD'}';
    final discount = offer['discountPct'];
    return Container(
      margin: const EdgeInsets.only(bottom: 11),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [AppColors.purple.withValues(alpha: .16), AppColors.card]),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.purple.withValues(alpha: .55)),
      ),
      child: Row(children: [
        Container(width: 52, height: 52, decoration: BoxDecoration(color: AppColors.purple.withValues(alpha: .14), borderRadius: BorderRadius.circular(16)), child: const Icon(Icons.local_offer_rounded, color: AppColors.purple)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${offer['title'] ?? 'عرض خاص'}', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
          if ('${offer['description'] ?? ''}'.isNotEmpty) ...[const SizedBox(height: 3), Text('${offer['description']}', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textMuted, fontSize: 10))],
          const SizedBox(height: 6),
          Row(children: [
            if (old > 0) Text('${(old / 100).toStringAsFixed(2)} $currency', style: const TextStyle(color: AppColors.textMuted, decoration: TextDecoration.lineThrough, fontSize: 10)),
            if (old > 0) const SizedBox(width: 6),
            Text('${(cents / 100).toStringAsFixed(2)} $currency', style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w900)),
            if (discount != null) ...[const SizedBox(width: 6), _Tag(text: '-$discount%')],
          ]),
        ])),
        const SizedBox(width: 8),
        FilledButton(
          onPressed: submitting ? null : () async {
            try {
              final result = await showOfferPaymentSheet(context: context, offerId: '${offer['id']}', itemName: '${offer['title'] ?? 'عرض خاص'}', priceCents: cents, currency: currency);
              if (mounted && result != null) _message(result['instructions'] ?? 'تم إرسال طلب العرض للمراجعة.');
            } catch (e) {
              if (mounted) _message(userFriendlyApiError(e, fallback: 'تعذر إرسال طلب العرض.'), error: true);
            }
          },
          child: const Text('شراء'),
        ),
      ]),
    );
  }

  Widget _vipCard(Map<String, dynamic> plan, int index) {
    final key = '${plan['key'] ?? 'vip_$index'}';
    final name = '${plan['name'] ?? 'VIP PRO'}';
    final cents = (plan['priceCents'] as num?)?.toInt() ?? 0;
    final days = (plan['durationDays'] as num?)?.toInt() ?? 30;
    final bonus = (plan['bonusPerTask'] as num?)?.toInt() ?? 0;
    final popular = key == 'vip_pro';
    return Container(
      margin: const EdgeInsets.only(bottom: 11),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: popular ? AppColors.purple : AppColors.border, width: popular ? 1.5 : 1),
      ),
      child: Row(children: [
        Container(
          width: 52, height: 52,
          decoration: BoxDecoration(color: AppColors.purple.withValues(alpha: .14), borderRadius: BorderRadius.circular(16)),
          child: const Icon(Icons.workspace_premium_rounded, color: AppColors.purple),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text(name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
            if (popular) ...[const SizedBox(width: 7), const _Tag(text: 'الأكثر طلباً')],
          ]),
          const SizedBox(height: 4),
          Text('$days يوم • +$bonus% نقاط لكل مهمة', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          const SizedBox(height: 8),
          Text('${(cents / 100).toStringAsFixed(2)} ${plan['currency'] ?? 'USD'}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        ])),
        FilledButton(
          onPressed: submitting ? null : () => _startPayment(
            type: 'vip', itemId: key, planKey: key, name: name,
            priceCents: cents, currency: '${plan['currency'] ?? 'USD'}',
          ),
          child: const Text('اشترك'),
        ),
      ]),
    );
  }

  Widget _packageCard(Map<String, dynamic> pkg, int index) {
    final points = BigInt.tryParse('${pkg['points'] ?? 0}') ?? BigInt.zero;
    final bonus = BigInt.tryParse('${pkg['bonusPoints'] ?? 0}') ?? BigInt.zero;
    final total = points + bonus;
    final cents = (pkg['priceCents'] as num?)?.toInt() ?? 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 11),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(children: [
        Container(
          width: 52, height: 52,
          decoration: BoxDecoration(color: AppColors.blue.withValues(alpha: .12), borderRadius: BorderRadius.circular(16)),
          child: const Icon(Icons.diamond_rounded, color: AppColors.blue),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${pkg['name'] ?? 'باقة'}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          const SizedBox(height: 3),
          Text('${total.toString()} نقطة', style: const TextStyle(color: AppColors.blue, fontWeight: FontWeight.w800)),
          const SizedBox(height: 5),
          Text('${(cents / 100).toStringAsFixed(2)} ${pkg['currency'] ?? 'USD'}', style: const TextStyle(fontWeight: FontWeight.w900)),
        ])),
        FilledButton(
          onPressed: submitting ? null : () => _startPayment(
            type: 'package', itemId: '${pkg['id']}', name: '${pkg['name'] ?? 'باقة'}',
            priceCents: cents, currency: '${pkg['currency'] ?? 'USD'}',
          ),
          child: const Text('شحن'),
        ),
      ]),
    );
  }

  Widget _securityNote() => Container(
    padding: const EdgeInsets.all(15),
    decoration: BoxDecoration(
      color: AppColors.blue.withValues(alpha: .06),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: AppColors.border),
    ),
    child: const Row(children: [
      Icon(Icons.verified_user_rounded, color: AppColors.success),
      SizedBox(width: 10),
      Expanded(child: Text('لن تتم إضافة النقاط أو تفعيل VIP إلا بعد مراجعة إثبات الدفع والموافقة عليه من الإدارة.', style: TextStyle(color: AppColors.textMuted, fontSize: 12))),
    ]),
  );
}

class _PaymentLogo extends StatelessWidget {
  final Map<String, dynamic> method;
  const _PaymentLogo({required this.method});

  @override
  Widget build(BuildContext context) {
    final key = '${method['logoKey'] ?? method['key'] ?? ''}'.trim();
    final path = key.isEmpty ? '' : 'assets/payment_logos/$key.png';
    if (path.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Image.asset(path, width: 54, height: 54, fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _fallback()),
      );
    }
    return _fallback();
  }

  Widget _fallback() => Container(
    width: 54, height: 54,
    decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12)),
    alignment: Alignment.center,
    child: Text('${method['icon'] ?? '💳'}', style: const TextStyle(fontSize: 22)),
  );
}

class _PaymentData {
  final Map<String, dynamic> method;
  final String? transactionId;
  final String? receiptImageData;
  _PaymentData({required this.method, this.transactionId, this.receiptImageData});
}

class _PaymentSheet extends StatefulWidget {
  final List<dynamic> methods;
  final String itemName;
  final int priceCents;
  final String currency;
  const _PaymentSheet({required this.methods, required this.itemName, required this.priceCents, required this.currency});
  @override State<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends State<_PaymentSheet> {
  int selected = 0;
  final tx = TextEditingController();
  String? receipt;
  String? receiptName;
  bool picking = false;

  Future<void> pickReceipt() async {
    setState(() => picking = true);
    try {
      final file = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 70, maxWidth: 1600, maxHeight: 1600);
      if (file == null) return;
      final bytes = await file.readAsBytes();
      if (bytes.length > 1400000) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('الصورة كبيرة. اختر صورة أصغر من 1.4MB.')));
        return;
      }
      final ext = file.name.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
      receipt = 'data:image/$ext;base64,${base64Encode(bytes)}';
      receiptName = file.name;
      if (mounted) setState(() {});
    } finally {
      if (mounted) setState(() => picking = false);
    }
  }

  @override
  void dispose() { tx.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final method = Map<String, dynamic>.from(widget.methods[selected]);
    final isPayPal = '${method['key'] ?? ''}'.toLowerCase() == 'paypal' || '${method['type'] ?? ''}'.toLowerCase() == 'paypal';
    final price = (widget.priceCents / 100).toStringAsFixed(2);
    return SafeArea(
      child: Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * .92),
        decoration: const BoxDecoration(color: AppColors.dark, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
        padding: EdgeInsets.only(left: 16, right: 16, top: 10, bottom: MediaQuery.viewInsetsOf(context).bottom + 16),
        child: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Center(child: Container(width: 44, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(10)))),
            const SizedBox(height: 15),
            const Text('إيداع / شحن', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
            Text(widget.itemName, style: const TextStyle(color: AppColors.textMuted)),
            const SizedBox(height: 8),
            Text('$price ${widget.currency}', style: const TextStyle(fontSize: 20, color: AppColors.success, fontWeight: FontWeight.w900)),
            const SizedBox(height: 16),
            const Text('اختر طريقة الدفع', style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 9),
            SizedBox(
              height: 86,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: widget.methods.length,
                separatorBuilder: (_, __) => const SizedBox(width: 9),
                itemBuilder: (_, i) {
                  final m = Map<String, dynamic>.from(widget.methods[i]);
                  final active = i == selected;
                  return InkWell(
                    onTap: () => setState(() => selected = i),
                    borderRadius: BorderRadius.circular(16),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      width: 125,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: active ? AppColors.red.withValues(alpha: .12) : AppColors.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: active ? AppColors.red : AppColors.border, width: active ? 1.4 : 1),
                      ),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Expanded(
                          child: _PaymentLogo(method: m),
                        ),
                        const SizedBox(height: 3),
                        Text('${m['label'] ?? m['key']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11)),
                      ]),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 14),
            if (!isPayPal) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${method['instructions'] ?? 'حوّل المبلغ إلى العنوان التالي.'}', style: const TextStyle(fontSize: 12, height: 1.5)),
                  if ('${method['walletAddress'] ?? ''}'.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(child: SelectableText('${method['walletAddress']}', style: const TextStyle(color: AppColors.blue, fontWeight: FontWeight.w900))),
                      IconButton(onPressed: () => Clipboard.setData(ClipboardData(text: '${method['walletAddress']}')), icon: const Icon(Icons.copy_rounded, size: 19)),
                    ]),
                  ],
                ]),
              ),
              const SizedBox(height: 14),
            ],
            if (isPayPal) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
                child: const Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(Icons.credit_card_rounded, color: AppColors.blue),
                  SizedBox(width: 10),
                  Expanded(child: Text('سيتم فتح PayPal Checkout. يمكنك الدفع بحساب PayPal أو بالبطاقة Visa/Mastercard إذا كان خيار البطاقات متاحًا لحساب التاجر.', style: TextStyle(fontSize: 13, height: 1.5))),
                ]),
              ),
            ] else ...[
              TextField(controller: tx, decoration: const InputDecoration(labelText: 'رقم المعاملة / Transaction ID', prefixIcon: Icon(Icons.receipt_long_rounded))),
              const SizedBox(height: 12),
              InkWell(
                onTap: picking ? null : pickReceipt,
                borderRadius: BorderRadius.circular(18),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(18), border: Border.all(color: receipt == null ? AppColors.border : AppColors.success)),
                  child: Row(children: [
                    Icon(receipt == null ? Icons.add_photo_alternate_rounded : Icons.check_circle_rounded, color: receipt == null ? AppColors.blue : AppColors.success),
                    const SizedBox(width: 10),
                    Expanded(child: Text(receiptName ?? 'إرفاق صورة إثبات الدفع', style: const TextStyle(fontWeight: FontWeight.w800))),
                    if (picking) const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                  ]),
                ),
              ),
            ],
            const SizedBox(height: 15),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: isPayPal
                    ? () => Navigator.pop(context, _PaymentData(method: method))
                    : (tx.text.trim().isEmpty || receipt == null ? null : () => Navigator.pop(context, _PaymentData(method: method, transactionId: tx.text.trim(), receiptImageData: receipt!))),
                icon: Icon(isPayPal ? Icons.account_balance_wallet_rounded : Icons.lock_rounded),
                label: Text(isPayPal ? 'الدفع عبر PayPal / البطاقة' : 'إرسال طلب الدفع'),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

class _PaymentSuccessPage extends StatelessWidget {
  final String title, reference, message;
  const _PaymentSuccessPage({required this.title, required this.reference, required this.message});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('حالة الطلب')),
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 82),
          const SizedBox(height: 18),
          Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
          const SizedBox(height: 10),
          Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textMuted, height: 1.5)),
          if (reference.isNotEmpty) ...[
            const SizedBox(height: 14),
            SelectableText('رقم الطلب: $reference', style: const TextStyle(color: AppColors.blue, fontWeight: FontWeight.w800)),
          ],
          const SizedBox(height: 24),
          FilledButton(onPressed: () => Navigator.pop(context), child: const Text('العودة للمتجر')),
        ]),
      ),
    ),
  );
}

class _Tag extends StatelessWidget {
  final String text;
  const _Tag({required this.text});
  @override Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
    decoration: BoxDecoration(color: AppColors.purple.withValues(alpha: .14), borderRadius: BorderRadius.circular(8)),
    child: Text(text, style: const TextStyle(color: AppColors.purple, fontSize: 9, fontWeight: FontWeight.w900)),
  );
}

class _EmptyShop extends StatelessWidget {
  const _EmptyShop();
  @override Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(30),
    decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(20)),
    child: const Center(child: Text('لا توجد باقات متاحة حالياً', style: TextStyle(color: AppColors.textMuted))),
  );
}
