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
import { v4 as uuidv4 } from 'uuid';

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
};

export type SerializablePremiseWithDetails = {
  id: string;
  name: string;
  address: string;
  city: string;
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
  };
  category?: {
    id: string;
    name: string;
  };
};

export async function getPremisesForAdmin(): Promise<{ success: boolean; data?: SerializablePremiseWithDetails[]; error?: string; }> {
  const adminDb = await getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
  if (!adminDb) {
    return { success: false, error: "Server database connection not available." };
  }

  try {
    const [
      { data: premisesSnap, error: premisesError },
      { data: usersSnap, error: usersError },
      { data: agentsSnap, error: agentsError },
      { data: categoriesSnap, error: categoriesError }
    ] = await Promise.all([
      adminDb.from('premises').select('*'),
      adminDb.from('users').select('*'),
      adminDb.from('agents').select('*'),
      adminDb.from('premise_categories').select('*')
    ]);

    if (premisesError) throw premisesError;
    if (usersError) throw usersError;

    const userMap = new Map<string, UserProfile>((usersSnap || []).map((doc: any) => [doc.id, doc as UserProfile]));
    const agentMap = new Map<string, Agent>((agentsSnap || []).map((doc: any) => [doc.id, doc as Agent]));
    const categoryMap = new Map<string, PremiseCategory>((categoriesSnap || []).map((doc: any) => [doc.id, doc as PremiseCategory]));

    const premisesData: SerializablePremiseWithDetails[] = (premisesSnap || []).map((doc: any) => {
      const premise = doc as Premise;
      const owner: any = userMap.get(premise.owner_id);
      const agent: any = premise.agent_id ? agentMap.get(premise.agent_id) : undefined;
      const category: any = premise.categoryId ? categoryMap.get(premise.categoryId) : undefined;

      return {
        id: doc.id,
        name: premise.name,
        address: premise.address,
        city: premise.city,
        cityId: premise.cityId || '',
        is_active: premise.is_active,
        owner: owner ? {
          id: premise.owner_id,
          name: owner.name,
          email: owner.email,
          phone: owner.phone,
          photo_url: owner.photo_url || ''
        } : undefined,
        agent: agent && premise.agent_id ? { id: premise.agent_id, name: agent.name } : undefined,
        category: category && premise.categoryId ? { id: premise.categoryId, name: category.name } : undefined,
      };
    });

    return { success: true, data: premisesData };

  } catch (e: any) {
    console.error("Error fetching premises for admin:", e);
    return { success: false, error: e.message || 'An unknown server error occurred.' };
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
    const premiseId = uuidv4();

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
      agent_id: agentId || null,
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
    }

    revalidatePath('/dashboard/admin/premises');
    return { success: true };
  } catch (error: any) {
    console.error('Error creating premise and owner:', error);
    return { success: false, error: error.message || 'An unknown server error occurred.' };
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

    const premiseId = uuidv4();

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
      agent_id: agentId || null,
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
    }

    revalidatePath('/dashboard/admin/premises');
    return { success: true };
  } catch (error: any) {
    console.error('Error creating premise for existing user:', error);
    return { success: false, error: error.message || 'An unknown server error occurred.' };
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
    if (deleteError) throw deleteError;

    const { data: userDoc } = await adminDb.from('users').select('premise_roles').eq('id', ownerId).single();
    if (userDoc) {
      let currentRoles = userDoc.premise_roles || {};
      const { [premiseId]: removedRole, ...updatedRoles } = currentRoles as any;
      await adminDb.from('users').update({ premise_roles: updatedRoles }).eq('id', ownerId);
    }

    revalidatePath('/dashboard/admin/premises');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting premise:', error);
    return { success: false, error: error.message || 'An unknown server error occurred during deletion.' };
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
    let query = adminDb.from('visits').select('*').eq('premise_id', premiseId).order('checkin_time', { ascending: false }).limit(limit);
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
      };
    });
    return { success: true, visits, lastVisible: visitsSnapshot[visitsSnapshot.length - 1]?.checkin_time };
  } catch (error: any) {
    console.error('Error fetching premise visit history:', error);
    return { success: false, error: error.message || 'An unknown server error occurred.' };
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
  } catch (error: any) {
    return { success: false, error: error.message || 'An unknown server error occurred.' };
  }
}

export async function updatePremiseAdmin(
  premiseId: string,
  dataToUpdate: Partial<Premise>
): Promise<{ success: boolean; error?: string }> {
  const adminDb = await getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
  if (!adminDb) return { success: false, error: 'Admin database not available.' };
  try {
    const { error: updateError } = await adminDb.from('premises').update(dataToUpdate).eq('id', premiseId);
    if (updateError) throw updateError;
    revalidatePath('/dashboard/admin/premises');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unknown error occurred.' };
  }
}
