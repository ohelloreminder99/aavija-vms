'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { Visit } from '@/services/visit-service';
import { UserProfile } from '@/services/user-service';
import { LogAction } from '@/services/log-actions';
import { StaffMember } from '@/services/premise-service';
import { Agent } from '@/services/agent-service';
import { PremiseCategory } from '@/services/premise-category-service';
import { Premise } from '@/services/premise-service';
import { createLogEntry } from '@/services/log-service';
import { PREMISE_LIST_COLS, CATEGORY_COLS, paginationRange } from '@/types/database.types';
import { sanitizeText } from '@/lib/sanitize';

interface NewOwnerPremiseData {
  premiseName: string;
  premiseAddress: string;
  premiseCity: string;
  cityId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  agentId?: string;
  categoryId?: string;
  categoryName?: string;
  city_state?: string;
}

interface ExistingUserPremiseData {
  premiseName: string;
  premiseAddress: string;
  premiseCity: string;
  cityId: string;
  ownerEmail: string;
  agentId?: string;
  categoryId?: string;
  categoryName?: string;
  city_state?: string;
}

// A serializable version of the Visit type
export type SerializableVisit = {
  id: string;
  visitor_id: string;
  visitor_name: string;
  host_id: string;
  host_name?: string;
  premise_id: string;
  checkin_time: string;
  checkout_time: string | null;
  vehicle_details?: {
    plate: string;
    model: string;
  };
  visitor_snapshot_url?: string;
  status: 'active' | 'completed' | 'declined' | 'force_closed';
  checkin_gate_name?: string;
  checkout_gate_name?: string;
};

export type SerializablePremiseWithDetails = {
  id: string;
  name: string;
  address: string;
  city: string;
  cityId: string;
  is_active: boolean;
  owner?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    photo_url: string;
  };
  agent?: {
    id: string;
    name: string;
    email?: string;
  };
  category?: {
    id: string;
    name: string;
  };
};

