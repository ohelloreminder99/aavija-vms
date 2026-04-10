'use server';

import { getAdminDb } from '@/lib/supabase/server';

// === DATA TYPES ===

export interface AgentLedgerEntry {
  id: string;
  timestamp: string; // ISO string for serialization
  type: 'credit' | 'debit';
  amount: number;
  balance_after: number;
  description: string;
  context?: {
    premiseId?: string;
    premiseName?: string;
    purchaseAmount?: number;
    invoiceId?: string;
    relatedLogId?: string;
  };
}

// === SERVER ACTIONS ===

/**
 * Fetches all ledger entries for a specific agent securely using the Admin SDK.
 */
export async function getAgentLedgerAction(agent_id: string): Promise<{
  success: boolean;
  ledger?: AgentLedgerEntry[];
  error?: string;
}> {
  if (!agent_id) return { success: false, error: 'Agent ID is required.' };

  const adminDb = await getAdminDb();
  if (!adminDb) {
    return { success: false, error: 'Server database connection not available.' };
  }

  try {
    const { data: snapshot, error } = await adminDb
      .from('agent_ledger')
      .select('*')
      .eq('agent_id', agent_id)
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (error) throw error;
    if (!snapshot || snapshot.length === 0) return { success: true, ledger: [] };

    const ledger: AgentLedgerEntry[] = snapshot.map((data: Record<string, any>) => {
      return {
        id: data.id,
        timestamp: data.timestamp,
        type: data.type,
        amount: data.amount,
        balance_after: data.balance_after,
        description: data.description,
        context: data.context,
      };
    });

    return { success: true, ledger };
  } catch (e: unknown) {
    console.error('Error fetching agent ledger:', e);
    return { success: false, error: e instanceof Error ? e.message : 'An unknown server error occurred.' };
  }
}
