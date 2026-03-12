import 'package:flutter/foundation.dart';
import '../services/supabase_service.dart';

class AgentService {
  static final client = SupabaseService.client;

  static Future<Map<String, dynamic>> submitPayoutRequest({
    required String type,
    required double amount,
    int? tokensRequested,
    double? conversionRate,
  }) async {
    try {
      final user = client.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      // Check for pending requests
      final existing = await client
          .from('payout_requests')
          .select('id')
          .eq('user_id', user.id)
          .inFilter('status', ['pending', 'processing'])
          .limit(1)
          .maybeSingle();

      if (existing != null) {
        throw Exception('You already have a pending payout request.');
      }

      // Fetch settings for calculations
      final settings = await client
          .from('settings')
          .select('tds_enabled, tds_rate, token_conversion_rate')
          .eq('id', 'global')
          .single();

      double tdsDeducted = 0;
      double netAmount = amount;
      
      if (type == 'cash' && (settings['tds_enabled'] ?? false)) {
        final double rate = (settings['tds_rate'] ?? 0).toDouble();
        tdsDeducted = (amount * (rate / 100) * 100).floorToDouble() / 100;
        netAmount = amount - tdsDeducted;
      }

      await client.from('payout_requests').insert({
        'user_id': user.id,
        'amount': amount,
        'type': type,
        'status': 'pending',
        'source': 'agent',
        'tds_deducted': tdsDeducted,
        'net_amount': netAmount,
        'tokens_credited': tokensRequested ?? 0,
        'conversion_rate': conversionRate ?? settings['token_conversion_rate'] ?? 1,
      });

      return {'success': true};
    } catch (e) {
      debugPrint('Submit Payout Error: $e');
      return {'success': false, 'error': e.toString()};
    }
  }

  static Future<Map<String, dynamic>> updatePayoutDetails({
    String? upiId,
    String? panNumber,
  }) async {
    try {
      final user = client.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      final Map<String, dynamic> updates = {};
      if (upiId != null) updates['agent_payout_upi'] = upiId;
      if (panNumber != null) updates['pan_number'] = panNumber;

      if (updates.isEmpty) return {'success': true};

      await client.from('users').update(updates).eq('id', user.id);
      return {'success': true};
    } catch (e) {
      debugPrint('Update Payout Details Error: $e');
      return {'success': false, 'error': e.toString()};
    }
  }

  static Future<List<Map<String, dynamic>>> fetchPayoutHistory() async {
    try {
      final user = client.auth.currentUser;
      if (user == null) return [];

      final response = await client
          .from('payout_requests')
          .select('*')
          .eq('user_id', user.id)
          .order('requested_at', ascending: false)
          .limit(20);

      return List<Map<String, dynamic>>.from(response);
    } catch (e) {
      debugPrint('Fetch Payout History Error: $e');
      return [];
    }
  }
}
