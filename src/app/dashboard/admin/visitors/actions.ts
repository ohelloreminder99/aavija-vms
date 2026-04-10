'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { Visit } from '@/services/visit-service';

// A serializable version of the Visit type, since Timestamps aren't directly supported in Server Action returns
type SerializableVisit = {
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


export async function getVisitsForVisitor(
  visitor_id: string
): Promise<{ success: boolean; visits?: SerializableVisit[]; error?: string }> {
  if (!visitor_id) {
    return { success: false, error: 'Visitor ID is required.' };
  }

  const adminDb = await getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
  if (!adminDb) {
    return { success: false, error: 'Server is not configured for admin access.' };
  }

  try {
    const { data: visitsSnapshot, error } = await adminDb
      .from('visits')
      .select('*')
      .eq('visitor_id', visitor_id)
      .order('checkin_time', { ascending: false });

    if (error) throw error;

    if (!visitsSnapshot || visitsSnapshot.length === 0) {
      return { success: true, visits: [] };
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
        vehicle_details: data.vehicle_details,
        visitor_snapshot_url: data.visitor_snapshot_url,
        status: data.status,
      };
    });

    return { success: true, visits };
  } catch (error: any) {
    console.error('Error fetching visitor history:', error);

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
