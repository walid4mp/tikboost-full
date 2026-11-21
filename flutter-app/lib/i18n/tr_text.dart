import 'package:flutter/material.dart' as m;

import 'i18n.dart';

export 'i18n.dart' show tr, I18n;

/// Drop-in replacement for Flutter's [m.Text] that translates its Arabic
/// source string at build time. Files import this with
/// `import 'package:flutter/material.dart' hide Text;` so every existing
/// `Text('...')` (even `const` ones) becomes language-aware without edits.
class Text extends m.StatelessWidget {
  final String data;
  final m.TextStyle? style;
  final m.TextAlign? textAlign;
  final m.TextOverflow? overflow;
  final int? maxLines;
  final bool? softWrap;
  final m.TextDirection? textDirection;
  final String? semanticsLabel;
  final m.StrutStyle? strutStyle;
  final m.TextScaler? textScaler;
  final m.TextWidthBasis? textWidthBasis;

  const Text(
    this.data, {
    super.key,
    this.style,
    this.textAlign,
    this.overflow,
    this.maxLines,
    this.softWrap,
    this.textDirection,
    this.semanticsLabel,
    this.strutStyle,
    this.textScaler,
    this.textWidthBasis,
  });

  @override
  m.Widget build(m.BuildContext context) {
    return m.Text(
      tr(data),
      style: style,
      textAlign: textAlign,
      overflow: overflow,
      maxLines: maxLines,
      softWrap: softWrap,
      textDirection: textDirection,
      semanticsLabel: semanticsLabel,
      strutStyle: strutStyle,
      textScaler: textScaler,
      textWidthBasis: textWidthBasis,
    );
  }
}
