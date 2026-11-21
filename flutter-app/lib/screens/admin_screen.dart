import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_theme.dart';
import '../i18n/tr_text.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';
import '../services/sound_service.dart';

const _adminRoles = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'FINANCE'];

/// Full in-app admin console. It talks to the same secured `/admin/*` API as
/// the web panel, so every action is permission-checked and logged by the
/// server. Hidden from non-admin accounts.
class AdminScreen extends ConsumerStatefulWidget {
  const AdminScreen({super.key});

  @override
  ConsumerState<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends ConsumerState<AdminScreen> {
  Dio get _dio => ApiClient.instance.dio;

  String errText(Object e) {
    if (e is DioException) {
      final d = e.response?.data;
      if (d is Map && '${d['message'] ?? ''}'.isNotEmpty) return '${d['message']}';
      if (e.response?.statusCode == 403) return 'ليس لديك صلاحية لهذا الإجراء.';
    }
    return 'حدث خطأ، حاول مرة أخرى.';
  }

  void toast(String msg, {bool error = false}) {
    if (!mounted) return;
    if (error) SoundService.instance.playError();
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(backgroundColor: error ? AppColors.red : AppColors.success, content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).state.user;
    if (user == null || !_adminRoles.contains(user.role)) {
      return Scaffold(
        appBar: AppBar(title: const Text('لوحة الإدارة')),
        body: const Center(child: Text('هذه الصفحة للمشرفين فقط.')),
      );
    }
    return DefaultTabController(
      length: 7,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('لوحة الإدارة'),
          bottom: TabBar(isScrollable: true, tabAlignment: TabAlignment.start, tabs: [
            Tab(text: tr('الإحصائيات')),
            Tab(text: tr('المستخدمون')),
            Tab(text: tr('المدفوعات')),
            Tab(text: tr('عجلة الحظ')),
            Tab(text: tr('إشعار جماعي')),
            Tab(text: tr('الإعدادات')),
            Tab(text: tr('السجل')),
          ]),
        ),
        body: TabBarView(children: [
          _StatsTab(host: this),
          _UsersTab(host: this),
          _PaymentsTab(host: this),
          _WheelTab(host: this),
          _BroadcastTab(host: this),
          _SettingsTab(host: this),
          _LogsTab(host: this),
        ]),
      ),
    );
  }
}

// ------------------------------------------------------------------ helpers
Future<String?> _askText(BuildContext context, String title, {String hint = '', bool number = false, String initial = ''}) {
  final c = TextEditingController(text: initial);
  return showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: TextField(controller: c, autofocus: true, keyboardType: number ? const TextInputType.numberWithOptions(signed: true) : TextInputType.text, decoration: InputDecoration(hintText: tr(hint))),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
        FilledButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: const Text('تم')),
      ],
    ),
  );
}

Future<bool> _confirm(BuildContext context, String message) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('تأكيد')),
      ],
    ),
  );
  return r == true;
}

class _Card extends StatelessWidget {
  final Widget child;
  const _Card({required this.child});
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
        child: child,
      );
}

Widget _err(String msg, VoidCallback retry) => Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Padding(padding: const EdgeInsets.all(20), child: Text(msg, textAlign: TextAlign.center)),
        OutlinedButton(onPressed: retry, child: const Text('إعادة المحاولة')),
      ]),
    );

// -------------------------------------------------------------------- stats
class _StatsTab extends StatefulWidget {
  final _AdminScreenState host;
  const _StatsTab({required this.host});
  @override
  State<_StatsTab> createState() => _StatsTabState();
}

