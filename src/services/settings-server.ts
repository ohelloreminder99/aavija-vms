'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Server-only helper to check for maintenance mode.
 * Throws an error if maintenance mode is active.
 */
export async function ensureNotMaintenanceMode() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('settings')
    .select('is_maintenance_mode, maintenance_message')
    .eq('id', 'global')
    .single();

  if (settings?.is_maintenance_mode) {
    throw new Error(settings.maintenance_message || 'System is undergoing maintenance. Please try again later.');
  }
}
