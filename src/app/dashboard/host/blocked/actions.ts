'use server';

import { getAdminDb } from '@/lib/supabase/server';
import type { HostBlock } from '@/services/user-service';

export type SerializableHostBlock = Omit<HostBlock, 'blockedAt'> & { id: string; blockedAt: string };

export async function getBlockedVisitorsForHost(hostId: string): Promise<{
    success: boolean;
    blocks?: SerializableHostBlock[];
    error?: string;
}> {
    if (!hostId) {
        return { success: false, error: 'Host ID is required.' };
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
        return { success: false, error: 'Server database connection is not available.' };
    }

    try {
        const { data: blocksSnapshot, error } = await adminDb
            .from('host_blocked_visitors')
            .select('*')
            .eq('host_id', hostId)
            .order('blockedAt', { ascending: false });

        if (error) throw error;

        if (!blocksSnapshot || blocksSnapshot.length === 0) {
            return { success: true, blocks: [] };
        }

        const blocks = blocksSnapshot.map((data: any) => {
            return {
                ...data,
                id: data.id,
                blockedAt: data.blockedAt,
            }
        });

        return { success: true, blocks };

    } catch (e: any) {
        console.error('Error fetching host block list:', e);
        const msg = e.message;
        if (msg && (msg.includes('Could not refresh access token') || msg.includes('credential'))) {
            return { success: false, error: 'The server could not authenticate.' };
        }
        return { success: false, error: 'An unknown server error occurred.' };
    }
}