export async function getPremisesForAdmin(
  page = 0,
  pageSize = 25,
): Promise<{ success: boolean; data?: SerializablePremiseWithDetails[]; total?: number; error?: string; }> {
  const adminDb = await getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
  if (!adminDb) {
    return { success: false, error: "Server database connection not available." };
  }

  try {
    const { from, to } = paginationRange(page, pageSize);

    const { data: premisesSnap, error: premisesError, count } = await adminDb
      .from('premises')
      .select(PREMISE_LIST_COLS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (premisesError) throw premisesError;

    const userIds = [...new Set([
      ...((premisesSnap || []).map(p => p.owner_id).filter(Boolean)),
      ...((premisesSnap || []).map(p => p.agent_id).filter(Boolean))
    ])];

    const [
      { data: usersSnap, error: usersError },
      { data: agentsSnap },
      { data: categoriesSnap }
    ] = await Promise.all([
      userIds.length > 0
        ? adminDb.from('users').select('id, name, email, phone, photo_url').in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length > 0
        ? adminDb.from('agents').select('id, name').in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
      adminDb.from('premise_categories').select(CATEGORY_COLS)
    ]);

    if (usersError) throw usersError;

    const userMap = new Map<string, any>((usersSnap || []).map((u) => [u.id, u]));
    const agentNameMap = new Map<string, string>((agentsSnap || []).map((a) => [a.id, a.name]));
    const categoryMap = new Map<string, PremiseCategory>((categoriesSnap || []).map((doc) => [doc.id, doc as PremiseCategory]));

    const premisesData: SerializablePremiseWithDetails[] = (premisesSnap || []).map((doc: any) => {
      const agentId = doc.agent_id;
      const ownerId = doc.owner_id;
      const catId = doc.categoryId; // Authoritative: actual DB column name is camelCase

      const ownerUser = userMap.get(ownerId);
      const agentUser = agentId ? userMap.get(agentId) : undefined;
      const shadowAgentName = agentId ? agentNameMap.get(agentId) : undefined;
      const category = catId ? categoryMap.get(catId) : undefined;

      return {
        ...doc,
        id: doc.id,
        name: doc.name,
        address: doc.address,
        city: doc.city,
        cityId: doc.cityId || '',
        is_active: doc.is_active,
        owner_id: ownerId,
        agent_id: agentId,
        categoryId: catId,
        categoryName: category?.name || doc.categoryName || null,
        owner: ownerUser ? {
          id: ownerId,
          name: ownerUser.name,
          email: ownerUser.email,
          phone: ownerUser.phone,
          photo_url: ownerUser.photo_url || ''
        } : undefined,
        agent: agentId && (agentUser || shadowAgentName) ? {
          id: agentId,
          name: agentUser?.name || shadowAgentName || 'Unknown Agent',
          email: agentUser?.email
        } : undefined,
        category: category ? { id: catId, name: category.name } : undefined,
      };
    });

    return { success: true, data: premisesData, total: count ?? 0 };

  } catch (e: unknown) {
    console.error("Error fetching premises for admin:", e);
    return { success: false, error: e instanceof Error ? e.message : 'An unknown server error occurred.' };
  }
}


export async function createPremiseAndNewOwner(
  data: NewOwnerPremiseData
): Promise<{ success: boolean; error?: string }> {
  const {
    premiseName, premiseAddress, premiseCity, cityId, ownerName, ownerEmail, ownerPassword, agentId, categoryId, categoryName, city_state,
  } = data;

  const adminDb = await getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
  if (!adminDb) return { success: false, error: 'Admin service not available.' };

  try {
    const { data: userRecord, error: authError } = await adminDb.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
      user_metadata: { name: ownerName },
    });

    if (authError) {
      if (authError.message.toLowerCase().includes('already registered') || authError.message.toLowerCase().includes('email exists')) {
        return { success: false, error: 'USER_ALREADY_EXISTS' };
      }
      throw authError;
    }
    if (!userRecord || !userRecord.user) throw new Error("Failed to create owner user.");

    const ownerUid = userRecord.user.id;
    const premiseId = crypto.randomUUID();

    const { data: settingsData } = await adminDb.from('settings').select('*').eq('id', 'global').single();

    const startingOwnerTokens = settingsData?.starting_token_owner || 0;
    const startingVisitorTokens = settingsData?.starting_token_visitor || 0;

    const { error: userError } = await adminDb.from('users').insert({
      id: ownerUid,
      name: ownerName,
      email: ownerEmail,
      role: 'visitor',
      premise_roles: { [premiseId]: ['owner'] },
      phone: '',
      is_verified: false,
      token_balance_visitor: startingVisitorTokens,
      global_rating: 0,
      active_checkin_id: null,
      photo_url: '',
      city: premiseCity,
      cityId: cityId,
      city_state: city_state || 'Unknown',
    });
    if (userError) throw userError;

    // 2. Ensure Agent exists in shadow table (Phase 2B requirement)
    if (agentId && agentId.trim()) {
      const { data: agentExists } = await adminDb.from('agents').select('id').eq('id', agentId).single();
      if (!agentExists) {
        // Fetch agent info from users table
        const { data: agentUserData } = await adminDb.from('users').select('name, phone').eq('id', agentId).single();
        // Create shadow agent
        await adminDb.from('agents').insert({
          id: agentId,
          name: agentUserData?.name || 'Unknown Agent',
          phone: agentUserData?.phone || '',
          city: premiseCity,
          commission_balance: 0
        });
      }
    }

    const { error: premiseError } = await adminDb.from('premises').insert({
      id: premiseId,
      name: premiseName,
      address: premiseAddress,
      city: premiseCity,
      cityId: cityId,
      city_state: city_state || 'Unknown',
      is_active: true,
      owner_id: ownerUid,
      ownerName: ownerName,
      agent_id: (agentId && agentId.trim()) ? agentId : null,
      categoryId: categoryId,
      categoryName: categoryName || null,
      staff: [],
      host_count: 0,
      gatekeeper_count: 0,
      token_balance: startingOwnerTokens,
    });
    if (premiseError) throw premiseError;

    if (startingOwnerTokens > 0) {
      await adminDb.from('logs').insert({
        actorId: profile.id,
        actorName: profile.name || 'Admin',
        actorRole: 'admin',
        action: LogAction.INITIAL_TOKEN_ALLOCATION,
        description: `Welcome Bonus: Premise "${premiseName}" received ${startingOwnerTokens} tokens.`,
        tokenChange: startingOwnerTokens,
        premiseId: premiseId,
        context: { premiseId },
      });

      // Add initial invoice
      // Add initial invoice (Free welcome bonus)
      await adminDb.from('invoices').insert({
        id: `INV-${premiseId}`,
        userId: ownerUid,
        userName: ownerName,
        userEmail: ownerEmail,
        userPhone: '',
        userState: city_state || 'Unknown',
        premiseId: premiseId,
        tokenAmount: startingOwnerTokens,
        subtotal: 0,
        totalAmount: 0,
        status: 'paid',
        created_at: new Date().toISOString(),
      });
    }

    revalidatePath('/dashboard/admin/premises');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error creating premise and owner:', error);
    return { success: false, error: error instanceof Error ? error.message : 'An unknown server error occurred.' };
  }
}

