'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { LogAction } from '@/services/log-actions';
import { StaffMember } from '@/services/premise-service';
import { createLogEntry } from '@/services/log-service';

interface HostData {
  name: string;
  email: string;
  password: string;
  identity: string;
  premiseId: string;
  premiseCity: string;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}

export async function createHost(
  data: HostData
): Promise<{ success: boolean; error?: string }> {
  const { name, email, password, identity, premiseId, premiseCity, actor } = data;

  if (!name || !email || !password || !identity || !premiseId || !premiseCity) {
    return { success: false, error: 'All fields are required.' };
  }
  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' };
  }

  const adminDb = getAdminDb();

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

    const hostUid = authData.user.id;

    // Check if user record already exists (Supabase triggers might create it)
    const { data: existingUser } = await adminDb.from('users').select('id').eq('id', hostUid).single();

    const { data: settingsData } = await adminDb.from('settings').select('*').eq('id', 'global').single();
    const startingVisitorTokens = settingsData?.starting_token_visitor || 0;

    const userPayload = {
      id: hostUid,
      name,
      email,
      role: 'visitor',
      is_active: true,
      premise_roles: {
        [premiseId]: ['host']
      },
      is_verified: false,
      token_balance_visitor: startingVisitorTokens,
      global_rating: 0,
      active_checkin_id: null,
      photo_url: '',
      city: premiseCity,
    };

    if (existingUser) {
      await adminDb.from('users').update(userPayload).eq('id', hostUid);
    } else {
      await adminDb.from('users').insert(userPayload);
    }

    const newStaffMember: StaffMember = {
      uid: hostUid,
      name: name,
      email: email,
      role: 'host',
      is_active: true,
      photo_url: '',
      identity: identity,
      availability: 'available',
    };

    const { data: premiseDoc } = await adminDb.from('premises').select('*').eq('id', premiseId).single();
    if (premiseDoc) {
      const staff = (premiseDoc.staff || []) as StaffMember[];
      staff.push(newStaffMember);
      const hostCount = (premiseDoc.host_count || 0) + 1;

      await adminDb.from('premises').update({ staff, host_count: hostCount }).eq('id', premiseId);
    }

    await createLogEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: LogAction.HOST_CREATED,
      description: `Owner "${actor.name}" created new host "${name}".`
    });

    revalidatePath('/dashboard/owner/hosts');
    return { success: true };
  } catch (error: any) {
    console.error('Error creating host:', error);

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

interface AssignHostByEmailPayload {
  email: string;
  identity: string;
  premiseId: string;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}

export async function assignHostRoleByEmail(payload: AssignHostByEmailPayload): Promise<{ success: boolean; error?: string }> {
  const { email, identity, premiseId, actor } = payload;
  const adminDb = getAdminDb();
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

    if (userDoc?.premise_roles?.[premiseId]?.includes('host')) {
      return { success: false, error: `This user is already a host at this premise.` };
    }

    const currentRoles = userDoc.premise_roles || {};
    const premiseRoles = currentRoles[premiseId] || [];
    if (!premiseRoles.includes('host')) premiseRoles.push('host');
    currentRoles[premiseId] = premiseRoles;

    await adminDb.from('users').update({ premise_roles: currentRoles }).eq('id', userDoc.id);

    const newStaffMember: StaffMember = {
      uid: userDoc.id,
      name: userDoc.name,
      email: userDoc.email,
      role: 'host',
      is_active: userDoc.is_active ?? true,
      photo_url: userDoc.photo_url || '',
      identity: identity,
      availability: 'available',
    };

    const { data: premiseDoc } = await adminDb.from('premises').select('*').eq('id', premiseId).single();
    if (premiseDoc) {
      const staff = (premiseDoc.staff || []) as StaffMember[];
      staff.push(newStaffMember);
      const hostCount = (premiseDoc.host_count || 0) + 1;

      await adminDb.from('premises').update({ staff, host_count: hostCount }).eq('id', premiseId);
    }

    await createLogEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: LogAction.HOST_CREATED,
      description: `Owner "${actor.name}" assigned host role to existing user "${userDoc.name}" (${email}).`
    });

    revalidatePath('/dashboard/owner/hosts');
    return { success: true };

  } catch (e: any) {
    console.error("Error assigning host role:", e);
    return { success: false, error: e.message || 'An unknown server error occurred.' };
  }
}


interface ToggleStatusPayload {
  hostId: string;
  hostName: string;
  newStatus: boolean;
  premiseId: string;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}