class _StatsTabState extends State<_StatsTab> with AutomaticKeepAliveClientMixin {
  Map<String, dynamic>? stats;
  List<dynamic> top = const [];
  String? error;
  bool loading = true;
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { loading = true; error = null; });
    try {
      final r = await widget.host._dio.get('/admin/stats');
      stats = Map<String, dynamic>.from(r.data['stats'] as Map);
      try {
        final t = await widget.host._dio.get('/admin/stats/top-users');
        top = List<dynamic>.from(t.data['items'] ?? const []);
      } catch (_) {}
    } catch (e) {
      error = widget.host.errText(e);
    }
    if (mounted) setState(() => loading = false);
  }

  Widget _tile(String label, String value, IconData icon, Color color) => Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, color: color),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
          Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error != null || stats == null) return _err(error ?? '', _load);
    final s = stats!;
    final p = Map<String, dynamic>.from(s['purchases'] ?? const {});
    final a = Map<String, dynamic>.from(s['activeUsers'] ?? const {});
    final pts = Map<String, dynamic>.from(s['points'] ?? const {});
    final revenue = ((int.tryParse('${s['revenueCents'] ?? 0}') ?? 0) / 100).toStringAsFixed(2);
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.all(14), children: [
        GridView.count(
          crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 1.45,
          children: [
            _tile(tr('المستخدمون'), '${s['users']}', Icons.people_alt_rounded, AppColors.blue),
            _tile(tr('نشطون اليوم'), '${a['day']}', Icons.bolt_rounded, AppColors.success),
            _tile(tr('نشطون 7 أيام'), '${a['days7']}', Icons.calendar_view_week_rounded, AppColors.purple),
            _tile(tr('مستخدمون جدد'), '${s['newUsersPeriod']}', Icons.person_add_alt_1_rounded, Colors.orange),
            _tile(tr('حملات'), '${s['campaigns']}', Icons.campaign_rounded, AppColors.red),
            _tile(tr('مهام منجزة'), '${s['tasksDone']}', Icons.task_alt_rounded, AppColors.success),
            _tile(tr('طلبات معلّقة'), '${p['pending']}', Icons.hourglass_top_rounded, AppColors.warning),
            _tile(tr('الإيرادات'), '\$$revenue', Icons.payments_rounded, AppColors.success),
          ],
        ),
        const SizedBox(height: 12),
        _Card(child: Text('${tr('نقاط متداولة')}: ${pts['inCirculation']}   •   ${tr('إجمالي الأرباح')}: ${pts['totalEarned']}', style: const TextStyle(color: AppColors.textMuted, height: 1.6))),
        if (top.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(tr('أفضل المستخدمين'), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
          const SizedBox(height: 8),
          ...top.take(10).toList().asMap().entries.map((e) => _Card(
                child: Row(children: [
                  CircleAvatar(radius: 14, child: Text('${e.key + 1}')),
                  const SizedBox(width: 10),
                  Expanded(child: Text('${e.value['name'] ?? e.value['email']}', maxLines: 1, overflow: TextOverflow.ellipsis)),
                  Text('${e.value['totalEarned']}', style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.blue)),
                ]),
              )),
        ],
      ]),
    );
  }
}

// -------------------------------------------------------------------- users
class _UsersTab extends StatefulWidget {
  final _AdminScreenState host;
  const _UsersTab({required this.host});
  @override
  State<_UsersTab> createState() => _UsersTabState();
}

