'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { LogAction } from '@/services/log-actions';
import { Visit } from '@/services/visit-service';
import { createLogEntry } from '@/services/log-service';
import { StaffMember } from '@/services/premise-service';

interface RatingData {
  visitId: string;
  visitorId: string;
  hostId: string;
  premiseId: string;
  rating: number;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}

export async function submitRatingAndRecalculate(data: RatingData): Promise<{ success: boolean; error?: string }> {
  const { visitId, visitorId, hostId, premiseId, rating, actor } = data;

  if (rating < 1 || rating > 5) {
    return { success: false, error: 'Rating must be between 1 and 5.' };
  }

  const adminDb = getAdminDb();
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
      .eq('visitId', visitId)
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
      .eq('visitorId', visitorId);
    if (ratingsError) throw ratingsError;

    const allRatings = (allRatingsDocs || []).map((r: any) => r.rating);

    // 4. Calculate new average
    const newTotalRating = allRatings.reduce((sum: number, r: number) => sum + r, 0) + rating;
    const newRatingCount = allRatings.length + 1;
    const newGlobalRating = newTotalRating / newRatingCount;

    // 5. Create new rating document
    const { error: insertError } = await adminDb.from('ratings').insert({
      visitId,
      visitorId,
      hostId,
      premiseId,
      rating,
      createdAt: new Date().toISOString(),
    });
    if (insertError) throw insertError;

    // 6. Deduct tokens from Host Atomically (RPC)
    if (starRatingCost > 0) {
      const { error: rpcError } = await adminDb.rpc('deduct_user_tokens', { p_user_id: hostId, p_amount: starRatingCost });
      if (rpcError) throw new Error('Insufficient tokens to submit a star rating.');
    }

    // 7. Update Visitor's rating
    const { error: updateVisitorError } = await adminDb.from('users').update({
      global_rating: newGlobalRating,
    }).eq('id', visitorId);
    if (updateVisitorError) throw updateVisitorError;

    // 8. Create log entry (against the HOST)
    await createLogEntry({
      actorId: hostId, // Log against the host whose tokens are deducted
      actorName: actor.name,
      actorRole: 'host',
      action: LogAction.VISITOR_RATED,
      description: `Rated visitor an average of ${rating} stars. Cost: ${starRatingCost} tokens.`,
      tokenChange: -starRatingCost
    });

    revalidatePath('/dashboard/host/history');
    return { success: true };
  } catch (error: any) {
    console.error('Error in submitRatingAndRecalculate transaction:', error);
    const msg = error.message;
    if (msg && (msg.includes('Credential') || msg.includes('Could not refresh access token'))) {
      return { success: false, error: 'The server could not authenticate.' };
    }
    return { success: false, error: msg || 'An unknown server error occurred.' };
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
  hostId: string;
  premiseId: string;
  limit: number;
  startAfter?: string; // Document ID OR ISO string depending on how it's matched
  startDate?: string;
}

export async function getVisitsForHostInPremise(
  payload: GetHostVisitsPayload
): Promise<{ success: boolean; visits?: SerializableVisit[]; lastVisible?: string, error?: string }> {
  const { hostId, premiseId, limit, startAfter, startDate } = payload;

  if (!hostId || !premiseId) {
    return { success: false, error: 'Host ID and Premise ID are required.' };
  }

  const adminDb = getAdminDb();
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
        status: data.status,
        visitor_snapshot_url: data.visitor_snapshot_url,
      };
    });

    const lastVisibleDocId = visitsSnapshot[visitsSnapshot.length - 1]?.checkin_time;

    return { success: true, visits, lastVisible: lastVisibleDocId };
  } catch (error: any) {
    console.error('Error fetching host visit history:', error);
    const msg = error.message;
    if (msg && (msg.includes('Could not refresh access token') || msg.includes('Credential'))) {
      return { success: false, error: 'Could not access database with admin privileges.' };
    }
    return {
      success: false,
      error: msg || 'An unknown server error occurred.',
    };
  }
}

export async function setHostAvailability(payload: { hostId: string; premiseId: string; availability: string }): Promise<{ success: boolean; error?: string }> {
  const { hostId, premiseId, availability } = payload;

  const adminDb = getAdminDb();
  if (!adminDb) {
    return { success: false, error: 'Server not configured for admin access.' };
  }

  try {
    const { user, profile } = await requireAuth();
    if (user.id !== hostId && profile.role !== 'owner' && profile.role !== 'admin') {
      throw new Error('Unauthorized: You cannot change availability for another host.');
    }

    const { data: premiseDoc, error: fetchError } = await adminDb.from('premises').select('staff').eq('id', premiseId).single();
    if (fetchError || !premiseDoc) {
      throw new Error("Premise not found.");
    }

    const staff = (premiseDoc.staff || []) as StaffMember[];
    const hostIndex = staff.findIndex(s => s.uid === hostId);

    if (hostIndex === -1) {
      throw new Error("Host not found in this premise's staff list.");
    }

    staff[hostIndex].availability = availability as any;

    const { error: updateError } = await adminDb.from('premises').update({ staff }).eq('id', premiseId);
    if (updateError) throw updateError;

    revalidatePath('/dashboard/host');
    revalidatePath(`/dashboard/gatekeeper?premiseId=${premiseId}`);
    return { success: true };
  } catch (e: any) {
    console.error("Error setting host availability:", e);
    const msg = e.message;
    if (msg && (msg.includes('Credential') || msg.includes('Could not refresh access token'))) {
      return { success: false, error: 'The server could not authenticate.' };
    }
    return { success: false, error: msg || 'An unknown error occurred.' };
  }
}
