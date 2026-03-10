'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { Visit } from '@/services/visit-service';

export type SerializableVisit = {
  id: string;
  visitor_id: string;
  visitor_name: string;
  host_id: string;
  host_name?: string;
  premise_id: string;
  checkin_time: string;
  checkout_time: string | null;
  status: 'active' | 'completed' | 'declined' | 'force_closed';
};

interface GetVisitsPayload {
  visitorId: string;
  limit: number;
  startAfter?: string;
  startDate?: string;
}

export async function getVisitsForVisitorAction(
  payload: GetVisitsPayload
): Promise<{ success: boolean; visits?: SerializableVisit[], lastVisible?: string; error?: string }> {
  const { visitorId, limit, startAfter, startDate } = payload;

  if (!visitorId) {
    return { success: false, error: 'Visitor ID is required.' };
  }

  const adminDb = await getAdminDb();
  if (!adminDb) {
    return { success: false, error: 'Server is not configured for admin access.' };
  }

  try {
    const { user } = await requireAuth();
    if (user.id !== visitorId) {
      throw new Error('Unauthorized: You can only view your own visits.');
    }

    let query = adminDb
      .from('visits')
      .select('*')
      .eq('visitor_id', visitorId)
      .order('checkin_time', { ascending: false })
      .limit(limit);

    if (startDate) {
      query = query.gte('checkin_time', new Date(startDate).toISOString());
    }

    // In Supabase offset is used for pagination, here we simulate cursor by finding checkin_time or just doing offset.
    // For simplicity, we just fetch assuming startAfter is checkin_time or similar if needed.
    // For now we'll fetch everything to handle proper pagination or just rely on the UI not using startAfter effectively yet.
    // To properly support startAfter we'd need the checkin_time of the last document.
    // If startAfter is provided, let's assume it's an ISO string timestamp from the last query for checkin_time.
    if (startAfter) {
      query = query.lt('checkin_time', startAfter);
    }

    const { data: visitsSnapshot, error } = await query;
    if (error) throw error;

    if (!visitsSnapshot || visitsSnapshot.length === 0) {
      return { success: true, visits: [], lastVisible: undefined };
    }

    const visits: SerializableVisit[] = (visitsSnapshot || []).map((data: Record<string, any>) => {
      const checkinTime = data.checkin_time;
      const checkoutTime = data.checkout_time || null;

      return {
        id: data.id,
        visitor_id: data.visitor_id,
        visitor_name: data.visitor_name,
        host_id: data.host_id,
        host_name: data.host_name,
        premise_id: data.premise_id,
        checkin_time: checkinTime,
        checkout_time: checkoutTime,
        status: data.status,
      };
    });

    const lastVisibleDocId = visitsSnapshot[visitsSnapshot.length - 1]?.checkin_time;

    return { success: true, visits, lastVisible: lastVisibleDocId };

  } catch (error: unknown) {
    console.error('Error fetching visitor visit history:', error);
    const msg = error instanceof Error ? error.message : 'An unknown server error occurred.';
    if (msg && (msg.includes('Could not refresh access token') || msg.includes('Credential'))) {
      return { success: false, error: 'Could not access database with admin privileges.' };
    }
    return {
      success: false,
      error: msg || 'An unknown server error occurred.',
    };
  }
}