class _UsersTabState extends State<_UsersTab> with AutomaticKeepAliveClientMixin {
  final q = TextEditingController();
  List<dynamic> items = const [];
  bool loading = true;
  String? error;
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { loading = true; error = null; });
    try {
      final r = await widget.host._dio.get('/admin/users', queryParameters: {'q': q.text.trim(), 'limit': 40});
      items = List<dynamic>.from(r.data['items'] ?? const []);
    } catch (e) {
      error = widget.host.errText(e);
    }
    if (mounted) setState(() => loading = false);
  }

  Future<void> _act(String label, Future<void> Function() fn) async {
    try {
      await fn();
      widget.host.toast(label);
      await _load();
    } catch (e) {
      widget.host.toast(widget.host.errText(e), error: true);
    }
  }

  void _open(Map u) {
    final id = '${u['id']}';
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Wrap(children: [
          ListTile(title: Text('${u['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w900)), subtitle: Text('${u['email']}\n${u['role']} • ${u['status']} • ${u['points']}')),
          ListTile(
            leading: const Icon(Icons.add_circle_outline_rounded, color: AppColors.success),
            title: const Text('منح / خصم نقاط'),
            onTap: () async {
              Navigator.pop(ctx);
              final amount = await _askText(context, tr('المبلغ (استخدم - للخصم)'), number: true);
              if (amount == null || amount.isEmpty) return;
              final note = await _askText(context, tr('ملاحظة'), hint: 'اختياري') ?? '';
              await _act(tr('تم'), () => widget.host._dio.post('/admin/users/$id/grant-points', data: {'amount': amount, 'note': note}));
            },
          ),
          ListTile(
            leading: const Icon(Icons.ac_unit_rounded, color: AppColors.blue),
            title: const Text('تجميد الحساب'),
            onTap: () async {
              Navigator.pop(ctx);
              await _act(tr('تم'), () => widget.host._dio.post('/admin/users/$id/freeze'));
            },
          ),
          ListTile(
            leading: const Icon(Icons.lock_open_rounded, color: AppColors.success),
            title: const Text('رفع التجميد / الحظر'),
            onTap: () async {
              Navigator.pop(ctx);
              await _act(tr('تم'), () => widget.host._dio.post('/admin/users/$id/unfreeze'));
            },
          ),
          ListTile(
            leading: const Icon(Icons.block_rounded, color: AppColors.red),
            title: const Text('حظر الحساب'),
            onTap: () async {
              Navigator.pop(ctx);
              final reason = await _askText(context, tr('سبب الحظر'));
              if (reason == null) return;
              await _act(tr('تم'), () => widget.host._dio.post('/admin/users/$id/ban', data: {'reason': reason}));
            },
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
        child: TextField(
          controller: q,
          textInputAction: TextInputAction.search,
          onSubmitted: (_) => _load(),
          decoration: InputDecoration(hintText: tr('بحث بالاسم أو البريد أو الكود'), prefixIcon: const Icon(Icons.search_rounded), suffixIcon: IconButton(icon: const Icon(Icons.arrow_forward_rounded), onPressed: _load)),
        ),
      ),
      Expanded(
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : error != null
                ? _err(error!, _load)
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(padding: const EdgeInsets.fromLTRB(14, 6, 14, 24), children: [
                      for (final u in items)
                        _Card(
                          child: InkWell(
                            onTap: () => _open(Map.from(u as Map)),
                            child: Row(children: [
                              const CircleAvatar(child: Icon(Icons.person_rounded)),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text('${u['name'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
                                  Text('${u['email']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                                ]),
                              ),
                              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                                Text('${u['points']}', style: const TextStyle(fontWeight: FontWeight.w900, color: AppColors.blue)),
                                Text('${u['status']}', style: TextStyle(fontSize: 11, color: '${u['status']}' == 'ACTIVE' ? AppColors.success : AppColors.red)),
                              ]),
                            ]),
                          ),
                        ),
                      if (items.isEmpty) const Padding(padding: EdgeInsets.all(30), child: Center(child: Text('لا توجد نتائج'))),
                    ]),
                  ),
      ),
    ]);
  }
}

// ----------------------------------------------------------------- payments
class _PaymentsTab extends StatefulWidget {
  final _AdminScreenState host;
  const _PaymentsTab({required this.host});
  @override
  State<_PaymentsTab> createState() => _PaymentsTabState();
}

