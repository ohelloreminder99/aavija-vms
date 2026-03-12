import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aavija_mobile/main.dart';

void main() {
  testWidgets('App loads and shows login screen', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: AavijaApp()));
    
    // Verify that the title is present
    expect(find.text('Aavija VMS'), findsOneWidget);
    expect(find.text('Secure Visitor Management'), findsOneWidget);
  });
}
