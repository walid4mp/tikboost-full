import 'package:flutter/material.dart';
import '../config/app_theme.dart';
import '../services/api_client.dart';

class PaymentHistoryScreen extends StatefulWidget {
  const PaymentHistoryScreen({super.key});
  @override State<PaymentHistoryScreen> createState() => _PaymentHistoryScreenState();
}

class _PaymentHistoryScreenState extends State<PaymentHistoryScreen> {
  List<dynamic> items = const [];
  bool loading = true;
  String? error;

  Future<void> load() async {
    setState(() { loading = true; error = null; });
    try {
      final r = await ApiClient.instance.dio.get('/user/purchases');
      if (!mounted) return;
      setState(() => items = List<dynamic>.from(r.data['items'] ?? const []));
    } catch (e) {
      if (mounted) setState(() => error = (e as dynamic).response?.data?['message'] ?? 'تعذر تحميل طلبات الدفع');
    } finally { if (mounted) setState(() => loading = false); }
  }

  String statusText(String status) => switch (status) {
    'APPROVED' => 'تمت الموافقة', 'REJECTED' => 'مرفوض', 'REFUNDED' => 'مسترجع', _ => 'قيد المراجعة'
  };
  Color statusColor(String status) => switch (status) {
    'APPROVED' => AppColors.success, 'REJECTED' => AppColors.red, 'REFUNDED' => Colors.orange, _ => AppColors.blue
  };

  @override void initState() { super.initState(); load(); }
  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('طلبات الدفع وحالتها')),
    body: RefreshIndicator(
      onRefresh: load,
      child: loading ? const Center(child: CircularProgressIndicator()) : error != null
        ? ListView(children: [const SizedBox(height: 160), Center(child: Text(error!))])
        : items.isEmpty ? ListView(children: const [SizedBox(height: 160), Center(child: Text('لا توجد طلبات دفع حتى الآن'))])
        : ListView.separated(padding: const EdgeInsets.all(16), itemCount: items.length, separatorBuilder: (_,__) => const SizedBox(height: 10), itemBuilder: (_,i) {
          final x = Map<String,dynamic>.from(items[i]); final status='${x['status'] ?? 'PENDING'}';
          final method=Map<String,dynamic>.from(x['paymentMethod'] ?? const {}); final price=(double.tryParse('${x['priceCents'] ?? 0}') ?? 0)/100;
          return Card(child: Padding(padding: const EdgeInsets.all(15), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(width: 44,height:44,decoration:BoxDecoration(color:statusColor(status).withValues(alpha:.12),borderRadius:BorderRadius.circular(12)),child:Icon(status=='APPROVED'?Icons.check_circle:status=='REJECTED'?Icons.cancel:Icons.hourglass_top,color:statusColor(status))),
              const SizedBox(width:10), Expanded(child: Text('${x['packageName'] ?? 'شراء'}',style:const TextStyle(fontWeight:FontWeight.w900))),
              Text(statusText(status),style:TextStyle(color:statusColor(status),fontWeight:FontWeight.w800)),
            ]),
            const SizedBox(height:10),
            Text('${method['label'] ?? x['method'] ?? '-'} • ${price.toStringAsFixed(2)} ${x['currency'] ?? ''}',style:const TextStyle(color:AppColors.textMuted)),
            if('${x['reference'] ?? ''}'.isNotEmpty) ...[const SizedBox(height:4),Text('رقم العملية: ${x['reference']}')],
            if('${x['reason'] ?? ''}'.trim().isNotEmpty) ...[const SizedBox(height:8),Container(width:double.infinity,padding:const EdgeInsets.all(10),decoration:BoxDecoration(color:AppColors.red.withValues(alpha:.08),borderRadius:BorderRadius.circular(10)),child:Text('سبب الرفض: ${x['reason']}',style:const TextStyle(color:AppColors.red)))],
            const SizedBox(height:6), Text('${x['createdAt'] ?? ''}',style:const TextStyle(fontSize:11,color:AppColors.textMuted)),
          ])));
        }),
    ),
  );
}