class _PaymentsTabState extends State<_PaymentsTab> with AutomaticKeepAliveClientMixin {
  String filter = 'PENDING';
  List<dynamic> items = const [];
  bool loading = true;
  String? error;
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { loading = true; error = null; });
    try {
      final r = await widget.host._dio.get('/admin/purchases', queryParameters: {'status': filter, 'limit': 40});
      items = List<dynamic>.from(r.data['items'] ?? const []);
    } catch (e) {
      error = widget.host.errText(e);
    }
    if (mounted) setState(() => loading = false);
  }

  Future<void> _decide(Map p, bool approve) async {
    String? reason;
    if (!approve) {
      reason = await _askText(context, tr('سبب الرفض'));
      if (reason == null) return;
    } else if (!await _confirm(context, tr('تأكيد'))) {
      return;
    }
    try {
      await widget.host._dio.post('/admin/purchases/${p['id']}/${approve ? 'approve' : 'reject'}', data: approve ? {} : {'reason': reason});
      widget.host.toast(tr('تم'));
      await _load();
    } catch (e) {
      widget.host.toast(widget.host.errText(e), error: true);
    }
  }

  Future<void> _receipt(Map p) async {
    try {
      final r = await widget.host._dio.get('/admin/purchases/${p['id']}/receipt');
      final data = '${r.data['receiptImageData']}';
      final bytes = base64Decode(data.contains(',') ? data.split(',').last : data);
      if (!mounted) return;
      showDialog<void>(context: context, builder: (c) => Dialog(child: InteractiveViewer(child: Image.memory(bytes))));
    } catch (e) {
      widget.host.toast(widget.host.errText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Column(children: [
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
        child: Row(children: [
          for (final f in const [('PENDING', 'قيد المراجعة'), ('APPROVED', 'تمت الموافقة'), ('REJECTED', 'مرفوض')])
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 8),
              child: ChoiceChip(label: Text(f.$2), selected: filter == f.$1, onSelected: (_) { filter = f.$1; _load(); }),
            ),
        ]),
      ),
      Expanded(
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : error != null
                ? _err(error!, _load)
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(padding: const EdgeInsets.fromLTRB(14, 10, 14, 24), children: [
                      for (final raw in items)
                        Builder(builder: (_) {
                          final p = Map<String, dynamic>.from(raw as Map);
                          final user = Map<String, dynamic>.from(p['user'] ?? const {});
                          final method = Map<String, dynamic>.from(p['paymentMethod'] is Map ? p['paymentMethod'] : const {});
                          final price = ((int.tryParse('${p['priceCents'] ?? 0}') ?? 0) / 100).toStringAsFixed(2);
                          return _Card(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                Expanded(child: Text('${user['name'] ?? user['email'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w900))),
                                Text('\$$price', style: const TextStyle(fontWeight: FontWeight.w900, color: AppColors.success)),
                              ]),
                              const SizedBox(height: 4),
                              Text('${method['label'] ?? p['method'] ?? ''} • ${p['pointsGiven']} • ${p['transactionId'] ?? '-'}', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                              if (filter == 'PENDING') ...[
                                const SizedBox(height: 10),
                                Row(children: [
                                  if (p['hasReceipt'] == true) IconButton(onPressed: () => _receipt(p), icon: const Icon(Icons.receipt_long_rounded)),
                                  const Spacer(),
                                  OutlinedButton(onPressed: () => _decide(p, false), child: const Text('مرفوض')),
                                  const SizedBox(width: 8),
                                  FilledButton(onPressed: () => _decide(p, true), child: const Text('تمت الموافقة')),
                                ]),
                              ],
                            ]),
                          );
                        }),
                      if (items.isEmpty) const Padding(padding: EdgeInsets.all(30), child: Center(child: Text('لا توجد طلبات دفع حتى الآن'))),
                    ]),
                  ),
      ),
    ]);
  }
}

// -------------------------------------------------------------------- wheel
class _WheelTab extends StatefulWidget {
  final _AdminScreenState host;
  const _WheelTab({required this.host});
  @override
  State<_WheelTab> createState() => _WheelTabState();
}

class _WheelTabState extends State<_WheelTab> with AutomaticKeepAliveClientMixin {
  List<Map<String, dynamic>> prizes = const [];
  bool loading = true;
  String? error;
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { loading = true; error = null; });
    try {
      final r = await widget.host._dio.get('/admin/wheel/prizes');
      prizes = (r.data['items'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (e) {
      error = widget.host.errText(e);
    }
    if (mounted) setState(() => loading = false);
  }

  Future<void> _edit([Map<String, dynamic>? p]) async {
    final label = TextEditingController(text: '${p?['label'] ?? ''}');
    final points = TextEditingController(text: '${p?['points'] ?? 0}');
    final weight = TextEditingController(text: '${p?['weight'] ?? 10}');
    final color = TextEditingController(text: '${p?['color'] ?? '#ff3b5c'}');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(p == null ? tr('إضافة جائزة') : tr('تعديل الجائزة')),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: label, decoration: InputDecoration(labelText: tr('اسم الجائزة'))),
            TextField(controller: points, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: tr('النقاط'))),
            TextField(controller: weight, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: tr('الوزن (الاحتمال)'))),
            TextField(controller: color, decoration: InputDecoration(labelText: tr('اللون #RRGGBB'))),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('حفظ')),
        ],
      ),
    );
    if (ok != true) return;
    final body = {'label': label.text.trim(), 'points': int.tryParse(points.text) ?? 0, 'weight': int.tryParse(weight.text) ?? 10, 'color': color.text.trim()};
    try {
      if (p == null) {
        await widget.host._dio.post('/admin/wheel/prizes', data: body);
      } else {
        await widget.host._dio.put('/admin/wheel/prizes/${p['id']}', data: body);
      }
      widget.host.toast(tr('تم'));
      await _load();
    } catch (e) {
      widget.host.toast(widget.host.errText(e), error: true);
    }
  }

  Future<void> _toggle(Map<String, dynamic> p, bool v) async {
    try {
      await widget.host._dio.put('/admin/wheel/prizes/${p['id']}', data: {'isActive': v});
      await _load();
    } catch (e) {
      widget.host.toast(widget.host.errText(e), error: true);
    }
  }

  Future<void> _delete(Map<String, dynamic> p) async {
    if (!await _confirm(context, tr('حذف الجائزة؟'))) return;
    try {
      await widget.host._dio.delete('/admin/wheel/prizes/${p['id']}');
      await _load();
    } catch (e) {
      widget.host.toast(widget.host.errText(e), error: true);
    }
  }

  Color _c(String hex) {
    try {
      return Color(int.parse(hex.replaceFirst('#', '0xff')));
    } catch (_) {
      return AppColors.purple;
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error != null) return _err(error!, _load);
    final totalWeight = prizes.where((p) => p['isActive'] == true).fold<int>(0, (a, p) => a + (int.tryParse('${p['weight']}') ?? 0));
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(onPressed: () => _edit(), icon: const Icon(Icons.add_rounded), label: const Text('إضافة جائزة')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.fromLTRB(14, 12, 14, 90), children: [
          for (final p in prizes)
            _Card(
              child: Row(children: [
                Container(width: 14, height: 44, decoration: BoxDecoration(color: _c('${p['color']}'), borderRadius: BorderRadius.circular(6))),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${p['label']}', style: const TextStyle(fontWeight: FontWeight.w800)),
                    Text(
                      '${p['points']} • ${totalWeight > 0 && p['isActive'] == true ? ((int.tryParse('${p['weight']}') ?? 0) * 100 / totalWeight).toStringAsFixed(1) : '0'}%',
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                    ),
                  ]),
                ),
                Switch(value: p['isActive'] == true, onChanged: (v) => _toggle(p, v)),
                IconButton(onPressed: () => _edit(p), icon: const Icon(Icons.edit_rounded, size: 20)),
                IconButton(onPressed: () => _delete(p), icon: const Icon(Icons.delete_outline_rounded, size: 20, color: AppColors.red)),
              ]),
            ),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------- broadcast
