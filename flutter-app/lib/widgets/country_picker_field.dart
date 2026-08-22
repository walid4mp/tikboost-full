import 'package:flutter/material.dart';

import '../config/app_theme.dart';
import '../data/countries.dart';

class CountryPickerField extends StatefulWidget {
  final String? value;
  final String label;
  final String hint;
  final ValueChanged<CountryItem> onChanged;
  final String? Function(String?)? validator;

  const CountryPickerField({
    super.key,
    required this.value,
    required this.onChanged,
    this.label = 'الدولة',
    this.hint = 'اختر الدولة',
    this.validator,
  });

  @override
  State<CountryPickerField> createState() => _CountryPickerFieldState();
}

class _CountryPickerFieldState extends State<CountryPickerField> {
  @override
  Widget build(BuildContext context) {
    final selected = widget.value == null || widget.value!.isEmpty
        ? null
        : kCountries.where((item) => item.code == widget.value).cast<CountryItem?>().firstOrNull;

    return FormField<String>(
      initialValue: widget.value,
      validator: widget.validator,
      builder: (field) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.label, style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () async {
                final result = await showModalBottomSheet<CountryItem>(
                  context: context,
                  isScrollControlled: true,
                  showDragHandle: true,
                  backgroundColor: Theme.of(context).cardColor,
                  builder: (_) => _CountryPickerSheet(selectedCode: widget.value),
                );
                if (result == null) return;
                field.didChange(result.code);
                widget.onChanged(result);
              },
              child: InputDecorator(
                decoration: InputDecoration(
                  hintText: widget.hint,
                  errorText: field.errorText,
                  prefixIcon: const Icon(Icons.flag_outlined),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: selected == null
                          ? Text(
                              widget.hint,
                              style: const TextStyle(color: AppColors.textMuted),
                            )
                          : Text('${selected.flag} ${selected.nameAr} (${selected.code})'),
                    ),
                    const Icon(Icons.keyboard_arrow_down_rounded),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _CountryPickerSheet extends StatefulWidget {
  final String? selectedCode;

  const _CountryPickerSheet({required this.selectedCode});

  @override
  State<_CountryPickerSheet> createState() => _CountryPickerSheetState();
}

class _CountryPickerSheetState extends State<_CountryPickerSheet> {
  final TextEditingController search = TextEditingController();
  late List<CountryItem> filtered;

  @override
  void initState() {
    super.initState();
    filtered = List<CountryItem>.from(kCountries);
    search.addListener(_applyFilter);
  }

  void _applyFilter() {
    final query = search.text.trim().toLowerCase();
    setState(() {
      filtered = query.isEmpty
          ? List<CountryItem>.from(kCountries)
          : kCountries.where((item) => item.searchText.contains(query)).toList();
    });
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(bottom: viewInsets.bottom),
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.8,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: TextField(
                  controller: search,
                  autofocus: true,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search),
                    hintText: 'ابحث باسم الدولة أو الكود',
                  ),
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? const Center(child: Text('لا توجد نتائج'))
                    : ListView.separated(
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (_, index) {
                          final item = filtered[index];
                          final selected = item.code == widget.selectedCode;
                          return ListTile(
                            onTap: () => Navigator.of(context).pop(item),
                            leading: Text(item.flag, style: const TextStyle(fontSize: 24)),
                            title: Text(item.nameAr),
                            subtitle: Text('${item.nameEn} • ${item.code}'),
                            trailing: selected
                                ? const Icon(Icons.check_circle, color: AppColors.success)
                                : null,
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
