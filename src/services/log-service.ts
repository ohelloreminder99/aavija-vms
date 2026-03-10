'use server';

import { getAdminDb } from '@/lib/supabase/server';
import { LogAction, LogActionType } from './log-actions';

// This interface is for server-side use.
export interface Log {
  actorId: string;
  actorName: string;
  actorRole: string;
  action: LogActionType;
  timestamp: string;
  expiresAt?: string;
  description: string;
  tokenChange?: number;
  premiseId?: string; // For premise-related logs
  context?: {
    [key: string]: any;
  };
}

type LogData = Omit<Log, 'id' | 'timestamp' | 'expiresAt'>;

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

    if (data.context?.premiseId) {
      logPayload.premiseId = data.context.premiseId;
    }

    logPayload.timestamp = now.toISOString();

    if (logTtlDays && Number.isInteger(logTtlDays) && logTtlDays > 0) {
      const expiresAt = new Date(now.getTime() + logTtlDays * 24 * 60 * 60 * 1000);
      logPayload.expiresAt = expiresAt.toISOString();
    }

    await adminDb.from('logs').insert(logPayload);
  } catch (e) {
    console.error(`Failed to create log entry:`, e);
  }
}