export async function createPremiseForExistingUser(
  data: ExistingUserPremiseData
): Promise<{ success: boolean; error?: string }> {
  const {
    premiseName, premiseAddress, premiseCity, cityId, ownerEmail, agentId, categoryId, categoryName, city_state,
  } = data;

  const adminDb = await getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
  if (!adminDb) return { success: false, error: 'Admin database not available.' };

  try {
    const { data: userDoc, error: fetchError } = await adminDb.from('users').select('*').eq('email', ownerEmail).single();
    if (fetchError || !userDoc) return { success: false, error: "No user found with that email address." };

    const ownerId = userDoc.id;
    const ownerName = userDoc.name;

    const { data: settingsData } = await adminDb.from('settings').select('starting_token_owner').eq('id', 'global').single();
    const startingOwnerTokens = settingsData?.starting_token_owner || 0;

    const premiseId = crypto.randomUUID();

    // 2. Ensure Agent exists in shadow table
    if (agentId && agentId.trim()) {
      const { data: agentExists } = await adminDb.from('agents').select('id').eq('id', agentId).single();
      if (!agentExists) {
        const { data: agentUserData } = await adminDb.from('users').select('name, phone').eq('id', agentId).single();
        await adminDb.from('agents').insert({
          id: agentId,
          name: agentUserData?.name || 'Unknown Agent',
          phone: agentUserData?.phone || '',
          city: premiseCity,
          commission_balance: 0
        });
      }
    }

    const { error: premiseError } = await adminDb.from('premises').insert({
      id: premiseId,
      name: premiseName,
      address: premiseAddress,
      city: premiseCity,
      cityId: cityId,
      city_state: city_state || 'Unknown',
      is_active: true,
      owner_id: ownerId,
      ownerName: ownerName,
      agent_id: (agentId && agentId.trim()) ? agentId : null,
      categoryId: categoryId,
      categoryName: categoryName || null,
      staff: [],
      host_count: 0,
      gatekeeper_count: 0,
      token_balance: startingOwnerTokens,
    });
    if (premiseError) throw premiseError;

    const currentRoles = userDoc.premise_roles || {};
    const updatedRoles = { ...currentRoles, [premiseId]: [...(currentRoles[premiseId] || []), 'owner'] };

    const { error: userUpdateError } = await adminDb.from('users').update({
      premise_roles: updatedRoles,
    }).eq('id', ownerId);
    if (userUpdateError) throw userUpdateError;

    if (startingOwnerTokens > 0) {
      await adminDb.from('logs').insert({
        actorId: profile.id,
        actorName: profile.name || 'Admin',
        actorRole: 'admin',
        action: LogAction.INITIAL_TOKEN_ALLOCATION,
        description: `Premise "${premiseName}" received ${startingOwnerTokens} welcome tokens.`,
        tokenChange: startingOwnerTokens,
        premiseId: premiseId,
        context: { premiseId },
      });

      // Add initial invoice
      // Add initial invoice (Free welcome bonus)
      await adminDb.from('invoices').insert({
        id: `INV-${premiseId}`,
        userId: ownerId,
        userName: ownerName,
        userEmail: ownerEmail,
        userPhone: userDoc.phone || '',
        userState: userDoc.billingState || userDoc.city_state || 'Unknown',
        premiseId: premiseId,
        tokenAmount: startingOwnerTokens,
        subtotal: 0,
        totalAmount: 0,
        status: 'paid',
        created_at: new Date().toISOString(),
      });
    }

    revalidatePath('/dashboard/admin/premises');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error creating premise for existing user:', error);
    return { success: false, error: error instanceof Error ? error.message : 'An unknown server error occurred.' };
  }
}


