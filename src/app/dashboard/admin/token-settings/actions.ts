'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { Settings } from '@/services/settings-service';

export async function updateSettingsAction(data: Partial<Settings>) {
    const adminDb = getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
    if (!adminDb) {
        return { success: false, error: 'Admin database not available.' };
    }

    // Basic validation that they are an admin
    // For extra security, you could also pull the session cookie here and verify their role.

    try {
        const { error } = await adminDb
            .from('settings')
            .upsert({ id: 'global', ...data });

        if (error) {
            console.error('Supabase update settings error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err: any) {
        console.error('Failed to execute update settings action:', err);
        return { success: false, error: err.message || 'An unexpected error occurred.' };
    }
}
