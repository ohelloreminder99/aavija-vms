'use server';

import * as Sentry from '@sentry/nextjs';
import { getAdminDb } from '@/lib/supabase/server';
import { Log } from '@/services/log-service';
import { LOG_LIST_COLS } from '@/types/database.types';

export type SerializableLog = Omit<Log, 'timestamp' | 'expires_at'> & { id: string, timestamp: string, expiresAt?: string };

/**
 * Fetches logs for a specific actor.
 */
export async function getLogsForActorAction(actor_id: string, role?: string): Promise<{
  logs: SerializableLog[] | null;
  error: string | null;
}> {
  try {
    const adminDb = await getAdminDb();
    if (!adminDb) throw new Error('Admin database connection not available.');

    const { data: logsData, error: logsError } = await adminDb
      .from('logs')
      .select(LOG_LIST_COLS)
      .eq('actor_id', actorId)
      .order('timestamp', { ascending: false })
      .limit(500);

    if (logsError) throw logsError;
    if (!logsData) return { logs: [], error: null };

    const logs = logsData as SerializableLog[];

    // Filtering logic for the dashboard views
    const filteredLogs = logs.filter(log => {
      const hasChange = log.token_change != null && log.token_change !== 0;
      if (!hasChange) return false;

      if (role === 'visitor') {
        return !log.premise_id;
      }
      if (role === 'host') {
        return log.actor_role === 'host';
      }
      return true;
    });

    return { logs: filteredLogs, error: null };

  } catch (e: any) {
    Sentry.captureException(e, { extra: { actorId, role } });
    console.error('Error fetching logs for actor:', e);
    return { logs: null, error: e.message || "An unknown server error occurred." };
  }
}

/**
 * Fetches logs associated with a specific premise.
 */
export async function getLogsForPremiseAction(premise_id: string): Promise<{
  logs: SerializableLog[] | null;
  error: string | null;
}> {
  try {
    const adminDb = await getAdminDb();
    if (!adminDb) throw new Error('Admin database connection not available.');

    const { data: logsData, error: logsError } = await adminDb
      .from('logs')
      .select(LOG_LIST_COLS)
      .eq('premise_id', premiseId)
      .order('timestamp', { ascending: false })
      .limit(500);

    if (logsError) throw logsError;
    if (!logsData) return { logs: [], error: null };

    const logs = logsData as SerializableLog[];

    return { logs: logs.filter(l => l.token_change != null && l.token_change !== 0), error: null };

  } catch (e: any) {
    Sentry.captureException(e, { extra: { premiseId } });
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
