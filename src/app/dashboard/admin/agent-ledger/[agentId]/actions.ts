'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { LogAction } from '@/services/log-actions';
import { createLogEntry } from '@/services/log-service';


interface PayoutPayload {
    agent_id: string;
    amount: number;
    description: string;
    actor: {
        id: string;
        name: string;
    }
}

/**
 * Records a manual payout (debit) to an agent's ledger.
 * @param payload The data for the payout.
 * @returns An object indicating success or failure.
 */
export async function recordAgentPayout(payload: PayoutPayload): Promise<{ success: boolean, error?: string }> {
    const { agentId, amount, description, actor } = payload;

    const adminDb = await getAdminDb();
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') throw new Error('Unauthorized');
    if (!adminDb) {
        return { success: false, error: "Server database connection not available." };
    }

    if (amount <= 0) {
        return { success: false, error: "Payout amount must be a positive number." };
    }

    try {
        let agentName = 'Unknown Agent';

        const { data: agentDoc, error: fetchError } = await adminDb.from('agents').select('*').eq('id', agentId).single();

        if (fetchError || !agentDoc) {
            throw new Error("Agent not found.");
        }
        agentName = agentDoc.name || 'Unknown Agent';

        const currentBalance = agentDoc.commission_balance || 0;
        if (currentBalance < amount) {
            throw new Error(`Payout amount (${amount}) exceeds agent's balance (${currentBalance}).`);
        }
        const newBalance = currentBalance - amount;

        // 1. Update agent's balance
        const { error: updateError } = await adminDb.from('agents').update({ commission_balance: newBalance }).eq('id', agentId);
        if (updateError) throw updateError;

        // 2. Create ledger entry
        const { error: ledgerError } = await adminDb.from('agent_ledger').insert({
            agent_id: agentId,
            timestamp: new Date().toISOString(),
            type: 'debit',
            amount: amount,
            balance_after: newBalance,
            description: description || 'Manual payout recorded by admin.',
        });
        if (ledgerError) throw ledgerError;

        // 3. Create global log entry (after transaction succeeds)
        await createLogEntry({
            actor_id: actor.id,
            actor_name: actor.name,
            actor_role: 'admin',
            action: LogAction.AGENT_PAYOUT_RECORDED,
            description: `Admin "${actor.name}" recorded a payout of ${amount} to agent "${agentName}".`,
            context: { agent_id: agentId },
        });

        return { success: true };
    } catch (e: any) {
        console.error("Error recording agent payout:", e);
        return { success: false, error: e.message || "An unknown error occurred." };
    }
}
