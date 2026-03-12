import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/supabase_service.dart';

class OwnerService {
  static final client = SupabaseService.client;

  static Future<Map<String, dynamic>> getPremiseStats(String premiseId) async {
    try {
      // Correct v2 syntax for count:
      // select() returns a builder, call count() on it.
      final response = await client
          .from('visits')
          .select('id')
          .eq('premise_id', premiseId)
          .count(CountOption.exact);
      
      // In latest versions, .count() makes it return a PostgrestResponse with data and count.
      // However, if we only want the count, the response will have it.
      final int count = (response as dynamic).count ?? 0;

      // 2. Fetch premise details (host_count, gatekeeper_count)
      final premiseResponse = await client
          .from('premises')
          .select('host_count, gatekeeper_count, name')
          .eq('id', premiseId)
          .single();

      return {
        'visitCount': count,
        'hostCount': premiseResponse['host_count'] ?? 0,
        'gatekeeperCount': premiseResponse['gatekeeper_count'] ?? 0,
        'name': premiseResponse['name'] ?? 'Unknown',
      };
    } catch (e) {
      debugPrint('Fetch Premise Stats Error: $e');
      return {
        'visitCount': 0,
        'hostCount': 0,
        'gatekeeperCount': 0,
        'name': 'Error',
      };
    }
  }
}
