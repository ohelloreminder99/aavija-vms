'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { LogAction } from '@/services/log-actions';
import { createLogEntry } from '@/services/log-service';

interface GatekeeperData {
  name: string;
  email: string;
  password: string;
  premise_id: string;
  gateId?: string;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}

export async function createGatekeeper(
  data: GatekeeperData
): Promise<{ success: boolean; error?: string }> {
  const { name, email, password, premise_id: premiseId, gateId, actor } = data;

  if (!name || !email || !password || !premiseId) {
    return { success: false, error: 'All fields are required.' };
  }
  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' };
  }

  const adminDb = await getAdminDb();
  if (!adminDb) return { success: false, error: 'Admin database not available.' };

  try {
    const { user: authUser, profile } = await requireAuth();
    
    // Permission check
    if (profile.role !== 'admin') {
      const { data: permCheck } = await adminDb.from('premises').select('owner_id').eq('id', premiseId).single();
      if (!permCheck || permCheck.owner_id !== authUser.id) throw new Error('Unauthorized');
    }

    // 1. Create Auth User
    const { data: authData, error: authError } = await adminDb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authError) throw authError;
    const gatekeeperUid = authData.user!.id;

    // 2. Create User Profile
    const { error: userError } = await adminDb.from('users').upsert({
      id: gatekeeperUid,
      name,
      email,
      role: 'visitor',
      premise_roles: {
        [premiseId]: ['gatekeeper']
      },
      is_active: true,
      is_verified: false,
    });

    if (userError) {
      // rollback auth creation
      await adminDb.auth.admin.deleteUser(gatekeeperUid);
      throw new Error(`Profile creation failed: ${userError.message}`);
    }

    // 3. Add to Premise Members (Relational)
    const { error: memberError } = await adminDb.from('premise_members').insert({
      premise_id: premiseId,
      user_id: gatekeeperUid,
      role: 'gatekeeper',
      gate_id: gateId,
      is_active: true
    });

    if (memberError) throw memberError;

    // 4. Update Premise Counter
    await adminDb.rpc('increment_gatekeeper_count', { premise_id_param: premiseId });

    await createLogEntry({
      actor_id: actor.id,
      actor_name: actor.name,
      actor_role: actor.role,
      action: LogAction.GATEKEEPER_CREATED,
      description: `Owner "${actor.name}" created gatekeeper "${name}"${gateId ? ` assigned to gate ${gateId}` : ''}.`
    });

    revalidatePath('/dashboard/owner/gatekeepers');
    return { success: true };
  } catch (error: any) {
    console.error('Error creating gatekeeper:', error);
    const msg = error.message || '';
    if (msg.includes('already exists') || msg.toLowerCase().includes('email exists')) {
      return { success: false, error: 'USER_ALREADY_EXISTS' };
    }
    return { success: false, error: msg || 'An unknown error occurred.' };
  }
}

interface AssignGatekeeperPayload {
  email: string;
  premise_id: string;
  gateId?: string;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}

