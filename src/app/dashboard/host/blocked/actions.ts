'use server';

import { getAdminDb } from '@/lib/supabase/server';
import type { HostBlock } from '@/services/user-service';

export type SerializableHostBlock = Omit<HostBlock, 'blockedAt'> & { id: string; blockedAt: string };

export async function getBlockedVisitorsForHost(host_id: string, premiseId?: string): Promise<{
    success: boolean;
    blocks?: SerializableHostBlock[];
    error?: string;
}> {
    if (!hostId) {
        return { success: false, error: 'Host ID is required.' };
    }

    const adminDb = await getAdminDb();
    if (!adminDb) {
        return { success: false, error: 'Server database connection is not available.' };
    }

    try {
        const { data: blocksSnapshot, error } = await adminDb
            .rpc('get_host_blocked_list', {
                p_host_id: hostId,
                p_premise_id: premiseId
            });

        if (error) throw error;

        if (!blocksSnapshot || blocksSnapshot.length === 0) {
            return { success: true, blocks: [] };
        }

        const blocks = (blocksSnapshot || []).map((data: any) => {
            return {
                id: data.id,
                visitor_id: data.visitor_id,
                host_id: data.host_id,
                premise_id: data.premise_id,
                visitorName: data.visitor_name,
                visitorPhotoUrl: data.visitor_photo_url,
                blockedAt: data.blocked_at,
                blockedBy: data.blocked_by,
            }
        });

        return { success: true, blocks };

    } catch (e: any) {
        console.error('Error fetching host block list:', e);
        const msg = e.message || String(e);
        if (msg && (msg.includes('Could not refresh access token') || msg.includes('credential'))) {
            return { success: false, error: 'The server could not authenticate.' };
        }
        return { success: false, error: `Server error: ${msg}` };
    }
}
