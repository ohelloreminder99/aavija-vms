'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { Log } from '@/services/log-service';

// A version of the Log type that is safe to pass from server to client
export type SerializableLog = Omit<Log, 'timestamp' | 'expiresAt'> & { id: string, timestamp: string, expiresAt?: string };

interface GetLogsPayload {
    role?: string;
    action?: string;
}

/**
 * A server action to securely fetch all logs for the admin dashboard.
 */
export async function getAdminLogs(payload: GetLogsPayload): Promise<{ logs: SerializableLog[]; error?: string; }> {
    const { role, action } = payload;
    const adminDb = getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
    if (!adminDb) {
        return { logs: [], error: 'Server is not configured for admin access.' };
    }

    try {
        let logsQuery = adminDb.from('logs').select('*');

        if (role && role !== 'all') {
            logsQuery = logsQuery.eq('actorRole', role);
        } else if (action && action !== 'all') {
            logsQuery = logsQuery.eq('action', action);
        }

        logsQuery = logsQuery.order('timestamp', { ascending: false }).limit(1000);

        const { data: snapshot, error } = await logsQuery;

        if (error) throw error;

        if (!snapshot || snapshot.length === 0) {
            return { logs: [] };
        }

        const logs: SerializableLog[] = snapshot.map((data: any) => {
            const { expiresAt, ...rest } = data;

            return {
                ...rest,
                id: data.id,
                timestamp: data.timestamp,
                ...(expiresAt && { expiresAt: expiresAt }),
            };
        });

        return { logs };
    } catch (e: any) {
        console.error('Error fetching admin logs:', e);
        return { logs: [], error: e.message || 'An unknown server error occurred.' };
    }
}
