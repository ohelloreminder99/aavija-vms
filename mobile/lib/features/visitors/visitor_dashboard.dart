import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../providers/auth_provider.dart';
import '../../services/visitor_service.dart';
import '../../core/app_theme.dart';

class VisitorDashboard extends ConsumerStatefulWidget {
  const VisitorDashboard({super.key});

  @override
  ConsumerState<VisitorDashboard> createState() => _VisitorDashboardState();
}

class _VisitorDashboardState extends ConsumerState<VisitorDashboard> {
  List<Map<String, dynamic>> _recentVisits = [];
  bool _isLoadingVisits = true;
  Timer? _durationTimer;
  String _stayDuration = '00:00:00';

  @override
  void initState() {
    super.initState();
    _fetchVisits();
    _startDurationTimer();
  }

  void _startDurationTimer() {
    _durationTimer?.cancel();
    _durationTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      final profile = ref.read(userProfileProvider).value;
      final activeCheckinId = profile?['active_checkin_id'];
      
      if (activeCheckinId != null && _recentVisits.isNotEmpty) {
        final activeVisit = _recentVisits.firstWhere(
          (v) => v['id'] == activeCheckinId,
          orElse: () => {},
        );
        
        if (activeVisit.isNotEmpty && activeVisit['checkin_time'] != null) {
          final checkinTime = DateTime.parse(activeVisit['checkin_time']);
          final duration = DateTime.now().difference(checkinTime);
          
          if (mounted) {
            setState(() {
              _stayDuration = _formatDuration(duration);
            });
          }
        }
      }
    });
  }

  String _formatDuration(Duration d) {
    String twoDigits(int n) => n.toString().padLeft(2, "0");
    String twoDigitMinutes = twoDigits(d.inMinutes.remainder(60));
    String twoDigitSeconds = twoDigits(d.inSeconds.remainder(60));
    return "${twoDigits(d.inHours)}:$twoDigitMinutes:$twoDigitSeconds";
  }

  @override
  void dispose() {
    _durationTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchVisits() async {
    final user = ref.read(currentUserProvider);
    if (user == null) return;
    
    final visits = await VisitorService.getVisitHistory(user.id);
    if (mounted) {
      setState(() {
        _recentVisits = visits;
        _isLoadingVisits = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(userProfileProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(userProfileProvider);
          await _fetchVisits();
        },
        child: profileAsync.when(
          data: (profile) => _buildContent(context, profile ?? {}),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, stack) => Center(child: Text('Error: $err')),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, Map<String, dynamic> profile) {
    final String activeCheckinId = profile['active_checkin_id'] ?? '';
    final int tokenBalance = profile['token_balance_visitor'] ?? 0;

    return CustomScrollView(
      slivers: [
        _buildSliverAppBar(profile['name'] ?? 'Visitor'),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildTokenBalanceCard(tokenBalance),
                const SizedBox(height: 24),
                if (activeCheckinId.isNotEmpty)
                  _buildActivePassCard(activeCheckinId, profile['id'] ?? '')
                else
                  _buildGenerateQRCard(context),
                const SizedBox(height: 32),
                const Text(
                  'Quick Actions',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                _buildActionGrid(context),
                const SizedBox(height: 32),
                const Text(
                  'Recent Activity',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                _buildRecentVisits(),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSliverAppBar(String name) {
    return SliverAppBar(
      expandedHeight: 120,
      backgroundColor: Colors.transparent,
      floating: false,
      pinned: true,
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        title: Text(
          'Hi, $name',
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF0F172A), Color(0xFF020617)],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTokenBalanceCard(int balance) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.amber.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.stars, color: Colors.amber, size: 28),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Token Balance', style: TextStyle(color: Colors.white38, fontSize: 13)),
                Text('$balance VTK', style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white.withValues(alpha: 0.05),
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Top Up', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Widget _buildActivePassCard(String visitId, String visitorId) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF10B981), Color(0xFF059669)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.green.withValues(alpha: 0.2),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('ACTIVE PASS', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
              Icon(Icons.verified, color: Colors.white, size: 24),
            ],
          ),
          const SizedBox(height: 20),
          const Text(
            'You are currently checked-in.',
            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PLEASE VISIT THE GATEKEEPER',
                      style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.1),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Present your QR code at the exit to check-out securely.',
                      style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Column(
                children: [
                  const Icon(Icons.qr_code_2, color: Colors.white, size: 48),
                  const SizedBox(height: 8),
                  Text(
                    _stayDuration, 
                    style: const TextStyle(
                      color: Colors.white, 
                      fontSize: 13, 
                      fontWeight: FontWeight.bold,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildGenerateQRCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppTheme.primaryBlue.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: [
          const Icon(Icons.qr_code_scanner, color: AppTheme.primaryBlue, size: 48),
          const SizedBox(height: 16),
          const Text(
            'Ready to visit?',
            style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'Generate a secure QR code to enter the premise.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white38, fontSize: 14),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => GoRouter.of(context).push('/scanner/passport'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryBlue,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            child: const Text('Generate Entry Pass', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Widget _buildActionGrid(BuildContext context) {
    final actions = [
      {'title': 'Profile', 'icon': Icons.person_outline, 'route': '/profile'},
      {'title': 'Vehicles', 'icon': Icons.directions_car_outlined, 'route': '/vehicles'},
      {'title': 'History', 'icon': Icons.history, 'route': '/dashboard/visitor/history'},
      {'title': 'Ledger', 'icon': Icons.account_balance_wallet_outlined, 'route': '/ledger'},
      {'title': 'Share & Earn', 'icon': Icons.share_outlined, 'route': '/share-earn'},
      {'title': 'Billing', 'icon': Icons.receipt_long_outlined, 'route': '/gst-details'},
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
        childAspectRatio: 2.2,
      ),
      itemCount: actions.length,
      itemBuilder: (context, index) {
        return InkWell(
          onTap: () => context.push(actions[index]['route'] as String),
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            ),
            child: Row(
              children: [
                Icon(actions[index]['icon'] as IconData, color: AppTheme.primaryBlue, size: 24),
                const SizedBox(width: 12),
                Text(actions[index]['title'] as String, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildRecentVisits() {
    if (_isLoadingVisits) return const Center(child: CircularProgressIndicator());
    if (_recentVisits.isEmpty) {
      return const Center(
        child: Text('No recent visits found', style: TextStyle(color: Colors.white38)),
      );
    }

    return Column(
      children: _recentVisits.map((visit) {
        final premise = visit['premises'] ?? {};
        final checkinTime = DateTime.parse(visit['checkin_time']);
        final String formattedDate = DateFormat('MMM dd, hh:mm a').format(checkinTime);

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.business, color: Colors.white38, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(premise['name'] ?? 'Unknown Premise', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    Text(formattedDate, style: const TextStyle(color: Colors.white38, fontSize: 12)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: visit['status'] == 'active' ? Colors.green.withValues(alpha: 0.1) : Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  visit['status'].toString().toUpperCase(),
                  style: TextStyle(
                    color: visit['status'] == 'active' ? Colors.green : Colors.white38,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

