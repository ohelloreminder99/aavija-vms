import 'package:flutter/material.dart';
import '../dashboard/dashboard_screen.dart';

class GatekeeperDashboard extends StatelessWidget {
  const GatekeeperDashboard({super.key, this.premiseId});
  final String? premiseId;

  @override
  Widget build(BuildContext context) {
    // For now, reuse the existing DashboardScreen which has the scan button
    return const DashboardScreen();
  }
}
