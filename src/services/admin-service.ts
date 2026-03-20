'use server';

/**
 * AAVIJA VMS — Admin Service (Server-Only)
 * Author note (Phase 2A, 2026-03-07 by Antigravity):
 *   Previously createAdminRole lived in user-service.ts which is a 'use client'
 *   file and used the anon Supabase client. Any authenticated user who called it
 *   could potentially elevate their own role to 'admin' if RLS had any gap.
 *
 *   This file is 'use server' ONLY. It uses getAdminDb() (service role key)
 *   for all writes. Every function verifies the calling user is already an
 *   admin via requireAuth() before doing anything sensitive.
 *
 *   NEVER import this file into client components.
 *   NEVER downgrade this to the anon client for admin mutations.
 */

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const UserIdSchema = z.string().uuid();
const UpdateUserSchema = z.record(z.any());

/**
 * Grants admin role to a user.
 * Can only be called by an existing admin.
 * @param targetUserId The UID of the user to promote to admin.
 */
export async function grantAdminRole(targetUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Validation
        UserIdSchema.parse(targetUserId);

        // Verify the caller is already an admin
        const { profile: callerProfile } = await requireAuth();
        if (callerProfile.role !== 'admin') {
            throw new Error('Unauthorized: Only admins can grant admin roles.');
        }

        const adminDb = await getAdminDb();
        if (!adminDb) throw new Error('Admin database not available.');

        const { error } = await adminDb
            .from('users')
            .update({ role: 'admin' })
            .eq('id', targetUserId);

        if (error) throw error;

        revalidatePath('/dashboard/admin/all-users');
        return { success: true };
    } catch (e: any) {
        console.error('Error granting admin role:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Revokes admin role from a user (demotes to 'visitor').
 * Can only be called by an existing admin.
 * @param targetUserId The UID of the user to demote.
 */
export async function revokeAdminRole(targetUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Validation
        UserIdSchema.parse(targetUserId);

        const { user: callerUser, profile: callerProfile } = await requireAuth();
        if (callerProfile.role !== 'admin') {
            throw new Error('Unauthorized: Only admins can revoke admin roles.');
        }
        if (callerUser.id === targetUserId) {
            throw new Error('Admins cannot revoke their own admin role.');
        }

        const adminDb = await getAdminDb();
        if (!adminDb) throw new Error('Admin database not available.');

        const { error } = await adminDb
            .from('users')
            .update({ role: 'visitor' })
            .eq('id', targetUserId);

        if (error) throw error;

        revalidatePath('/dashboard/admin/all-users');
        return { success: true };
    } catch (e: any) {
        console.error('Error revoking admin role:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Updates any field on any user. Admin-only.
 * This is the only place system-managed fields (role, token_balance, is_verified)
 * should be mutated from application code. All other user updates go through
 * updateUserProfile() in user-service.ts which restricts those fields.
 */
export async function adminUpdateUser(
    targetUserId: string,
    data: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
    try {
        // Validation
        UserIdSchema.parse(targetUserId);
        UpdateUserSchema.parse(data);

        const { profile: callerProfile } = await requireAuth();
        if (callerProfile.role !== 'admin') {
            throw new Error('Unauthorized: Only admins can perform this operation.');
        }

        const adminDb = await getAdminDb();
        if (!adminDb) throw new Error('Admin database not available.');

        const { error } = await adminDb
            .from('users')
            .update(data)
            .eq('id', targetUserId);

        if (error) throw error;

        revalidatePath('/dashboard/admin/all-users');
        return { success: true };
    } catch (e: any) {
        console.error('Error in adminUpdateUser:', e);
        return { success: false, error: e.message };
    }
}
