'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';

/**
 * A Server Action to find orphaned Authentication users.
 * An orphaned user is one who exists in Auth but does not have a
 * corresponding document in the 'users' table.
 */
export async function getOrphanedAuthUsers() {
  const adminDb = getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');

  if (!adminDb) {
    const errorMessage =
      'Admin SDK not initialized.';
    console.error('getOrphanedAuthUsers:', errorMessage);
    return { success: false, error: errorMessage };
  }

  try {
    // 1. Fetch all users from Authentication
    const { data: listUsersResult, error: listAuthError } = await adminDb.auth.admin.listUsers();
    if (listAuthError) throw listAuthError;
    const authUsers = listUsersResult.users;

    // 2. Fetch all user document IDs from Database
    const { data: userDocs, error: listDbError } = await adminDb.from('users').select('id');
    if (listDbError) throw listDbError;
    const firestoreUserIds = new Set(userDocs.map((doc: any) => doc.id));

    // 3. Find the users that are in Auth but not in Database
    const orphanedUsers = authUsers.filter(
      (user: any) => !firestoreUserIds.has(user.id)
    );

    // 4. Return a serializable list of the orphaned users' data
    return {
      success: true,
      users: orphanedUsers.map((user: any) => ({
        uid: user.id,
        email: user.email,
        creationTime: user.created_at,
        lastSignInTime: user.last_sign_in_at,
      })),
    };
  } catch (error: any) {
    console.error('Error getting orphaned auth users:', error);

    // Return a serializable error object for other types of errors
    return {
      success: false,
      error: error.message || 'An unknown server error occurred.',
    };
  }
}

/**
 * A Server Action to delete an Authentication user.
 * This is intended for cleaning up orphaned users.
 */
export async function deleteAuthUser(uid: string): Promise<{ success: boolean; error?: string }> {
  if (!uid) {
    return { success: false, error: 'User ID is required.' };
  }

  const adminDb = getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');

  if (!adminDb) {
    return {
      success: false,
      error: 'Could not access Database with admin privileges.',
    };
  }

  try {
    const { error: deleteError } = await adminDb.auth.admin.deleteUser(uid);
    if (deleteError) throw deleteError;
    return { success: true };
  } catch (error: any) {
    console.error(`Error deleting auth user ${uid}:`, error);

    return {
      success: false,
      error: error.message || 'An unknown server error occurred while deleting the user.',
    };
  }
}
