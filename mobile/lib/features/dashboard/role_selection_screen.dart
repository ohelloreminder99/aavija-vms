import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';
import '../../core/app_theme.dart';

class RoleSelectionScreen extends ConsumerWidget {
  const RoleSelectionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(userProfileProvider);

    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          color: Color(0xFF020617), // Deep Obsidian matching web
        ),
        child: profileAsync.when(
          data: (profile) => _buildRoleList(context, profile ?? {}),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, stack) => Center(child: Text('Error loading roles: $err')),
        ),
      ),
    );
  }

  Widget _buildRoleList(BuildContext context, Map<String, dynamic> profile) {
    final String mainRole = profile['role'] ?? 'visitor';
    final Map<String, dynamic> premiseRoles = profile['premise_roles'] ?? {};
    final bool isAgent = profile['is_agent'] ?? false;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          children: [
            const SizedBox(height: 60),
            _buildHeader(),
            const SizedBox(height: 48),
            Expanded(
              child: ListView(
                children: [
                   _RoleCard(
                    title: 'Act as Visitor',
                    description: 'Generate check-in tokens and manage your history',
                    icon: Icons.person_outline,
                    onTap: () => context.go('/dashboard/visitor'),
                  ),
                  if (mainRole == 'admin')
                    _RoleCard(
                      title: 'Act as Admin',
                      description: 'Full governance control over regional operations',
                      icon: Icons.admin_panel_settings_outlined,
                      onTap: () => context.go('/dashboard/admin'),
                    ),
                  if (mainRole == 'staff')
                    _RoleCard(
                      title: 'Act as Staff',
                      description: 'Execute assigned security protocols',
                      icon: Icons.badge_outlined,
                      onTap: () => context.go('/dashboard/staff'),
                    ),
                  if (isAgent)
                    _RoleCard(
                      title: 'Act as Agent',
                      description: 'Manage ecosystem expansion and earnings',
                      icon: Icons.wallet_outlined,
                      onTap: () => context.go('/dashboard/agent'),
                    ),
                  
                  // Dynamic Premise Roles
                  ..._buildPremiseRoleCards(context, premiseRoles),
                  
                  const SizedBox(height: 32),
                  const Divider(color: Colors.white10),
                  _RoleCard(
                    title: 'Security Settings',
                    description: 'Update your pin and session settings',
                    icon: Icons.lock_outline,
                    onTap: () => context.push('/settings'),
                    isSettings: true,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          decoration: BoxDecoration(
            color: AppTheme.primaryBlue.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppTheme.primaryBlue.withValues(alpha: 0.2)),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.shield, size: 14, color: AppTheme.primaryBlue),
              SizedBox(width: 8),
              Text(
                'SECURE SESSION ACTIVE',
                style: TextStyle(
                  color: AppTheme.primaryBlue,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        const Text(
          'Select Your Role',
          style: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Choose how you want to continue',
          style: TextStyle(color: Colors.white38, fontSize: 16),
        ),
      ],
    );
  }

  List<Widget> _buildPremiseRoleCards(BuildContext context, Map<String, dynamic> premiseRoles) {
    List<Widget> cards = [];
    premiseRoles.forEach((premiseId, roles) {
      final rolesList = (roles is List) ? roles : [roles];
      for (var role in rolesList) {
        String title = '';
        IconData icon = Icons.help_outline;
        String route = '';
        
        switch (role) {
          case 'owner':
            title = 'Owner';
            icon = Icons.business_outlined;
            route = '/dashboard/owner';
            break;
          case 'gatekeeper':
            title = 'Gatekeeper';
            icon = Icons.security_outlined;
            route = '/dashboard/gatekeeper';
            break;
          case 'host':
            title = 'Host';
            icon = Icons.vpn_key_outlined;
            route = '/dashboard/host';
            break;
        }

        if (title.isNotEmpty) {
          cards.add(_RoleCard(
            title: 'Act as $title',
            description: 'Manage flow for linked premise',
            icon: icon,
            onTap: () => context.go('$route?premiseId=$premiseId'),
          ));
        }
      }
    });
    return cards;
  }
}

class _RoleCard extends StatelessWidget {
  final String title;
  final String description;
  final IconData icon;
  final VoidCallback onTap;
  final bool isSettings;

  const _RoleCard({
    required this.title,
    required this.description,
    required this.icon,
    required this.onTap,
    this.isSettings = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(icon, color: Colors.white, size: 28),
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        description,
                        style: const TextStyle(
                          color: Colors.white38,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.arrow_forward_ios, color: Colors.white24, size: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