export async function deletePremise(
  premiseId: string,
  ownerId: string
): Promise<{ success: boolean; error?: string }> {
  const adminDb = await getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
  if (!adminDb) return { success: false, error: 'Admin database not available.' };

  try {
    const { error: deleteError } = await adminDb.from('premises').delete().eq('id', premiseId);
    if (deleteError) {
      console.error(`Foreign key block or DB error deleting premise ${premiseId}:`, deleteError.message);
      return { success: false, error: `Delete failed: ${deleteError.message}. Ensure all related visit records and logs are cascaded or manually removed.` };
    }

    // Attempt to update the user's roles, but don't fail the entire delete if this non-critical step fails (e.g. if the user is missing)
    try {
      const { data: userDoc } = await adminDb.from('users').select('premise_roles').eq('id', ownerId).single();
      if (userDoc) {
        const currentRoles = (userDoc.premise_roles || {}) as Record<string, string[]>;
        const { [premiseId]: _, ...updatedRoles } = currentRoles;
        await adminDb.from('users').update({ premise_roles: updatedRoles }).eq('id', ownerId);
      }
    } catch (syncError) {
      console.warn('Non-critical: Failed to sync user premise_roles after premise delete:', syncError);
    }

    revalidatePath('/dashboard/admin/premises');
    return { success: true };
  } catch (error: any) {
    console.error('Unexpected error deleting premise:', error);
    return { success: false, error: `An unexpected error occurred: ${error.message || error}` };
  }
}

interface GetVisitsPayload {
  premiseId: string;
  limit: number;
  startAfter?: string;
  startDate?: string;
}

export async function getVisitsForPremise(
  payload: GetVisitsPayload
): Promise<{ success: boolean; visits?: SerializableVisit[], lastVisible?: string; error?: string }> {
  const { premiseId, limit, startAfter, startDate } = payload;
  const adminDb = await getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
  if (!adminDb) return { success: false, error: 'Server is not configured for admin access.' };

  try {
    let query = adminDb.from('visits').select(`
      *,
      checkin_gate:checkin_gate_id(name),
      checkout_gate:checkout_gate_id(name)
    `).eq('premise_id', premiseId).order('checkin_time', { ascending: false }).limit(limit);
    if (startDate) query = query.gte('checkin_time', new Date(startDate).toISOString());
    if (startAfter) query = query.lt('checkin_time', startAfter);

    const { data: visitsSnapshot, error } = await query;
    if (error) throw error;
    if (!visitsSnapshot || visitsSnapshot.length === 0) return { success: true, visits: [], lastVisible: undefined };

    const visits: SerializableVisit[] = visitsSnapshot.map((data: any) => {
      return {
        id: data.id,
        visitor_id: data.visitor_id,
        visitor_name: data.visitor_name,
        host_id: data.host_id,
        host_name: data.host_name,
        premise_id: data.premise_id,
        checkin_time: data.checkin_time,
        checkout_time: data.checkout_time || null,
        vehicle_details: data.vehicle_details,
        visitor_snapshot_url: data.visitor_snapshot_url,
        status: data.status,
        checkin_gate_name: data.checkin_gate?.name,
        checkout_gate_name: data.checkout_gate?.name,
      };
    });
    return { success: true, visits, lastVisible: visitsSnapshot[visitsSnapshot.length - 1]?.checkin_time };
  } catch (error: unknown) {
    console.error('Error fetching premise visit history:', error);
    return { success: false, error: error instanceof Error ? error.message : 'An unknown server error occurred.' };
  }
}