class _BroadcastTab extends StatefulWidget {
  final _AdminScreenState host;
  const _BroadcastTab({required this.host});
  @override
  State<_BroadcastTab> createState() => _BroadcastTabState();
}

class _BroadcastTabState extends State<_BroadcastTab> with AutomaticKeepAliveClientMixin {
  final title = TextEditingController();
  final body = TextEditingController();
  String audience = 'ALL';
  bool busy = false;
  @override
  bool get wantKeepAlive => true;

  Future<void> _send({required bool preview}) async {
    if (title.text.trim().isEmpty || body.text.trim().isEmpty) {
      widget.host.toast(tr('العنوان والنص مطلوبان'), error: true);
      return;
    }
    if (!preview && !await _confirm(context, tr('إرسال الإشعار الآن؟'))) return;
    setState(() => busy = true);
    try {
      final r = await widget.host._dio.post('/admin/notifications/send', data: {
        'title': title.text.trim(), 'body': body.text.trim(), 'audience': audience, 'type': 'info', 'preview': preview,
      });
      if (preview) {
        widget.host.toast('${tr('عدد المستهدفين')}: ${r.data['count']}');
      } else {
        widget.host.toast(tr('تم الإرسال'));
        title.clear();
        body.clear();
      }
    } catch (e) {
      widget.host.toast(widget.host.errText(e), error: true);
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return ListView(padding: const EdgeInsets.all(14), children: [
      TextField(controller: title, maxLength: 120, decoration: InputDecoration(labelText: tr('العنوان'))),
      const SizedBox(height: 8),
      TextField(controller: body, maxLength: 500, maxLines: 4, decoration: InputDecoration(labelText: tr('النص'))),
      const SizedBox(height: 8),
      DropdownButtonFormField<String>(
        initialValue: audience,
        decoration: InputDecoration(labelText: tr('الجمهور')),
        items: [
          for (final a in const [('ALL', 'الجميع'), ('VIP_PRO', 'مشتركو VIP'), ('INACTIVE', 'غير النشطين'), ('NEW_USERS', 'المستخدمون الجدد')])
            DropdownMenuItem(value: a.$1, child: Text(a.$2)),
        ],
        onChanged: (v) => setState(() => audience = v ?? 'ALL'),
      ),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(child: OutlinedButton(onPressed: busy ? null : () => _send(preview: true), child: const Text('معاينة العدد'))),
        const SizedBox(width: 10),
        Expanded(child: FilledButton.icon(onPressed: busy ? null : () => _send(preview: false), icon: const Icon(Icons.send_rounded), label: const Text('إرسال'))),
      ]),
    ]);
  }
}

