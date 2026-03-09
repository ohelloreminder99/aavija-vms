'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { LogAction } from '@/services/log-actions';
import { createLogEntry } from '@/services/log-service';

interface StaffData {
  name: string;
  email: string;
  password: string;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}

export async function createStaffUser(
  data: StaffData
): Promise<{ success: boolean; error?: string }> {
  const { name, email, password, actor } = data;

  if (!name || !email || !password) {
    return { success: false, error: 'All fields are required.' };
  }
  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' };
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
    const { data: userRecord, error: authError } = await adminDb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: name,
      }
    });

    if (authError) throw authError;
    if (!userRecord || !userRecord.user) throw new Error("Failed to create user");

    const staffUid = userRecord.user.id;

    // Fetch settings to get initial tokens
    const { data: settingsData } = await adminDb.from('settings').select('starting_token_visitor').eq('id', 'global').single();
    const startingVisitorTokens = settingsData?.starting_token_visitor || 0;

    const { error: insertError } = await adminDb.from('users').insert({
      id: staffUid,
      name,
      email,
      role: 'staff',
      is_active: true,
      is_verified: false,
      token_balance_visitor: startingVisitorTokens,
      global_rating: 0,
      active_checkin_id: null,
      photo_url: '',
    });

    if (insertError) throw insertError;

    await createLogEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: LogAction.USER_SIGNUP, // Consider a new LogAction for STAFF_CREATED
      description: `Admin "${actor.name}" created new staff user "${name}".`
    });

    revalidatePath('/dashboard/admin/staff');
    return { success: true };
  } catch (error: any) {
    console.error('Error creating staff user:', error);

    const msg = error.message || '';

    if (msg.includes('already registered') || error.code === 'auth/email-already-exists' || msg.toLowerCase().includes('email exists')) {
      return {
        success: false,
        error: 'USER_ALREADY_EXISTS',
      };
    }
    if (msg.includes('Password should be at least')) {
      return {
        success: false,
        error: 'The password must be a string with at least 8 characters.',
      };
    }

    if (msg.includes('invalid-credential') || msg.includes('Credential') || msg.includes('Could not refresh access token')) {
      return { success: false, error: 'Could not access database with admin privileges.' };
    }

    return {
      success: false,
      error: msg || 'An unknown server error occurred.',
    };
  }
}

interface AssignStaffPayload {
  email: string;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}

export async function assignStaffRole(payload: AssignStaffPayload): Promise<{ success: boolean; error?: string }> {
  const { email } = payload;
  const adminDb = getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
  if (!adminDb) {
    return { success: false, error: 'Admin database not available.' };
  }

  try {
    const { data: userDoc, error: fetchError } = await adminDb.from('users').select('id').eq('email', email).single();
    if (fetchError || !userDoc) {
      return { success: false, error: 'No user found with that email address.' };
    }

    await adminDb.from('users').update({ role: 'staff' }).eq('id', userDoc.id);

    revalidatePath('/dashboard/admin/staff');
    return { success: true };
  } catch (e: any) {
    console.error("Error assigning staff role:", e);
    return { success: false, error: e.message || 'An unknown server error occurred.' };
  }
}

interface RemoveStaffPayload {
  staffId: string;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}

export async function removeStaffRole(payload: RemoveStaffPayload): Promise<{ success: boolean; error?: string }> {
  const { staffId } = payload;
  const adminDb = getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
  if (!adminDb) {
    return { success: false, error: 'Admin services not available.' };
  }

  try {
    // Revert the user's global role to 'visitor'
    await adminDb.from('users').update({ role: 'visitor' }).eq('id', staffId);

    revalidatePath('/dashboard/admin/staff');
    return { success: true };

  } catch (e: any) {
    console.error('Error removing staff role:', e);
    return { success: false, error: e.message || 'An unknown server error occurred.' };
  }
}

