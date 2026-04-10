'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { LogAction } from '@/services/log-actions';
import { Visit } from '@/services/visit-service';
import { createLogEntry } from '@/services/log-service';
import { StaffMember } from '@/services/premise-service';

interface RatingData {
  visit_id: string;
  visitor_id: string;
  host_id: string;
  premise_id: string;
  rating: number;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}

export async function submitRatingAndRecalculate(data: RatingData): Promise<{ success: boolean; error?: string }> {
  const { visit_id: visitId, visitor_id: visitorId, host_id: hostId, premise_id: premiseId, rating, actor } = data;

  if (rating < 1 || rating > 5) {
    return { success: false, error: 'Rating must be between 1 and 5.' };
  }

  const adminDb = await getAdminDb();
  if (!adminDb) {
    return { success: false, error: 'Server is not configured for admin access.' };
  }

  try {
    const { user } = await requireAuth();
    if (user.id !== hostId) {
      throw new Error('Unauthorized: You can only submit ratings for yourself.');
    }

    // 1. Check if rating for this visit already exists
    const { data: existingRatings, error: existError } = await adminDb
      .from('ratings')
      .select('id')
      .eq('visit_id', visitId)
      .limit(1);

    if (existError) throw existError;
    if (existingRatings && existingRatings.length > 0) {
      throw new Error('A rating for this visit has already been submitted.');
    }

    // 2. Get settings for token deduction
    const { data: settingsDoc, error: settingsError } = await adminDb
      .from('settings')
      .select('star_rating_cost')
      .eq('id', 'global')
      .single();
    if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;

    const starRatingCost = settingsDoc?.star_rating_cost || 0;

    // 3. Get all previous ratings for the visitor
    const { data: allRatingsDocs, error: ratingsError } = await adminDb
      .from('ratings')
      .select('rating')
      .eq('visitor_id', visitorId);
    if (ratingsError) throw ratingsError;

    const allRatings = (allRatingsDocs || []).map((r: { rating: number }) => r.rating);

    // 4. Calculate new average
    const newTotalRating = allRatings.reduce((sum: number, r: number) => sum + r, 0) + rating;
    const newRatingCount = allRatings.length + 1;
    const newGlobalRating = newTotalRating / newRatingCount;

    // 5. Create new rating document
    const { error: insertError } = await adminDb.from('ratings').insert({
      visit_id: visitId,
      visitor_id: visitorId,
      host_id: hostId,
      premise_id: premiseId,
      rating,
      created_at: new Date().toISOString(),
    });
    if (insertError) throw insertError;

    // 6. Deduct tokens from Host Atomically (RPC) - Host pays to rate a visitor
    if (starRatingCost > 0) {
      const { error: rpcError } = await adminDb.rpc('deduct_user_tokens', { p_user_id: hostId, p_amount: starRatingCost });
      if (rpcError) throw new Error('Insufficient tokens to submit a star rating.');
    }

    // 7. Update Visitor's rating
    const { error: updateVisitorError } = await adminDb.from('users').update({
      global_rating: newGlobalRating,
    }).eq('id', visitorId);
    if (updateVisitorError) throw updateVisitorError;

    // 8. Create log entry for the HOST (Token deduction)
    await createLogEntry({
      actor_id: hostId,
      actor_name: actor.name,
      actor_role: 'host',
      action: LogAction.VISITOR_RATED,
      description: `Rated visitor ${visitorId} (${rating} stars). Cost: ${starRatingCost} tokens.`,
      token_change: -starRatingCost,
      context: { visitId }
    });

    // 9. Revalidate path
    revalidatePath('/dashboard/host/history');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error in submitRatingAndRecalculate transaction:', error);
    const msg = error instanceof Error ? error.message : 'An unknown server error occurred.';
    if (msg.includes('Credential') || msg.includes('Could not refresh access token')) {
      return { success: false, error: 'The server could not authenticate.' };
    }
    return { success: false, error: msg };
  }
}

type SerializableVisit = {
  id: string;
  visitor_id: string;
  visitor_name: string;
  host_id: string;
  host_name?: string;
  premise_id: string;
  checkin_time: string;
  checkout_time: string | null;
  visitor_snapshot_url?: string;
  status: 'active' | 'completed' | 'declined' | 'force_closed';
};

interface GetHostVisitsPayload {
  host_id: string;
  premise_id: string;
  limit: number;
  startAfter?: string; // Document ID OR ISO string depending on how it's matched
  startDate?: string;
}