// ----------------------------------------------------------------- settings
class _SettingsTab extends StatefulWidget {
  final _AdminScreenState host;
  const _SettingsTab({required this.host});
  @override
  State<_SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends State<_SettingsTab> with AutomaticKeepAliveClientMixin {
  bool loading = true;
  String? error;
  bool saving = false;
  // announcement
  bool annOn = false;
  String annLevel = 'info';
  final annAr = TextEditingController(), annEn = TextEditingController(), annFr = TextEditingController(), annUrl = TextEditingController();
  // maintenance
  bool mOn = false;
  final mAr = TextEditingController(), mEn = TextEditingController(), mFr = TextEditingController();
  // rewards
  final spins = TextEditingController(), extra = TextEditingController(), login = TextEditingController(), adPts = TextEditingController(), adLimit = TextEditingController();
  final xpTask = TextEditingController(), xpCamp = TextEditingController(), xpBuy = TextEditingController(), xpRef = TextEditingController();
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { loading = true; error = null; });
    try {
      final r = await widget.host._dio.get('/admin/settings/rewards');
      final s = Map<String, dynamic>.from(r.data['settings'] as Map);
      final app = Map<String, dynamic>.from(s['app'] ?? const {});
      final ann = Map<String, dynamic>.from(app['announcement'] ?? const {});
      final m = Map<String, dynamic>.from(app['maintenance'] ?? const {});
      annOn = ann['enabled'] == true;
      annLevel = '${ann['level'] ?? 'info'}';
      annAr.text = '${ann['text'] ?? ''}';
      annEn.text = '${ann['textEn'] ?? ''}';
      annFr.text = '${ann['textFr'] ?? ''}';
      annUrl.text = '${ann['url'] ?? ''}';
      mOn = m['enabled'] == true;
      mAr.text = '${m['message'] ?? ''}';
      mEn.text = '${m['messageEn'] ?? ''}';
      mFr.text = '${m['messageFr'] ?? ''}';
      final w = Map<String, dynamic>.from(s['wheel'] ?? const {});
      final rw = Map<String, dynamic>.from(s['rewards'] ?? const {});
      final xp = Map<String, dynamic>.from(Map<String, dynamic>.from(s['levels'] ?? const {})['xp'] ?? const {});
      spins.text = '${w['dailySpinsLimit'] ?? 3}';
      extra.text = '${w['maxExtraSpinsPerDay'] ?? 3}';
      login.text = '${rw['loginRewardPoints'] ?? 100}';
      adPts.text = '${rw['pointsPerRewardedAd'] ?? 50}';
      adLimit.text = '${rw['dailyRewardAdsLimit'] ?? 10}';
      xpTask.text = '${xp['taskRewardXp'] ?? 8}';
      xpCamp.text = '${xp['campaignCreateXp'] ?? 12}';
      xpBuy.text = '${xp['purchaseXp'] ?? 25}';
      xpRef.text = '${xp['referralXp'] ?? 30}';
    } catch (e) {
      error = widget.host.errText(e);
    }
    if (mounted) setState(() => loading = false);
  }

  int _i(TextEditingController c, int d) => int.tryParse(c.text.trim()) ?? d;

  Future<void> _save() async {
    setState(() => saving = true);
    try {
      await widget.host._dio.put('/admin/settings/app', data: {
        'app': {
          'announcement': {'enabled': annOn, 'level': annLevel, 'text': annAr.text.trim(), 'textEn': annEn.text.trim(), 'textFr': annFr.text.trim(), 'url': annUrl.text.trim()},
          'maintenance': {'enabled': mOn, 'message': mAr.text.trim(), 'messageEn': mEn.text.trim(), 'messageFr': mFr.text.trim()},
        },
      });
      await widget.host._dio.put('/admin/settings/rewards', data: {
        'wheel': {'dailySpinsLimit': _i(spins, 3), 'maxExtraSpinsPerDay': _i(extra, 3)},
        'rewards': {'loginRewardPoints': _i(login, 100), 'pointsPerRewardedAd': _i(adPts, 50), 'dailyRewardAdsLimit': _i(adLimit, 10)},
        'levels': {'xp': {'taskRewardXp': _i(xpTask, 8), 'campaignCreateXp': _i(xpCamp, 12), 'purchaseXp': _i(xpBuy, 25), 'referralXp': _i(xpRef, 30)}},
      });
      widget.host.toast(tr('تم الحفظ'));
    } catch (e) {
      widget.host.toast(widget.host.errText(e), error: true);
    }
    if (mounted) setState(() => saving = false);
  }

  Widget _num(TextEditingController c, String label) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: TextField(controller: c, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: tr(label))),
      );

  Widget _h(String t) => Padding(padding: const EdgeInsets.only(top: 14, bottom: 8), child: Text(tr(t), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)));

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error != null) return _err(error!, _load);
    return ListView(padding: const EdgeInsets.fromLTRB(14, 6, 14, 30), children: [
      _h('إعلان داخل التطبيق'),
      SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('تفعيل الإعلان'), value: annOn, onChanged: (v) => setState(() => annOn = v)),
      DropdownButtonFormField<String>(
        initialValue: annLevel,
        decoration: InputDecoration(labelText: tr('النوع')),
        items: const [DropdownMenuItem(value: 'info', child: Text('معلومة')), DropdownMenuItem(value: 'success', child: Text('نجاح')), DropdownMenuItem(value: 'warning', child: Text('تنبيه'))],
        onChanged: (v) => setState(() => annLevel = v ?? 'info'),
      ),
      const SizedBox(height: 8),
      TextField(controller: annAr, decoration: const InputDecoration(labelText: 'العربية')),
      const SizedBox(height: 8),
      TextField(controller: annEn, decoration: const InputDecoration(labelText: 'English')),
      const SizedBox(height: 8),
      TextField(controller: annFr, decoration: const InputDecoration(labelText: 'Français')),
      const SizedBox(height: 8),
      TextField(controller: annUrl, decoration: const InputDecoration(labelText: 'URL')),
      _h('وضع الصيانة'),
      SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('تفعيل وضع الصيانة'), subtitle: const Text('يمنع المستخدمين العاديين من استخدام التطبيق'), value: mOn, onChanged: (v) => setState(() => mOn = v)),
      TextField(controller: mAr, decoration: const InputDecoration(labelText: 'العربية')),
      const SizedBox(height: 8),
      TextField(controller: mEn, decoration: const InputDecoration(labelText: 'English')),
      const SizedBox(height: 8),
      TextField(controller: mFr, decoration: const InputDecoration(labelText: 'Français')),
      _h('عجلة الحظ والمكافآت'),
      _num(spins, 'لفات يومية'),
      _num(extra, 'أقصى لفات إضافية'),
      _num(login, 'مكافأة الدخول اليومي'),
      _num(adPts, 'نقاط الإعلان المكافئ'),
      _num(adLimit, 'حد الإعلانات اليومي'),
      _h('نقاط الخبرة XP'),
      _num(xpTask, 'XP لكل مهمة'),
      _num(xpCamp, 'XP لكل حملة'),
      _num(xpBuy, 'XP لكل شراء'),
      _num(xpRef, 'XP لكل إحالة'),
      const SizedBox(height: 12),
      FilledButton.icon(onPressed: saving ? null : _save, icon: const Icon(Icons.save_rounded), label: Text(saving ? '...' : 'حفظ')),
    ]);
  }
}

// --------------------------------------------------------------------- logs
class _LogsTab extends StatefulWidget {
  final _AdminScreenState host;
  const _LogsTab({required this.host});
  @override
  State<_LogsTab> createState() => _LogsTabState();
}

class _LogsTabState extends State<_LogsTab> with AutomaticKeepAliveClientMixin {
  List<dynamic> items = const [];
  bool loading = true;
  String? error;
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { loading = true; error = null; });
    try {
      final r = await widget.host._dio.get('/admin/logs', queryParameters: {'limit': 50});
      items = List<dynamic>.from(r.data['items'] ?? const []);
    } catch (e) {
      error = widget.host.errText(e);
    }
    if (mounted) setState(() => loading = false);
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error != null) return _err(error!, _load);
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.all(14), children: [
        for (final l in items)
          _Card(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${l['action']}', style: const TextStyle(fontWeight: FontWeight.w800)),
              Text('${(l['actor'] ?? const {})['name'] ?? (l['actor'] ?? const {})['email'] ?? ''} • ${'${l['createdAt']}'.replaceFirst('T', ' ').split('.').first}', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
            ]),
          ),
      ]),
    );
  }
}
