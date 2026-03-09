'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';

/**
 * Deletes all documents within the 'logs' collection.
 * This is a destructive action and should be used with extreme caution.
 */
export async function deleteAllLogs(): Promise<{ success: boolean; error?: string }> {
    const adminDb = getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
    if (!adminDb) {
        return { success: false, error: "Admin database connection is not available." };
    }

    try {
        const { error } = await adminDb.from('logs').delete().not('id', 'is', null);
        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting all logs:', error);
        return { success: false, error: error.message || 'An unknown error occurred during log cleanup.' };
    }
}
