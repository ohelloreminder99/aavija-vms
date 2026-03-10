'use server';

import { getAdminDb } from '@/lib/supabase/server';
import { Log } from '@/services/log-service';

export type SerializableLog = Omit<Log, 'timestamp' | 'expiresAt'> & { id: string, timestamp: string, expiresAt?: string };

/**
 * Fetches logs for a specific actor.
 */
export async function getLogsForActorAction(actorId: string, role?: string): Promise<{
  logs: SerializableLog[] | null;
  error: string | null;
}> {
  try {
    const adminDb = await getAdminDb();
    if (!adminDb) throw new Error('Admin database connection not available.');

    const { data: logsData, error: logsError } = await adminDb
      .from('logs')
      .select('*')
      .eq('actorId', actorId)
      .order('timestamp', { ascending: false })
      .limit(500);

    if (logsError) throw logsError;
    if (!logsData) return { logs: [], error: null };

    const logs = logsData as SerializableLog[];

    // Filtering logic for the dashboard views
    const filteredLogs = logs.filter(log => {
      const hasChange = log.tokenChange != null && log.tokenChange !== 0;
      if (!hasChange) return false;

      if (role === 'visitor') {
        return !log.premiseId;
      }
      if (role === 'host') {
        return log.actorRole === 'host';
      }
      return true;
    });

    return { logs: filteredLogs, error: null };

  } catch (e: any) {
    console.error('Error fetching logs for actor:', e);
    return { logs: null, error: e.message || "An unknown server error occurred." };
  }
}

/**
 * Fetches logs associated with a specific premise.
 */
export async function getLogsForPremiseAction(premiseId: string): Promise<{
  logs: SerializableLog[] | null;
  error: string | null;
}> {
  try {
    const adminDb = await getAdminDb();
    if (!adminDb) throw new Error('Admin database connection not available.');

    const { data: logsData, error: logsError } = await adminDb
      .from('logs')
      .select('*')
      .eq('premiseId', premiseId)
      .order('timestamp', { ascending: false })
      .limit(500);

    if (logsError) throw logsError;
    if (!logsData) return { logs: [], error: null };

    const logs = logsData as SerializableLog[];

    return { logs: logs.filter(l => l.tokenChange != null && l.tokenChange !== 0), error: null };

  } catch (e: any) {
    console.error('Error fetching logs for premise:', e);
    return { logs: null, error: e.message || "An unknown server error occurred." };
  }
}

export async function getInvoiceById(invoiceId: string) {
  const adminDb = await getAdminDb();
  if (!adminDb) return null;
  try {
    const { data, error } = await adminDb.from('invoices').select('*').eq('id', invoiceId).single();
    if (error || !data) return null;
    return data;
  } catch (e) {
    console.error("Error fetching invoice:", e);
    return null;
  }
}
