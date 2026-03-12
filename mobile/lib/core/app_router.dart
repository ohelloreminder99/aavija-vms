import 'package:go_router/go_router.dart';
import '../features/auth/login_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/dashboard/role_selection_screen.dart';
import '../features/visitors/scanner_screen.dart';
import '../features/visitors/visitor_dashboard.dart';
import '../features/gatekeeper/gatekeeper_dashboard.dart';
import '../features/visitors/passport_qr_screen.dart';
import '../features/owner/owner_dashboard.dart';
import '../features/admin/admin_dashboard.dart';
import '../features/agent/agent_dashboard.dart';
import '../features/visitors/history_screen.dart';
import '../features/visitors/ledger_screen.dart';
import '../features/visitors/share_earn_screen.dart';
import '../features/visitors/gst_details_screen.dart';

import '../features/auth/welcome_screen.dart';
import '../features/auth/signup_screen.dart';
import '../services/supabase_service.dart';

final appRouter = GoRouter(
  initialLocation: '/',
  redirect: (context, state) {
    final session = SupabaseService.client.auth.currentSession;
    final isLoggedIn = session != null;
    final isAuthPage = state.matchedLocation == '/' || 
                       state.matchedLocation == '/login' || 
                       state.matchedLocation == '/signup';

    if (isLoggedIn && isAuthPage) {
      return '/role-selection';
    }
    
    return null;
  },
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const WelcomeScreen(),
    ),
    GoRoute(
      path: '/signup',
      builder: (context, state) => const SignUpScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/role-selection',
      builder: (context, state) => const RoleSelectionScreen(),
    ),
    GoRoute(
      path: '/dashboard',
      builder: (context, state) => const DashboardScreen(),
    ),
    GoRoute(
      path: '/dashboard/visitor',
      builder: (context, state) => const VisitorDashboard(),
    ),
    GoRoute(
      path: '/scanner/passport',
      builder: (context, state) => const PassportQRScreen(),
    ),
    GoRoute(
      path: '/dashboard/owner',
      builder: (context, state) {
        final premiseId = state.uri.queryParameters['premiseId'];
        return OwnerDashboard(premiseId: premiseId);
      },
    ),
    GoRoute(
      path: '/dashboard/admin',
      builder: (context, state) => const AdminDashboard(),
    ),
    GoRoute(
      path: '/dashboard/agent',
      builder: (context, state) => const AgentDashboard(),
    ),
    GoRoute(
      path: '/dashboard/gatekeeper',
      builder: (context, state) {
        final premiseId = state.uri.queryParameters['premiseId'];
        return GatekeeperDashboard(premiseId: premiseId);
      },
    ),
    GoRoute(
      path: '/scanner',
      builder: (context, state) => const ScannerScreen(),
    ),
    GoRoute(
      path: '/dashboard/visitor/history',
      builder: (context, state) => const HistoryScreen(),
    ),
    GoRoute(
      path: '/ledger',
      builder: (context, state) => const LedgerScreen(),
    ),
    GoRoute(
      path: '/share-earn',
      builder: (context, state) => const ShareEarnScreen(),
    ),
    GoRoute(
      path: '/gst-details',
      builder: (context, state) => const GstDetailsScreen(),
    ),
  ],
);
