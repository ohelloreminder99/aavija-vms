'use server';

import { getAdminDb } from '@/lib/supabase/server';
import { LogAction, LogActionType } from './log-actions';

// This interface is for server-side use — matches DB column names (snake_case).
export interface Log {
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: LogActionType;
  timestamp: string;
  expires_at?: string;
  description: string;
  token_change?: number;
  premise_id?: string; // For premise-related logs
  context?: {
    [key: string]: any;
  };
}

type LogData = Omit<Log, 'id' | 'timestamp' | 'expires_at'>;

/**
 * Creates a new log entry in Supabase.
 */
export async function createLogEntry(data: LogData) {
  const adminDb = await getAdminDb();
  if (!adminDb) {
    console.error('Log creation skipped: Admin DB not available.');
    return;
  }

  try {
    const { data: settingsDoc } = await adminDb.from('settings').select('*').eq('id', 'global').single();
    const logTtlDays = settingsDoc?.log_ttl_days;
    const now = new Date();

    const logPayload: any = { ...data };

    if (data.context?.premise_id) {
      logPayload.premise_id = data.context.premise_id;
    }

    logPayload.timestamp = now.toISOString();

    if (logTtlDays && Number.isInteger(logTtlDays) && logTtlDays > 0) {
      const expiresAt = new Date(now.getTime() + logTtlDays * 24 * 60 * 60 * 1000);
      logPayload.expires_at = expiresAt.toISOString();
    }

    await adminDb.from('logs').insert(logPayload);
  } catch (e) {
    console.error(`Failed to create log entry:`, e);
  }
}