export async function getVisitsForHostInPremise(
  payload: GetHostVisitsPayload
): Promise<{ success: boolean; visits?: SerializableVisit[]; lastVisible?: string, error?: string }> {
  const { host_id: hostId, premise_id: premiseId, limit, startAfter, startDate } = payload;

  if (!hostId || !premiseId) {
    return { success: false, error: 'Host ID and Premise ID are required.' };
  }

  const adminDb = await getAdminDb();
  if (!adminDb) {
    return { success: false, error: 'Server is not configured for admin access.' };
  }

  try {
    const { user } = await requireAuth();
    if (user.id !== hostId) {
      throw new Error('Unauthorized: You can only view your own visits.');
    }

    let query = adminDb
      .from('visits')
      .select('*')
      .eq('premise_id', premiseId)
      .eq('host_id', hostId)
      .order('checkin_time', { ascending: false })
      .limit(limit);

    if (startDate) {
      query = query.gte('checkin_time', new Date(startDate).toISOString());
    }

    if (startAfter) {
      query = query.lt('checkin_time', startAfter); // Assuming startAfter is a timestamp string now
    }

    const { data: visitsSnapshot, error } = await query;
    if (error) throw error;

    if (!visitsSnapshot || visitsSnapshot.length === 0) {
      return { success: true, visits: [], lastVisible: undefined };
    }

    const visits: SerializableVisit[] = (visitsSnapshot || []).map((data: Record<string, any>) => {
      return {
        id: data.id,
        visitor_id: data.visitor_id,
        visitor_name: data.visitor_name,
        host_id: data.host_id,
        host_name: data.host_name,
        premise_id: data.premise_id,
        checkin_time: data.checkin_time,
        checkout_time: (data.checkout_time as string | null) || null,
        status: data.status as SerializableVisit['status'],
        visitor_snapshot_url: data.visitor_snapshot_url as string | undefined,
      };
    });

    const lastVisibleDocId = visitsSnapshot[visitsSnapshot.length - 1]?.checkin_time;

    return { success: true, visits, lastVisible: lastVisibleDocId };
  } catch (error: unknown) {
    console.error('Error fetching host visit history:', error);
    const msg = error instanceof Error ? error.message : 'An unknown server error occurred.';
    if (msg.includes('Could not refresh access token') || msg.includes('Credential')) {
      return { success: false, error: 'Could not access database with admin privileges.' };
    }
    return {
      success: false,
      error: msg,
    };
  }
}

export async function setHostAvailability(payload: { host_id: string; premise_id: string; availability: string }): Promise<{ success: boolean; error?: string }> {
  const { host_id: hostId, premise_id: premiseId, availability } = payload;

  const adminDb = await getAdminDb();
  if (!adminDb) {
    return { success: false, error: 'Server not configured for admin access.' };
  }

  try {
    const { user, profile } = await requireAuth();
    if (user.id !== hostId && profile.role !== 'owner' && profile.role !== 'admin') {
      throw new Error('Unauthorized: You cannot change availability for another host.');
    }

    const { data: memberData, error: fetchError } = await adminDb
      .from('premise_members')
      .select('id')
      .eq('premise_id', premiseId)
      .eq('user_id', hostId)
      .single();

    if (fetchError || !memberData) {
      throw new Error("Host profile not found in this premise.");
    }

    const { error: updateError } = await adminDb
      .from('premise_members')
      .update({ availability })
      .eq('id', memberData.id);

    if (updateError) throw updateError;
    if (updateError) throw updateError;

    revalidatePath('/dashboard/host');
    revalidatePath(`/dashboard/gatekeeper?premiseId=${premiseId}`);
    return { success: true };
  } catch (e: unknown) {
    console.error("Error setting host availability:", e);
    const msg = e instanceof Error ? e.message : 'An unknown error occurred.';
    if (msg.includes('Credential') || msg.includes('Could not refresh access token')) {
      return { success: false, error: 'The server could not authenticate.' };
    }
    return { success: false, error: msg };
  }
}

export async function verifyVisitByHost(payload: { visit_id: string; premise_id: string; host_id: string }): Promise<{ success: boolean; error?: string }> {
  const { visit_id: visitId, premise_id: premiseId, host_id: hostId } = payload;
  const adminDb = await getAdminDb();
  if (!adminDb) return { success: false, error: 'Server database connection failed.' };

  try {
    const { user } = await requireAuth();
    if (user.id !== hostId) throw new Error('Unauthorized: Only the assigned host can verify this visit.');

    const now = new Date().toISOString();
    const { error: updateError } = await adminDb
      .from('visits')
      .update({ 
        host_verified_at: now, 
        host_verified: true,
        host_verified_by: hostId 
      })
      .eq('id', visitId)
      .eq('host_id', hostId) // Extra safety
      .eq('status', 'active');

    if (updateError) throw updateError;

    await createLogEntry({
      actor_id: hostId,
      actor_name: 'Host', 
      actor_role: 'host',
      action: LogAction.VISIT_VERIFIED_BY_HOST,
      description: `Verified meeting with visitor for visit ${visitId}.`,
      context: { premise_id: premiseId, visit_id: visitId }
    });

    revalidatePath('/dashboard/host/active-visits');
    revalidatePath('/dashboard/gatekeeper/active-visits');
    return { success: true };
  } catch (e: any) {
    console.error("Error verifying visit:", e);
    return { success: false, error: e.message || "An unknown error occurred." };
  }
}
