import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/visitor_provider.dart';
import '../../core/app_theme.dart';
import 'widgets/metric_card.dart';
import 'widgets/visitor_card.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final visitorsAsync = ref.watch(visitorsProvider);
    final activeCount = ref.watch(activeVisitorsCountProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.notifications_outlined),
          ),
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.account_circle_outlined),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/scanner'),
        backgroundColor: AppTheme.primaryBlue,
        child: const Icon(Icons.qr_code_scanner, color: Colors.white),
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 20),
            const Text(
              'Aavija Morning,',
              style: TextStyle(fontSize: 16, color: Colors.white54),
            ),
            const Text(
              'Resident Portal',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 30),
            
            // Metrics Grid
            SizedBox(
              height: 120,
              child: Row(
                children: [
                   Expanded(
                    child: MetricCard(
                      title: 'Tokens',
                      value: '1,240',
                      icon: Icons.toll,
                      color: Colors.amber,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: MetricCard(
                      title: 'Visitors',
                      value: activeCount.toString(),
                      icon: Icons.people_outline,
                      color: AppTheme.primaryBlue,
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 32),
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Recent Activity',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                Text(
                  'View All',
                  style: TextStyle(color: AppTheme.primaryBlue, fontSize: 14),
                ),
              ],
            ),
            const SizedBox(height: 16),
            
            // Visitor List
            Expanded(
              child: visitorsAsync.when(
                data: (visitors) => visitors.isEmpty
                    ? const Center(child: Text('No recent activity'))
                    : ListView.builder(
                        itemCount: visitors.length,
                        itemBuilder: (context, index) => VisitorCard(visitor: visitors[index]),
                      ),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (err, stack) => Center(child: Text('Error: $err')),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
