import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../providers/auth_provider.dart';
import '../../services/visitor_service.dart';

class LedgerScreen extends ConsumerStatefulWidget {
  const LedgerScreen({super.key});

  @override
  ConsumerState<LedgerScreen> createState() => _LedgerScreenState();
}

class _LedgerScreenState extends ConsumerState<LedgerScreen> {
  List<Map<String, dynamic>> _records = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchLedger();
  }

  Future<void> _fetchLedger() async {
    final user = ref.read(currentUserProvider);
    if (user == null) return;
    
    final records = await VisitorService.getLedgerRecords(user.id);
    if (mounted) {
      setState(() {
        _records = records;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      appBar: AppBar(
        title: const Text('Token Ledger', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _records.isEmpty
              ? _buildEmptyState()
              : ListView.builder(
                  padding: const EdgeInsets.all(20),
                  itemCount: _records.length,
                  itemBuilder: (context, index) {
                    final record = _records[index];
                    return _buildLedgerItem(record);
                  },
                ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.account_balance_wallet_outlined, size: 80, color: Colors.white.withValues(alpha: 0.1)),
          const SizedBox(height: 20),
          const Text(
            'No transactions yet',
            style: TextStyle(color: Colors.white38, fontSize: 18),
          ),
        ],
      ),
    );
  }

  Widget _buildLedgerItem(Map<String, dynamic> record) {
    final String action = record['action'] ?? '';
    final int amount = (record['tokenChange'] ?? 0).abs();
    final bool isCredit = action == 'TOKEN_PURCHASE' || action == 'INITIAL_TOKEN_ALLOCATION' || action == 'REFERRAL_WELCOME_TOKENS';
    final DateTime timestamp = DateTime.parse(record['timestamp']);
    final String date = DateFormat('MMM dd, yyyy').format(timestamp);
    final String time = DateFormat('hh:mm a').format(timestamp);

    String title = 'Transaction';
    IconData icon = Icons.receipt_long;
    Color color = Colors.blue;

    switch (action) {
      case 'TOKEN_PURCHASE':
        title = 'Token Purchase';
        icon = Icons.add_shopping_cart;
        color = Colors.green;
        break;
      case 'VISITOR_CHECKIN_COST':
        title = 'Check-in Fee';
        icon = Icons.sensor_door_outlined;
        color = Colors.orange;
        break;
      case 'INITIAL_TOKEN_ALLOCATION':
        title = 'Welcome Bonus';
        icon = Icons.card_giftcard;
        color = Colors.amber;
        break;
      case 'REFERRAL_WELCOME_TOKENS':
        title = 'Referral Reward';
        icon = Icons.group_add_outlined;
        color = Colors.purple;
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                Text('$date • $time', style: const TextStyle(color: Colors.white38, fontSize: 12)),
              ],
            ),
          ),
          Text(
            '${isCredit ? '+' : '-'}$amount VTK',
            style: TextStyle(
              color: isCredit ? Colors.greenAccent : Colors.redAccent,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }
}