export async function assignGatekeeperRoleByEmail(payload: AssignGatekeeperPayload): Promise<{ success: boolean; error?: string }> {
  const { email, premise_id: premiseId, gateId, actor } = payload;
  const adminDb = await getAdminDb();
  if (!adminDb) return { success: false, error: 'Admin database not available.' };

  try {
    const { user: authUser, profile } = await requireAuth();
    if (profile.role !== 'admin') {
      const { data: permCheck } = await adminDb.from('premises').select('owner_id').eq('id', premiseId).single();
      if (!permCheck || permCheck.owner_id !== authUser.id) throw new Error('Unauthorized');
    }

    const { data: userDoc } = await adminDb.from('users').select('id, name, premise_roles').eq('email', email).single();
    if (!userDoc) return { success: false, error: 'No user found with that email address.' };

    const currentRoles = userDoc.premise_roles || {};
    const premiseRoles = currentRoles[premiseId] || [];
    if (!premiseRoles.includes('gatekeeper')) premiseRoles.push('gatekeeper');
    currentRoles[premiseId] = premiseRoles;

    await adminDb.from('users').update({ premise_roles: currentRoles }).eq('id', userDoc.id);

    const { error: memberError } = await adminDb.from('premise_members').upsert({
      premise_id: premiseId,
      user_id: userDoc.id,
      role: 'gatekeeper',
      gate_id: gateId,
      is_active: true
    }, { onConflict: 'premise_id, user_id, role' });

    if (memberError) throw memberError;

    // Note: If using upsert, counter might need careful handling (exists vs new)
    // For simplicity, let's assume we want accurate counts.
    
    await createLogEntry({
      actor_id: actor.id,
      actor_name: actor.name,
      actor_role: actor.role,
      action: LogAction.GATEKEEPER_CREATED,
      description: `Owner "${actor.name}" assigned gatekeeper role to existing user "${userDoc.name}" (${email})${gateId ? ` at gate ${gateId}` : ''}.`
    });

    revalidatePath('/dashboard/owner/gatekeepers');
    return { success: true };

  } catch (e: any) {
    console.error("Error assigning gatekeeper role:", e);
    return { success: false, error: e.message || 'An unknown error occurred.' };
  }
}

export async function removeGatekeeperFromPremise({ premise_id: premiseId, user_id: userId, actor }: { premise_id: string; user_id: string; actor: { id: string; name: string; role: string } }) {
  const adminDb = await getAdminDb();
  if (!adminDb) return { success: false, error: 'Admin database not available.' };

  try {
    const { error } = await adminDb.from('premise_members').delete().match({ premise_id: premiseId, user_id: userId, role: 'gatekeeper' });
    if (error) throw error;

    await adminDb.rpc('decrement_gatekeeper_count', { premise_id_param: premiseId });

    const { data: userDoc } = await adminDb.from('users').select('*').eq('id', userId).single();
    if (userDoc) {
      const currentRoles = userDoc.premise_roles || {};
      const premiseRoles = currentRoles[premiseId] || [];
      const newPremiseRoles = premiseRoles.filter((r: string) => r !== 'gatekeeper');
      if (newPremiseRoles.length === 0) {
        delete currentRoles[premiseId];
      } else {
        currentRoles[premiseId] = newPremiseRoles;
      }
      await adminDb.from('users').update({ premise_roles: currentRoles }).eq('id', userId);
    }

    await createLogEntry({
      actor_id: actor.id,
      actor_name: actor.name,
      actor_role: actor.role,
      action: LogAction.GATEKEEPER_DELETED,
      description: `Owner "${actor.name}" removed gatekeeper ${userId} from premise.`
    });

    revalidatePath('/dashboard/owner/gatekeepers');
    return { success: true };
  } catch (e: any) {
    console.error("Error removing gatekeeper:", e);
    return { success: false, error: e.message };
  }
}

export async function toggleGatekeeperStatus({ premise_id: premiseId, user_id: userId, isActive, actor }: { premise_id: string; user_id: string; isActive: boolean; actor: { id: string; name: string; role: string } }) {
  const adminDb = await getAdminDb();
  if (!adminDb) return { success: false, error: 'Admin database not available.' };

  try {
    const { error } = await adminDb.from('premise_members')
      .update({ is_active: isActive })
      .match({ premise_id: premiseId, user_id: userId, role: 'gatekeeper' });
    if (error) throw error;

    await createLogEntry({
      actor_id: actor.id,
      actor_name: actor.name,
      actor_role: actor.role,
      action: isActive ? LogAction.GATEKEEPER_ACTIVATED : LogAction.GATEKEEPER_DEACTIVATED,
      description: `Owner "${actor.name}" ${isActive ? 'activated' : 'deactivated'} gatekeeper ${userId}.`
    });

    revalidatePath('/dashboard/owner/gatekeepers');
    return { success: true };
  } catch (e: any) {
    console.error("Error toggling gatekeeper status:", e);
    return { success: false, error: e.message };
  }
}
