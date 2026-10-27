import 'dart:async';
import 'dart:convert';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
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
  StreamSubscription<List<PurchaseDetails>>? _purchaseSubscription;
  final InAppPurchase _billing = InAppPurchase.instance;
  final Map<String, Map<String, dynamic>> _billingPackages = {};
  final Map<String, Map<String, dynamic>> _billingVipPlans = {};

  @override
  void initState() {
    super.initState();
    _purchaseSubscription = _billing.purchaseStream.listen(
      _handlePurchaseUpdates,
      onError: (Object error) { if (mounted) _message('تعذر إكمال عملية الشراء من Google Play.', error: true); },
    );
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


  Future<void> _buyGooglePlay(Map<String, dynamic> pkg) async {
    if (submitting) return;
    final productId = '${pkg['slug'] ?? ''}'.trim();
    if (productId.isEmpty) {
      _message('هذه الباقة لا تحتوي على معرّف منتج Google Play. اضبط slug ليطابق معرّف المنتج في Play Console.', error: true);
      return;
    }
    setState(() => submitting = true);
    try {
      final available = await _billing.isAvailable();
      if (!available) throw Exception('Google Play Billing غير متاح. تأكد أنك تستخدم نسخة اختبار مثبتة من Google Play.');
      final response = await _billing.queryProductDetails({productId});
      if (response.error != null) throw Exception(response.error!.message);
      if (response.productDetails.isEmpty) {
        throw Exception('لم يُعثر على المنتج $productId في Google Play. أنشئ المنتج بنفس المعرّف وانشره في مسار اختبار.');
      }
      _billingPackages[productId] = pkg;
      final product = response.productDetails.first;
      final started = await _billing.buyConsumable(
        purchaseParam: PurchaseParam(productDetails: product, applicationUserName: '${pkg['id']}'),
        autoConsume: false,
      );
      if (!started) throw Exception('لم يبدأ Google Play عملية الشراء.');
    } catch (e) {
      if (mounted) _message(e.toString().replaceFirst('Exception: ', ''), error: true);
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  Future<void> _handlePurchaseUpdates(List<PurchaseDetails> updates) async {
    for (final purchase in updates) {
      var shouldComplete = purchase.status == PurchaseStatus.error || purchase.status == PurchaseStatus.canceled;
      if (purchase.status == PurchaseStatus.pending) {
        if (mounted) _message('جارٍ تأكيد عملية الشراء عبر Google Play...');
        continue;
      }
      if (purchase.status == PurchaseStatus.error) {
        if (mounted) _message(purchase.error?.message ?? 'فشلت عملية الشراء.', error: true);
      } else if (purchase.status == PurchaseStatus.purchased || purchase.status == PurchaseStatus.restored) {
        final vipPlan = _billingVipPlans[purchase.productID];
        Map<String, dynamic>? pkg = _billingPackages[purchase.productID];
        if (pkg == null && vipPlan == null) {
          for (final item in packages) {
            if (item is Map && '${item['slug']}' == purchase.productID) { pkg = Map<String, dynamic>.from(item); break; }
          }
        }
        if (pkg == null && vipPlan == null) {
          if (mounted) _message('تم استلام الشراء لكن تعذر مطابقة المنتج. لا تشترِ مرة أخرى؛ تواصل مع الدعم.', error: true);
        } else {
          try {
            final token = purchase.verificationData.serverVerificationData;
            if (token.isEmpty) throw Exception('لم يرسل Google Play رمز تحقق للشراء.');
            if (vipPlan != null) {
              await ApiClient.instance.dio.post('/vip/google-play/verify', data: {
                'planKey': vipPlan['key'], 'productId': purchase.productID, 'purchaseToken': token,
              });
            } else {
              await ApiClient.instance.dio.post('/packages/google-play/verify', data: {
                'packageId': pkg!['id'], 'productId': purchase.productID, 'purchaseToken': token,
              });
            }
            shouldComplete = true;
            if (mounted) { _message(vipPlan != null ? 'تم التحقق من اشتراك VIP وتفعيله.' : 'تم التحقق من الشراء وإضافة النقاط إلى حسابك.'); await load(); }
          } catch (e) {
            if (mounted) _message(userFriendlyApiError(e, fallback: 'لم يؤكد الخادم عملية الشراء. لا تُعد الشراء؛ حاول المزامنة أو تواصل مع الدعم.'), error: true);
          }
        }
      }
      // Do not acknowledge/complete a purchased transaction if server verification failed.
      // Keep it retryable rather than risking a paid but uncredited purchase.
      if (purchase.pendingCompletePurchase && shouldComplete) {
        await _billing.completePurchase(purchase);
      }
    }
  }

  Future<void> _buyVipGooglePlay(Map<String, dynamic> plan) async {
    if (submitting) return;
    final productId = '${plan['productId'] ?? plan['key'] ?? ''}'.trim();
    if (productId.isEmpty) { _message('أضف معرّف منتج Google Play لهذه الخطة.', error: true); return; }
    setState(() => submitting = true);
    try {
      if (!await _billing.isAvailable()) throw Exception('Google Play Billing غير متاح. ثبّت نسخة الاختبار من Google Play.');
      final response = await _billing.queryProductDetails({productId});
      if (response.error != null) throw Exception(response.error!.message);
      if (response.productDetails.isEmpty) throw Exception('لم يُعثر على اشتراك $productId. أنشئه كاشتراك في Play Console وبنفس المعرّف، ثم انشره في مسار اختبار.');
      _billingVipPlans[productId] = plan;
      final started = await _billing.buyNonConsumable(
        purchaseParam: PurchaseParam(productDetails: response.productDetails.first, applicationUserName: '${plan['key']}'),
      );
      if (!started) throw Exception('لم تبدأ نافذة شراء Google Play.');
    } catch (e) {
      if (mounted) _message(e.toString().replaceFirst('Exception: ', ''), error: true);
    } finally { if (mounted) setState(() => submitting = false); }
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
      Map<String, dynamic> body = {
        'method': result.method['key'],
        'transactionId': result.transactionId,
        'receiptImageData': result.receiptImageData,
      };

      dynamic response;
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
  void dispose() {
    _purchaseSubscription?.cancel();
    super.dispose();
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
      Text('اشترِ النقاط عبر Google Play، أو استخدم طرق الدفع الأخرى المتاحة.', style: TextStyle(color: Colors.white70, fontSize: 12)),
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

  void _showVipDetails(Map<String, dynamic> plan) {
    final name = '${plan['name'] ?? 'VIP PRO'}';
    final days = (plan['durationDays'] as num?)?.toInt() ?? 30;
    final bonus = (plan['bonusPerTask'] as num?)?.toInt() ?? 0;
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Row(children: [
          const Icon(Icons.workspace_premium_rounded, color: AppColors.purple),
          const SizedBox(width: 8),
          Expanded(child: Text(name, style: const TextStyle(fontWeight: FontWeight.w900))),
        ]),
        content: SingleChildScrollView(child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('مدة الاشتراك: $days يوم'),
            const SizedBox(height: 12),
            const Text('مميزات VIP', style: TextStyle(fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            _vipFeature(Icons.people_alt_rounded, 'استهداف الحملات حسب الجنس'),
            _vipFeature(Icons.public_rounded, 'اختيار الدولة المستهدفة أو جميع الدول'),
            _vipFeature(Icons.bolt_rounded, 'أولوية ظهور حملات VIP'),
            _vipFeature(Icons.stars_rounded, 'مكافأة إضافية: $bonus نقطة لكل مهمة وفق إعدادات الخادم'),
            _vipFeature(Icons.workspace_premium_rounded, 'شارة VIP أثناء فترة الاشتراك الفعّالة'),
            const SizedBox(height: 8),
            const Text('تُطبّق المميزات وفق إعدادات الحساب والخادم، وقد تختلف حسب الباقة.', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
          ],
        )),
        actions: [TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('إغلاق'))],
      ),
    );
  }

  Widget _vipFeature(IconData icon, String text) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, size: 19, color: AppColors.purple),
      const SizedBox(width: 9),
      Expanded(child: Text(text, style: const TextStyle(height: 1.3))),
    ]),
  );

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
        IconButton(
          tooltip: 'عرض مميزات VIP',
          onPressed: () => _showVipDetails(plan),
          icon: const Icon(Icons.info_outline_rounded, color: AppColors.purple),
        ),
        FilledButton(
          onPressed: submitting ? null : () => _buyVipGooglePlay(plan),
          child: const Text('اشترك عبر Google Play'),
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
        Column(mainAxisSize: MainAxisSize.min, children: [
          FilledButton.icon(
            onPressed: submitting ? null : () => _buyGooglePlay(pkg),
            icon: const Icon(Icons.shop_rounded, size: 17),
            label: const Text('Google Play'),
          ),
          TextButton(
            onPressed: submitting ? null : () => _startPayment(
              type: 'package', itemId: '${pkg['id']}', name: '${pkg['name'] ?? 'باقة'}',
              priceCents: cents, currency: '${pkg['currency'] ?? 'USD'}',
            ),
            child: const Text('طرق أخرى'),
          ),
        ]),
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
      Expanded(child: Text('عمليات Google Play تُتحقق من الخادم قبل إضافة النقاط. طرق الدفع اليدوية تبقى معلّقة حتى مراجعتها من الإدارة.', style: TextStyle(color: AppColors.textMuted, fontSize: 12))),
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
  final String transactionId;
  final String receiptImageData;
  _PaymentData({required this.method, required this.transactionId, required this.receiptImageData});
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
            TextField(controller: tx, decoration: const InputDecoration(labelText: 'رقم المعاملة / Transaction ID', prefixIcon: Icon(Icons.receipt_long_rounded))),
            const SizedBox(height: 12),
            InkWell(
              onTap: picking ? null : pickReceipt,
              borderRadius: BorderRadius.circular(18),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: receipt == null ? AppColors.border : AppColors.success),
                ),
                child: Row(children: [
                  Icon(receipt == null ? Icons.add_photo_alternate_rounded : Icons.check_circle_rounded, color: receipt == null ? AppColors.blue : AppColors.success),
                  const SizedBox(width: 10),
                  Expanded(child: Text(receiptName ?? 'إرفاق صورة إثبات الدفع', style: const TextStyle(fontWeight: FontWeight.w800))),
                  if (picking) const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                ]),
              ),
            ),
            const SizedBox(height: 15),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: tx.text.trim().isEmpty || receipt == null
                    ? null
                    : () => Navigator.pop(context, _PaymentData(method: method, transactionId: tx.text.trim(), receiptImageData: receipt!)),
                icon: const Icon(Icons.lock_rounded),
                label: const Text('إرسال طلب الدفع'),
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
