import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';
import '../../services/visitor_service.dart';
import '../../core/app_theme.dart';

class ShareEarnScreen extends ConsumerStatefulWidget {
  const ShareEarnScreen({super.key});

  @override
  ConsumerState<ShareEarnScreen> createState() => _ShareEarnScreenState();
}

class _ShareEarnScreenState extends ConsumerState<ShareEarnScreen> {
  Map<String, dynamic>? _stats;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchStats();
  }

  Future<void> _fetchStats() async {
    final user = ref.read(currentUserProvider);
    if (user == null) return;
    
    final stats = await VisitorService.getReferralStats(user.id);
    if (mounted) {
      setState(() {
        _stats = stats;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      appBar: AppBar(
        title: const Text('Share & Earn', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  _buildPromoCard(),
                  const SizedBox(height: 32),
                  _buildReferralCodeCard(_stats?['referral_code'] ?? '------'),
                  const SizedBox(height: 32),
                  _buildEarningsRow(_stats?['balance'] ?? 0),
                  const SizedBox(height: 32),
                  _buildHistoryHeader(),
                  const SizedBox(height: 16),
                  _buildReferralList(_stats?['referrals'] ?? []),
                ],
              ),
            ),
    );
  }

  Widget _buildPromoCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppTheme.primaryBlue, AppTheme.primaryBlue.withValues(alpha: 0.7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
      ),
      child: const Column(
        children: [
          Icon(Icons.card_giftcard, size: 48, color: Colors.white),
          SizedBox(height: 16),
          Text(
            'Invite Friends & Earn',
            style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Text(
            'Share your code. When a friend signs up and tops up, you earn a commission!',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white70, fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildReferralCodeCard(String code) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('YOUR REFERRAL CODE', style: TextStyle(color: Colors.white38, fontSize: 12, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppTheme.primaryBlue.withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              Text(
                code,
                style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold, letterSpacing: 4),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.copy, color: AppTheme.primaryBlue),
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: code));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Code copied to clipboard')),
                  );
                },
              ),
              IconButton(
                icon: const Icon(Icons.share, color: AppTheme.primaryBlue),
                onPressed: () {
                  // Integration with share_plus would happen here
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Sharing not implemented in mock')),
                  );
                },
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildEarningsRow(num balance) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.account_balance_wallet, color: Colors.amber, size: 28),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Referral Balance', style: TextStyle(color: Colors.white38, fontSize: 13)),
              Text('₹$balance', style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryHeader() {
    return const Row(
      children: [
        Text('Referral History', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildReferralList(List referrals) {
    if (referrals.isEmpty) {
      return const Padding(
        padding: EdgeInsets.only(top: 20),
        child: Text('No referrals yet', style: TextStyle(color: Colors.white38)),
      );
    }

    return Column(
      children: referrals.map((ref) {
        final referee = ref['referee']?['name'] ?? 'Friend';
        final commission = ref['commission_amount'] ?? 0;
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              const CircleAvatar(
                backgroundColor: Colors.white10,
                child: Icon(Icons.person, color: Colors.white38),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(referee, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                    const Text('Joined via your code', style: TextStyle(color: Colors.white38, fontSize: 12)),
                  ],
                ),
              ),
              Text(
                '+₹$commission',
                style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}
