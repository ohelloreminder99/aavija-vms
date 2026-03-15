'use server';

import { getAdminDb } from '@/lib/supabase/server';
import { headers } from 'next/headers';

export async function checkAuthRateLimit(): Promise<{ success: boolean; error?: string }> {
  const adminDb = await getAdminDb();
  if (!adminDb) return { success: true }; // Fallback to allow if DB fails

  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for') || '127.0.0.1';

  try {
    const { data: settings } = await adminDb
      .from('settings')
      .select('auth_rate_limit, is_maintenance_mode, maintenance_message')
      .eq('id', 'global')
      .single();

    if (settings?.is_maintenance_mode) {
      return { success: false, error: settings.maintenance_message };
    }

    const maxRequests = settings?.auth_rate_limit || 10;
    
    // Call the check_rate_limit RPC
    const { data: allowed, error } = await adminDb.rpc('check_rate_limit', {
      p_key: `auth:${ip}`,
      p_max_requests: maxRequests
    });

    if (error) {
      console.error('[RateLimit] RPC error:', error);
      return { success: true }; // Fail open for auth usually better unless high attack
    }

    if (!allowed) {
      return { success: false, error: `Too many login attempts. Please try again in a minute.` };
    }

    return { success: true };
  } catch (err) {
    console.error('[RateLimit] Failed to check auth rate limit:', err);
    return { success: true };
  }
}
