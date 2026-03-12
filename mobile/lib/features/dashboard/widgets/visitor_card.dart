import 'package:flutter/material.dart';
import '../../../models/visitor_model.dart';
import '../../../core/app_theme.dart';
import 'package:intl/intl.dart';

class VisitorCard extends StatelessWidget {
  final VisitorModel visitor;

  const VisitorCard({super.key, required this.visitor});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: AppTheme.cardBg,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: visitor.status == 'Pending' 
              ? Colors.amber.withValues(alpha: 0.2) 
              : AppTheme.primaryBlue.withValues(alpha: 0.2),
          child: Icon(
            visitor.type == 'Delivery' ? Icons.delivery_dining : Icons.person,
            color: visitor.status == 'Pending' ? Colors.amber : AppTheme.primaryBlue,
          ),
        ),
        title: Text(
          visitor.name,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Text(
          '${visitor.type} • ${DateFormat('hh:mm a').format(visitor.entryTime)}',
          style: const TextStyle(color: Colors.white54),
        ),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: visitor.status == 'Pending' 
                ? Colors.amber.withValues(alpha: 0.1) 
                : Colors.green.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            visitor.status,
            style: TextStyle(
              color: visitor.status == 'Pending' ? Colors.amber : Colors.green,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }
}
