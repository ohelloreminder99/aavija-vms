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
  premise_id: string;
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
  const { name, email, password, identity, premise_id: premiseId, premiseCity, actor } = data;

  if (!name || !email || !password || !identity || !premiseId || !premiseCity) {
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

    // 3. Add to Premise Members (Relational)
    const { error: memberError } = await adminDb.from('premise_members').insert({
      premise_id: premiseId,
      user_id: hostUid,
      role: 'host',
      identity: identity,
      is_active: true
    });

    if (memberError) throw memberError;

    // 4. Update Premise Counter
    await adminDb.rpc('increment_host_count', { premise_id_param: premiseId });

    await createLogEntry({
      actor_id: actor.id,
      actor_name: actor.name,
      actor_role: actor.role,
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
  premise_id: string;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}

export async function assignHostRoleByEmail(payload: AssignHostByEmailPayload): Promise<{ success: boolean; error?: string }> {
  const { email, identity, premise_id: premiseId, actor } = payload;
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

    if (userDoc?.premise_roles?.[premiseId]?.includes('host')) {
      return { success: false, error: `This user is already a host at this premise.` };
    }

    const currentRoles = userDoc.premise_roles || {};
    const premiseRoles = currentRoles[premiseId] || [];
    if (!premiseRoles.includes('host')) premiseRoles.push('host');
    currentRoles[premiseId] = premiseRoles;

    await adminDb.from('users').update({ premise_roles: currentRoles }).eq('id', userDoc.id);

    // 3. Add to Premise Members (Relational)
    const { error: memberError } = await adminDb.from('premise_members').upsert({
      premise_id: premiseId,
      user_id: userDoc.id,
      role: 'host',
      identity: identity,
      is_active: true
    }, { onConflict: 'premise_id, user_id, role' });

    if (memberError) throw memberError;

    // 4. Update Premise Counter
    await adminDb.rpc('increment_host_count', { premise_id_param: premiseId });

    await createLogEntry({
      actor_id: actor.id,
      actor_name: actor.name,
      actor_role: actor.role,
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
  host_id: string;
  hostName: string;
  newStatus: boolean;
  premise_id: string;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}


export async function toggleHostStatus(payload: ToggleStatusPayload): Promise<{ success: boolean, error?: string }> {
  const { host_id: hostId, hostName, newStatus, premise_id: premiseId, actor } = payload;
  const adminDb = await getAdminDb();

  if (!adminDb) {
    return { success: false, error: 'Admin database service not available.' };
  }

  try {
    const { user, profile } = await requireAuth();
    if (profile.role !== 'admin') {
      const { data: permCheck } = await adminDb.from('premises').select('owner_id').eq('id', premiseId).single();
      if (!permCheck || permCheck.owner_id !== user.id) throw new Error('Unauthorized: You do not own this premise.');
    }

    await adminDb.from('premise_members')
      .update({ is_active: newStatus })
      .match({ premise_id: premiseId, user_id: hostId, role: 'host' });

    await adminDb.from('users').update({ is_active: newStatus }).eq('id', hostId);

    const action = newStatus ? LogAction.HOST_ACTIVATED : LogAction.HOST_DEACTIVATED;
    const actionText = newStatus ? 'activated' : 'deactivated';

    await createLogEntry({
      actor_id: actor.id,
      actor_name: actor.name,
      actor_role: actor.role,
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
  host_id: string;
  hostName: string;
  premise_id: string;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}

export async function removeHostFromPremise(payload: RemoveHostPayload): Promise<{ success: boolean; error?: string }> {
  const { host_id: hostId, hostName, premise_id: premiseId, actor } = payload;
  const adminDb = await getAdminDb();

  if (!adminDb) {
    return { success: false, error: 'Admin services not available.' };
  }

  try {
    const { user, profile } = await requireAuth();
    if (profile.role !== 'admin') {
      const { data: permCheck } = await adminDb.from('premises').select('owner_id').eq('id', premiseId).single();
      if (!permCheck || permCheck.owner_id !== user.id) throw new Error('Unauthorized: You do not own this premise.');
    }

    const { error } = await adminDb.from('premise_members')
      .delete()
      .match({ premise_id: premiseId, user_id: hostId, role: 'host' });
    
    if (error) throw error;

    await adminDb.rpc('decrement_host_count', { premise_id_param: premiseId });

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
      actor_id: actor.id,
      actor_name: actor.name,
      actor_role: actor.role,
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

export async function backfillHostAvailability(premise_id: string): Promise<{ success: boolean; error?: string; message?: string; }> {
  if (!premise_id) {
    return { success: false, error: 'Premise ID is required.' };
  }
  const adminDb = await getAdminDb();
  if (!adminDb) {
    return { success: false, error: 'Admin database not available.' };
  }

  try {
    const { user, profile } = await requireAuth();
    if (profile.role !== 'admin') {
      const { data: permCheck } = await adminDb.from('premises').select('owner_id').eq('id', premise_id).single();
      if (!permCheck || permCheck.owner_id !== user.id) throw new Error('Unauthorized: You do not own this premise.');
    }

    const { data: premiseDoc } = await adminDb.from('premises').select('*').eq('id', premise_id).single();
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
      await adminDb.from('premises').update({ staff: newStaff }).eq('id', premise_id);
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
