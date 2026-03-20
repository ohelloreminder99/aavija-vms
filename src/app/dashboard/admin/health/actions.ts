'use server';

/**
 * AAVIJA VMS — Admin Health Dashboard Actions
 * Fetches live system health metrics for the /dashboard/admin/health page.
 * All queries are optimized for speed (small explicit selects, COUNT only).
 */

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { withTiming } from '@/lib/with-timing';

export interface HealthMetrics {
  // Premise & Visit activity
  totalPremises: number;
  activePremises: number;
  activeCheckinsNow: number;
  totalVisitsToday: number;
  // Applications pipeline
  pendingApplications: number;
  approvedLast7Days: number;
  // Users
  totalUsers: number;
  newUsersToday: number;
  unverifiedUsers: number;
  // System
  totalLogs24h: number;
  fetchedAt: string;
}

export async function getHealthMetrics(): Promise<{
  success: boolean;
  data?: HealthMetrics;
  error?: string;
}> {
  const adminDb = await getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
  if (!adminDb) return { success: false, error: 'DB not available' };

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const last24h   = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      premisesRes,
      activePremisesRes,
      activeCheckinsRes,
      visitsRes,
      pendingAppsRes,
      approvedAppsRes,
      usersRes,
      newUsersRes,
      unverifiedRes,
      logsRes,
    ] = await withTiming('getHealthMetrics', () =>
      Promise.all([
        adminDb.from('premises').select('id', { count: 'exact', head: true }),
        adminDb.from('premises').select('id', { count: 'exact', head: true }).eq('is_active', true),
        adminDb.from('visits').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        adminDb.from('visits').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
        adminDb.from('premise_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        adminDb.from('premise_applications').select('id', { count: 'exact', head: true }).eq('status', 'approved').gte('reviewed_at', last7Days),
        adminDb.from('users').select('id', { count: 'exact', head: true }),
        adminDb.from('users').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
        adminDb.from('users').select('id', { count: 'exact', head: true }).eq('is_verified', false),
        adminDb.from('logs').select('id', { count: 'exact', head: true }).gte('timestamp', last24h),
      ])
    , { slowThresholdMs: 3000, context: { page: 'health' } });

    const data: HealthMetrics = {
      totalPremises:       premisesRes.count ?? 0,
      activePremises:      activePremisesRes.count ?? 0,
      activeCheckinsNow:   activeCheckinsRes.count ?? 0,
      totalVisitsToday:    visitsRes.count ?? 0,
      pendingApplications: pendingAppsRes.count ?? 0,
      approvedLast7Days:   approvedAppsRes.count ?? 0,
      totalUsers:          usersRes.count ?? 0,
      newUsersToday:       newUsersRes.count ?? 0,
      unverifiedUsers:     unverifiedRes.count ?? 0,
      totalLogs24h:        logsRes.count ?? 0,
      fetchedAt:           new Date().toISOString(),
    };

    return { success: true, data };
  } catch (err: any) {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureException(err, { extra: { context: 'getHealthMetrics' } });
    return { success: false, error: err.message };
  }
}
