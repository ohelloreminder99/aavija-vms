import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/visitor_model.dart';
import '../services/supabase_service.dart';

final visitorsProvider = StreamProvider<List<VisitorModel>>((ref) {
  final client = SupabaseService.client;
  
  return client
      .from('visitors')
      .stream(primaryKey: ['id'])
      .order('entry_time', ascending: false)
      .limit(20)
      .map((data) => data.map((json) => VisitorModel.fromJson(json)).toList());
});

final activeVisitorsCountProvider = Provider<int>((ref) {
  final visitors = ref.watch(visitorsProvider).value ?? [];
  return visitors.where((v) => v.status != 'Checked-out').length;
});
