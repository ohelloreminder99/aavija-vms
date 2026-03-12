import 'package:flutter/foundation.dart';
import '../services/supabase_service.dart';

class VisitCheckoutService {
  static final client = SupabaseService.client;

  static Future<bool> checkoutVisitor({
    required String visitId,
    required String visitorId,
    required String? premiseId,
    String? gatekeeperId,
  }) async {
    try {
      // 1. Update Visit status
      await client.from('visits').update({
        'status': 'completed',
        'checkout_time': DateTime.now().toIso8601String(),
      }).eq('id', visitId);

      // 2. Clear visitor's active checkin
      await client.from('users').update({
        'active_checkin_id': null,
      }).eq('id', visitorId);

      // 3. Audit Log
      await client.from('logs').insert({
        'actorId': gatekeeperId ?? visitorId,
        'action': 'VISITOR_CHECKOUT',
        'description': gatekeeperId != null 
            ? 'Visitor checkout verified by gatekeeper: $gatekeeperId'
            : 'Visitor self-checkout initiated (Legacy)',
        'premiseId': premiseId,
        'context': {'visitId': visitId, 'visitorId': visitorId}
      });

      return true;
    } catch (e) {
      debugPrint('Checkout Error: $e');
      return false;
    }
  }
}
