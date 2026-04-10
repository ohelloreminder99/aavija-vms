'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function removeUserPhoneNumber(user_id: string): Promise<{ success: boolean; error?: string }> {
    if (!user_id) {
        return { success: false, error: 'User ID is required.' };
    }

    const adminDb = await getAdminDb();
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') throw new Error('Unauthorized');

    if (!adminDb) {
        return {
            success: false,
            error: 'Could not access Database with admin privileges. This may be due to missing server credentials in this environment.',
        };
    }

    try {
        // Update Auth: Remove phone number
        const { error: authError } = await adminDb.auth.admin.updateUserById(user_id, {
            phone: '',
        });
        if (authError) throw authError;

        // Update Database: Clear phone fields and set is_verified to false
        const { error: dbError } = await adminDb.from('users').update({
            phone: '',
            is_verified: false,
        }).eq('id', user_id);
        if (dbError) throw dbError;

        revalidatePath('/dashboard/admin/all-users');
        return { success: true };

    } catch (error: any) {
        console.error(`Error removing phone number for user ${user_id}:`, error);

        return {
            success: false,
            error: error.message || 'An unknown server error occurred while removing the phone number.',
        };
    }
}
