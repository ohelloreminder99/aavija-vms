import 'package:flutter/foundation.dart';
import '../services/supabase_service.dart';
import '../models/visitor_model.dart';

class QrVerificationService {
  static final client = SupabaseService.client;

  /// Step 1: Lookup the visitor by checkin_token table (Identical to Web)
  static Future<Map<String, dynamic>?> processScannedToken(String tokenId) async {
    try {
      // 1. Fetch token data
      final tokenData = await client
          .from('checkin_tokens')
          .select()
          .eq('id', tokenId)
          .eq('status', 'unused')
          .maybeSingle();

      if (tokenData == null) {
        throw Exception('Invalid or already used QR code.');
      }

      // Check Expiry
      final expiresAt = DateTime.parse(tokenData['expiresAt']);
      if (expiresAt.isBefore(DateTime.now())) {
        await client.from('checkin_tokens').update({'status': 'expired'}).eq('id', tokenId);
        throw Exception('Expired QR code.');
      }

      // 2. Fetch Visitor Profile
      final visitorData = await client
          .from('users')
          .select('*, active_checkin_id')
          .eq('id', tokenData['visitor_id'])
          .single();

      return {
        'token': tokenData,
        'visitor': VisitorModel.fromJson(visitorData),
      };
    } catch (e) {
      debugPrint('Process Token Error: $e');
      rethrow;
    }
  }

  /// Step 2: Fetch available hosts (staff) for the premise
  static Future<List<HostModel>> getHostsForPremise(String premiseId) async {
    try {
      // According to web logic, hosts are stored in premise.staff (JSONB) 
      // or we can fetch verified 'host' role users for that premise
      final response = await client
          .from('premises')
          .select('staff')
          .eq('id', premiseId)
          .single();

      final List staffList = response['staff'] ?? [];
      return staffList
          .where((s) => s['role'] == 'host' && s['is_active'] == true && s['uid'] != null)
          .map((json) {
            return HostModel(
              id: json['uid'],
              name: json['name'] ?? 'Unknown',
              identity: json['identity'] ?? 'N/A',
              photoUrl: json['photo_url'],
              isDisabled: false, // Balance checks would happen on selection
            );
          }).toList();
    } catch (e) {
      debugPrint('Fetch Hosts Error: $e');
      return [];
    }
  }

  /// Step 3: Finalize Check-in with Token Deductions (RPC Parity)
  static Future<bool> finalizeCheckin({
    required String tokenId,
    required String visitorId,
    required String hostId,
    required String premiseId,
    required String gatekeeperId,
  }) async {
    try {
      // 1. Fetch Premise Category to determine deduction rates
      final premise = await client.from('premises').select('categoryId, token_balance').eq('id', premiseId).single();
      final category = await client.from('premise_categories').select().eq('id', premise['categoryId']).single();
      
      final int visitorDeduction = category['deduction_rate_visitor'] ?? 0;
      final int premiseDeduction = category['deduction_rate_premise'] ?? 0;
      final String categoryType = category['type'] ?? 'industrial';

      // 2. Perform Atomic Deductions via RPC
      if (categoryType == 'industrial' && premiseDeduction > 0) {
        await client.rpc('deduct_premise_tokens', params: {
          'p_premise_id': premiseId,
          'p_amount': premiseDeduction,
        });
      } else if (categoryType == 'residential' && premiseDeduction > 0) {
        await client.rpc('deduct_user_tokens', params: {
          'p_user_id': hostId,
          'p_amount': premiseDeduction,
        });
      }

      if (visitorDeduction > 0) {
        await client.rpc('deduct_user_tokens', params: {
          'p_user_id': visitorId,
          'p_amount': visitorDeduction,
        });
      }

      // 3. Create Visit Record
      final visitResponse = await client.from('visits').insert({
        'visitor_id': visitorId,
        'host_id': hostId,
        'premise_id': premiseId,
        'checkin_time': DateTime.now().toIso8601String(),
        'status': 'active',
      }).select('id').single();

      final String visitId = visitResponse['id'];

      // 4. Update Visitor active checkin
      await client.from('users').update({'active_checkin_id': visitId}).eq('id', visitorId);

      // 5. Cleanup Token
      await client.from('checkin_tokens').delete().eq('id', tokenId);

      // 6. WhatsApp Arrival Notification (Hero Web Parity)
      // Logic: sendVisitorArrivalNotification call
      // Since we use Edge Functions/Server side for Meta Tokens:
      _triggerWhatsAppNotification(visitorId, hostId, premiseId);

      // 7. Audit Logging
      await client.from('logs').insert({
        'actorId': gatekeeperId,
        'action': 'VISITOR_CHECKIN',
        'description': 'Verified visitor check-in to $premiseId',
        'premiseId': premiseId,
        'context': {'visitId': visitId, 'visitorId': visitorId, 'hostId': hostId}
      });

      return true;
    } catch (e) {
      debugPrint('Finalize Error: $e');
      return false;
    }
  }

  static void _triggerWhatsAppNotification(String visitorId, String hostId, String premiseId) {
    // In production, this would call a Supabase Edge Function:
    // client.functions.invoke('send-whatsapp-notification', body: {...})
    debugPrint('WhatsApp Notification Triggered for Host: $hostId');
  }
}
