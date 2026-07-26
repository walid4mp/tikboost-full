import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tikboost/main.dart';

void main() {
  testWidgets('renders TikBoost splash screen', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: TikBoostApp()));
    expect(find.text('TikBoost'), findsOneWidget);
  });
}
