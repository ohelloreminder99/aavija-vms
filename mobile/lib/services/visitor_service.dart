import 'package:flutter/foundation.dart';
import '../services/supabase_service.dart';
import 'dart:math';

class VisitorService {
  static final client = SupabaseService.client;

  /// Mirrors web Action: generateCheckinToken
  static Future<Map<String, dynamic>?> generateToken(String userId) async {
    try {
      // 1. Cleanup existing unused tokens
      await client
          .from('checkin_tokens')
          .delete()
          .eq('visitor_id', userId)
          .eq('status', 'unused');

      // 2. Generate unique token ID (Hex string)
      final String token = _generateRandomHex(16);
      
      // 3. Fetch expiry setting
      final settings = await client.from('settings').select('qr_code_expiry_seconds').single();
      final int expirySeconds = settings['qr_code_expiry_seconds'] ?? 60;
      
      final now = DateTime.now();
      final expiresAt = now.add(Duration(seconds: expirySeconds));

      // 4. Insert into DB
      await client.from('checkin_tokens').insert({
        'id': token,
        'visitor_id': userId,
        'status': 'unused',
        'expiresAt': expiresAt.toIso8601String(),
      });

      return {
        'token': token,
        'expiresAt': expiresAt.millisecondsSinceEpoch,
        'expirySeconds': expirySeconds,
      };
    } catch (e) {
      debugPrint('Generate Token Error: $e');
      rethrow;
    }
  }

  static Future<void> deleteToken(String tokenId) async {
    try {
      await client
          .from('checkin_tokens')
          .delete()
          .eq('id', tokenId)
          .eq('status', 'unused');
    } catch (e) {
      debugPrint('Delete Token Error: $e');
    }
  }

  static Future<List<Map<String, dynamic>>> getVisitHistory(String userId, {int limit = 10}) async {
    try {
      var query = client
          .from('visits')
          .select('*, premises(name, address)')
          .eq('visitor_id', userId)
          .order('checkin_time', ascending: false);
      
      if (limit > 0) {
        query = query.limit(limit);
      }
      
      final response = await query;
      return List<Map<String, dynamic>>.from(response);
    } catch (e) {
      debugPrint('Fetch History Error: $e');
      return [];
    }
  }

  /// Fetches token-related logs for the ledger
  static Future<List<Map<String, dynamic>>> getLedgerRecords(String userId) async {
    try {
      final response = await client
          .from('logs')
          .select()
          .eq('actorId', userId)
          .inFilter('action', ['TOKEN_PURCHASE', 'VISITOR_CHECKIN_COST', 'INITIAL_TOKEN_ALLOCATION', 'REFERRAL_WELCOME_TOKENS'])
          .order('timestamp', ascending: false);
      
      return List<Map<String, dynamic>>.from(response);
    } catch (e) {
      debugPrint('Fetch Ledger Error: $e');
      return [];
    }
  }

  /// Fetches referral stats and linked events
  static Future<Map<String, dynamic>> getReferralStats(String userId) async {
    try {
      final userResponse = await client
          .from('users')
          .select('referral_code, referral_commission_balance')
          .eq('id', userId)
          .single();

      final referralsResponse = await client
          .from('referrals')
          .select('*, referee:users!referrals_referee_id_fkey(name)')
          .eq('referrer_id', userId)
          .order('created_at', ascending: false);

      return {
        'referral_code': userResponse['referral_code'] ?? '',
        'balance': userResponse['referral_commission_balance'] ?? 0,
        'referrals': referralsResponse,
      };
    } catch (e) {
      debugPrint('Fetch Referral Stats Error: $e');
      return {
        'referral_code': '',
        'balance': 0,
        'referrals': [],
      };
    }
  }

  static String _generateRandomHex(int length) {
    var random = Random.secure();
    var values = List<int>.generate(length, (i) => random.nextInt(256));
    return values.map((e) => e.toRadixString(16).padLeft(2, '0')).join();
  }
}
