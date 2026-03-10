'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';

/**
 * Finds and deletes all expired or used QR check-in tokens.
 */
export async function cleanupQrTokens(): Promise<{ success: boolean; count?: number; error?: string }> {
    const adminDb = await getAdminDb();
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') throw new Error('Unauthorized');
    if (!adminDb) {
        return { success: false, error: "Server database connection not available." };
    }

    try {
        const now = new Date().toISOString();

        const { count, error } = await adminDb
            .from('checkin_tokens')
            .delete({ count: 'exact' })
            .or(`expiresAt.lt.${now},status.eq.used`);

        if (error) throw error;

        return { success: true, count: count || 0 };
    } catch (e: any) {
        console.error("Token cleanup error:", e);
        return { success: false, error: e.message || "An unknown error occurred." };
    }
}
