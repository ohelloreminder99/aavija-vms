'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { LogAction } from '@/services/log-actions';
import { StaffMember } from '@/services/premise-service';
import { createLogEntry } from '@/services/log-service';

interface GatekeeperData {
  name: string;
  email: string;
  password: string;
  premiseId: string;
  premiseCity: string;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}

export async function createGatekeeper(
  data: GatekeeperData
): Promise<{ success: boolean; error?: string }> {
  const { name, email, password, premiseId, premiseCity, actor } = data;

  if (!name || !email || !password || !premiseId || !premiseCity) {
    return { success: false, error: 'All fields are required.' };
  }
  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' };
  }

  const adminDb = await getAdminDb();

  if (!adminDb) {
    return {
      success: false,
      error: 'Could not access Supabase with admin privileges.',
    };
  }

  try {
    const { user, profile } = await requireAuth();
    if (profile.role !== 'admin') {
      const { data: permCheck } = await adminDb.from('premises').select('owner_id').eq('id', premiseId).single();
      if (!permCheck || permCheck.owner_id !== user.id) throw new Error('Unauthorized: You do not own this premise.');
    }

    const { data: authData, error: authError } = await adminDb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Failed to create user.");

    const gatekeeperUid = authData.user.id;

    const { data: existingUser } = await adminDb.from('users').select('id').eq('id', gatekeeperUid).single();

    const { data: settingsData } = await adminDb.from('settings').select('*').eq('id', 'global').single();
    const startingVisitorTokens = settingsData?.starting_token_visitor || 0;

    const userPayload = {
      id: gatekeeperUid,
      name,
      email,
      role: 'visitor',
      is_active: true,
      premise_roles: {
        [premiseId]: ['gatekeeper']
      },
      is_verified: false,
      token_balance_visitor: startingVisitorTokens,
      global_rating: 0,
      active_checkin_id: null,
      photo_url: '',
      city: premiseCity,
    };

    if (existingUser) {
      await adminDb.from('users').update(userPayload).eq('id', gatekeeperUid);
    } else {
      await adminDb.from('users').insert(userPayload);
    }

    const newStaffMember: StaffMember = {
      uid: gatekeeperUid,
      name: name,
      email: email,
      role: 'gatekeeper',
      is_active: true,
      photo_url: ''
    };

    const { data: premiseDoc } = await adminDb.from('premises').select('*').eq('id', premiseId).single();
    if (premiseDoc) {
      const staff = (premiseDoc.staff || []) as StaffMember[];
      staff.push(newStaffMember);
      const gkCount = (premiseDoc.gatekeeper_count || 0) + 1;

      await adminDb.from('premises').update({ staff, gatekeeper_count: gkCount }).eq('id', premiseId);
    }

    await createLogEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: LogAction.GATEKEEPER_CREATED,
      description: `Owner "${actor.name}" created new gatekeeper "${name}".`
    });

    revalidatePath('/dashboard/owner/gatekeepers');
    return { success: true };
  } catch (error: any) {
    console.error('Error creating gatekeeper:', error);
    const msg = error.message || '';

    if (msg.includes('already exists') || msg.includes('User already registered') || msg.toLowerCase().includes('email exists')) {
      return {
        success: false,
        error: 'USER_ALREADY_EXISTS',
      };
    }

    return {
      success: false,
      error: msg || 'An unknown server error occurred.',
    };
  }
}

interface AssignGatekeeperByEmailPayload {
  email: string;
  premiseId: string;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}

export async function assignGatekeeperRoleByEmail(payload: AssignGatekeeperByEmailPayload): Promise<{ success: boolean; error?: string }> {
  const { email, premiseId, actor } = payload;
  const adminDb = await getAdminDb();
  if (!adminDb) {
    return { success: false, error: 'Admin database not available.' };
  }

  try {
    const { user, profile } = await requireAuth();
    if (profile.role !== 'admin') {
      const { data: permCheck } = await adminDb.from('premises').select('owner_id').eq('id', premiseId).single();
      if (!permCheck || permCheck.owner_id !== user.id) throw new Error('Unauthorized: You do not own this premise.');
    }

    const { data: userDoc } = await adminDb.from('users').select('*').eq('email', email).single();
    if (!userDoc) {
      return { success: false, error: 'No user found with that email address.' };
    }

    if (userDoc?.premise_roles?.[premiseId]?.includes('gatekeeper')) {
      return { success: false, error: `This user is already a gatekeeper at this premise.` };
    }

    const currentRoles = userDoc.premise_roles || {};
    const premiseRoles = currentRoles[premiseId] || [];
    if (!premiseRoles.includes('gatekeeper')) premiseRoles.push('gatekeeper');
    currentRoles[premiseId] = premiseRoles;

    await adminDb.from('users').update({ premise_roles: currentRoles }).eq('id', userDoc.id);

    const newStaffMember: StaffMember = {
      uid: userDoc.id,
      name: userDoc.name,
      email: userDoc.email,
      role: 'gatekeeper',
      is_active: userDoc.is_active ?? true,
      photo_url: userDoc.photo_url || ''
    };

    const { data: premiseDoc } = await adminDb.from('premises').select('*').eq('id', premiseId).single();
    if (premiseDoc) {
      const staff = (premiseDoc.staff || []) as StaffMember[];
      staff.push(newStaffMember);
      const gkCount = (premiseDoc.gatekeeper_count || 0) + 1;

      await adminDb.from('premises').update({ staff, gatekeeper_count: gkCount }).eq('id', premiseId);
    }

    await createLogEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: LogAction.GATEKEEPER_CREATED,
      description: `Owner "${actor.name}" assigned gatekeeper role to existing user "${userDoc.name}" (${email}).`
    });

    revalidatePath('/dashboard/owner/gatekeepers');
    return { success: true };

  } catch (e: any) {
    console.error("Error assigning gatekeeper role:", e);
    return { success: false, error: e.message || 'An unknown server error occurred.' };
  }
}

export async function deleteGatekeeper(uid: string, premiseId: string): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Delete functionality not yet implemented.' };
}