export async function changePremiseOwner(payload: {
  premiseId: string;
  oldOwnerId: string;
  newOwnerEmail: string;
  actor: { id: string; name: string; role: string; };
}): Promise<{ success: boolean; error?: string }> {
  const { premiseId, oldOwnerId, newOwnerEmail, actor } = payload;
  const adminDb = await getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
  if (!adminDb) return { success: false, error: 'Admin database not available.' };

  try {
    let newOwnerName = 'Unknown User';
    let premiseName = 'Unknown Premise';

    const { data: newOwnerDoc, error: fetchOwnerError } = await adminDb.from('users').select('*').eq('email', newOwnerEmail).single();
    if (fetchOwnerError || !newOwnerDoc) throw new Error("No user found with the new owner's email address.");

    if (oldOwnerId === newOwnerDoc.id) throw new Error("The new owner cannot be the same as the current owner.");

    newOwnerName = newOwnerDoc.name || 'Unknown User';
    const { data: premiseDoc } = await adminDb.from('premises').select('*').eq('id', premiseId).single();
    premiseName = premiseDoc?.name || 'Unknown Premise';

    await adminDb.from('premises').update({ owner_id: newOwnerDoc.id, ownerName: newOwnerName }).eq('id', premiseId);

    const { data: oldOwnerDoc } = await adminDb.from('users').select('premise_roles').eq('id', oldOwnerId).single();
    if (oldOwnerDoc) {
      let currentRoles = oldOwnerDoc.premise_roles || {};
      let arr = currentRoles[premiseId] || [];
      arr = arr.filter((r: string) => r !== 'owner');
      if (arr.length === 0) {
        delete currentRoles[premiseId];
      } else {
        currentRoles[premiseId] = arr;
      }
      await adminDb.from('users').update({ premise_roles: currentRoles }).eq('id', oldOwnerId);
    }

    let newOwnerRoles = newOwnerDoc.premise_roles || {};
    let newArr = newOwnerRoles[premiseId] || [];
    if (!newArr.includes('owner')) newArr.push('owner');
    newOwnerRoles[premiseId] = newArr;

    await adminDb.from('users').update({ premise_roles: newOwnerRoles }).eq('id', newOwnerDoc.id);

    await createLogEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: LogAction.OWNERSHIP_TRANSFERRED,
      description: `Admin "${actor.name}" transferred ownership of premise "${premiseName}" to "${newOwnerName}".`
    });

    revalidatePath('/dashboard/admin/premises');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'An unknown server error occurred.' };
  }
}

export async function updatePremiseAdmin(
  premiseId: string,
  dataToUpdate: Partial<Premise>,
  expectedUpdatedAt?: string  // For optimistic locking: pass the `updated_at` you last fetched
): Promise<{ success: boolean; error?: string; conflict?: boolean }> {
  const adminDb = await getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
  if (!adminDb) return { success: false, error: 'Admin database not available.' };
  try {
    const updateData: any = { ...dataToUpdate };

    // Sanitize free-text fields to prevent stored XSS
    if (typeof updateData.name === 'string')    updateData.name    = sanitizeText(updateData.name);
    if (typeof updateData.address === 'string') updateData.address = sanitizeText(updateData.address);
    if (typeof updateData.city === 'string')    updateData.city    = sanitizeText(updateData.city);

    // The premises table uses camelCase (agent_id, categoryId, etc. are inconsistent in DB).
    // Normalize any client-side fields to match the database column names precisely.
    if ('agentId' in updateData) {
      updateData.agent_id = updateData.agentId;
      delete (updateData as any).agentId;
    }
    // Note: PostgREST respects camelCase if configured/matching the schema, 
    // but we ensure owner_id is present if it was changed recently.
    if ('ownerId' in updateData) {
      updateData.owner_id = updateData.ownerId;
      delete (updateData as any).ownerId;
    }

    // ── Optimistic Locking ────────────────────────────────────────────────────
    // Check whether the row has been modified since the admin last loaded it.
    // If updated_at doesn't match, return conflict instead of overwriting.
    if (expectedUpdatedAt) {
      const { data: current } = await adminDb
        .from('premises')
        .select('updated_at')
        .eq('id', premiseId)
        .single();

      if (current?.updated_at && current.updated_at !== expectedUpdatedAt) {
        return {
          success: false,
          conflict: true,
          error: 'This premise was recently modified by someone else. Please reload and try again.',
        };
      }
    }

    const { error: updateError } = await adminDb.from('premises').update(updateData).eq('id', premiseId);
    if (updateError) throw updateError;
    revalidatePath('/dashboard/admin/premises');
    return { success: true };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown update error');
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureException(err, { extra: { premiseId, dataToUpdate } });
    return { success: false, error: err.message };
  }
}