export async function toggleHostStatus(payload: ToggleStatusPayload): Promise<{ success: boolean, error?: string }> {
  const { hostId, hostName, newStatus, premiseId, actor } = payload;
  const adminDb = getAdminDb();

  if (!adminDb) {
    return { success: false, error: 'Admin database service not available.' };
  }

  try {
    const { user, profile } = await requireAuth();
    if (profile.role !== 'admin') {
      const { data: permCheck } = await adminDb.from('premises').select('owner_id').eq('id', premiseId).single();
      if (!permCheck || permCheck.owner_id !== user.id) throw new Error('Unauthorized: You do not own this premise.');
    }

    const { data: premiseDoc } = await adminDb.from('premises').select('*').eq('id', premiseId).single();

    if (!premiseDoc) {
      throw new Error("Premise not found.");
    }
    const staff = (premiseDoc.staff || []) as StaffMember[];
    const hostIndex = staff.findIndex(s => s.uid === hostId);

    if (hostIndex !== -1) {
      staff[hostIndex].is_active = newStatus;
      await adminDb.from('premises').update({ staff }).eq('id', premiseId);
    }

    await adminDb.from('users').update({ is_active: newStatus }).eq('id', hostId);

    const action = newStatus ? LogAction.HOST_ACTIVATED : LogAction.HOST_DEACTIVATED;
    const actionText = newStatus ? 'activated' : 'deactivated';

    await createLogEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: action,
      description: `Owner "${actor.name}" ${actionText} host "${hostName}".`
    });

    revalidatePath('/dashboard/owner/hosts');
    return { success: true };

  } catch (e: any) {
    console.error('Error toggling host status:', e);
    return { success: false, error: e.message || 'An unknown server error occurred.' };
  }
}

interface RemoveHostPayload {
  hostId: string;
  hostName: string;
  premiseId: string;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}

export async function removeHostFromPremise(payload: RemoveHostPayload): Promise<{ success: boolean; error?: string }> {
  const { hostId, hostName, premiseId, actor } = payload;
  const adminDb = getAdminDb();

  if (!adminDb) {
    return { success: false, error: 'Admin services not available.' };
  }

  try {
    const { user, profile } = await requireAuth();
    if (profile.role !== 'admin') {
      const { data: permCheck } = await adminDb.from('premises').select('owner_id').eq('id', premiseId).single();
      if (!permCheck || permCheck.owner_id !== user.id) throw new Error('Unauthorized: You do not own this premise.');
    }

    const { data: premiseDoc } = await adminDb.from('premises').select('*').eq('id', premiseId).single();

    if (!premiseDoc) throw new Error("Premise not found.");

    const staff = (premiseDoc.staff || []) as StaffMember[];
    const updatedStaff = staff.filter(s => s.uid !== hostId);
    const newCount = (premiseDoc.host_count || 1) - 1;

    await adminDb.from('premises').update({
      staff: updatedStaff,
      host_count: newCount
    }).eq('id', premiseId);

    const { data: userDoc } = await adminDb.from('users').select('*').eq('id', hostId).single();
    if (userDoc) {
      const currentRoles = userDoc.premise_roles || {};
      const premiseRoles = currentRoles[premiseId] || [];
      const newPremiseRoles = premiseRoles.filter((r: string) => r !== 'host');
      if (newPremiseRoles.length === 0) {
        delete currentRoles[premiseId];
      } else {
        currentRoles[premiseId] = newPremiseRoles;
      }
      await adminDb.from('users').update({ premise_roles: currentRoles }).eq('id', hostId);
    }

    await createLogEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: LogAction.HOST_REMOVED,
      description: `Owner "${actor.name}" removed host "${hostName}" from premise, converting them to a visitor.`
    });

    revalidatePath('/dashboard/owner/hosts');
    return { success: true };

  } catch (e: any) {
    console.error('Error removing host:', e);
    return { success: false, error: e.message || 'An unknown server error occurred.' };
  }
}

export async function backfillHostAvailability(premiseId: string): Promise<{ success: boolean; error?: string; message?: string; }> {
  if (!premiseId) {
    return { success: false, error: 'Premise ID is required.' };
  }
  const adminDb = getAdminDb();
  if (!adminDb) {
    return { success: false, error: 'Admin database not available.' };
  }

  try {
    const { user, profile } = await requireAuth();
    if (profile.role !== 'admin') {
      const { data: permCheck } = await adminDb.from('premises').select('owner_id').eq('id', premiseId).single();
      if (!permCheck || permCheck.owner_id !== user.id) throw new Error('Unauthorized: You do not own this premise.');
    }

    const { data: premiseDoc } = await adminDb.from('premises').select('*').eq('id', premiseId).single();
    if (!premiseDoc) {
      throw new Error("Premise not found.");
    }

    const staff = (premiseDoc.staff || []) as StaffMember[];
    let changesMade = false;

    const newStaff = staff.map(member => {
      if (member.role === 'host' && typeof member.availability === 'undefined') {
        changesMade = true;
        return { ...member, availability: 'available' };
      }
      return member;
    });

    if (changesMade) {
      await adminDb.from('premises').update({ staff: newStaff }).eq('id', premiseId);
      revalidatePath('/dashboard/owner/hosts');
      return { success: true, message: 'All hosts have been updated with a default availability status.' };
    } else {
      return { success: true, message: 'All hosts were already up-to-date. No changes needed.' };
    }

  } catch (e: any) {
    console.error("Error backfilling host availability:", e);
    return { success: false, error: e.message || 'An unknown error occurred.' };
  }
}
