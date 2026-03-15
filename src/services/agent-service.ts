'use server';

/**
 * AAVIJA VMS — Agent Service (Phase 2B Redesign)
 * See file header above for full design notes.
 */

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  notifyPayoutApproved,
  notifyPayoutRejected,
  notifyKycVerified,
  notifyTokensConverted,
  notifyAgentAssigned,
} from '@/services/whatsapp-service';
import { createLogEntry } from '@/services/log-service';
import { LogAction } from '@/services/log-actions';

// ─── TYPES ──────────────────────────────────────────────────────────────────


export type PayoutRequest = {
  id: string;
  user_id: string;
  amount: number;
  type: 'cash' | 'token_conversion';
  status: 'pending' | 'processing' | 'paid' | 'rejected';
  source: 'agent' | 'referral' | 'combined';
  upi_id?: string;
  tds_deducted?: number;
  net_amount?: number;
  admin_note?: string;
  tokens_credited?: number;
  conversion_rate?: number;
  requested_at: string;
  processed_at?: string;
  context?: Record<string, any>;
};

export type Agent = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

export type AgentOverview = {
  id: string;
  name: string;
  email: string;
  phone: string;
  photo_url: string;
  is_agent: boolean;
  agent_commission_balance: number;
  kyc_verified: boolean;
  pan_number?: string;
  pan_card_url?: string;
  agent_payout_upi?: string;
  premise_count?: number;
};

// ─── AGENT DESIGNATION ──────────────────────────────────────────────────────

/**
 * Looks up a user by email, designates them as an agent, and links them to a premise.
 * Uses an atomic Postgres RPC so all 3 writes happen together or not at all.
 */
export async function designateAgentByEmail(
  agentEmail: string,
  premiseId: string
): Promise<{ success: boolean; agentId?: string; agentName?: string; error?: string }> {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') throw new Error('Unauthorized: Only admins can designate agents.');

    const adminDb = await getAdminDb();
    if (!adminDb) throw new Error('Admin database not available.');

    const { data, error } = await adminDb.rpc('rpc_designate_agent_by_email', {
      p_agent_email: agentEmail.trim().toLowerCase(),
      p_premise_id: premiseId,
      p_admin_id: profile.id,
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to designate agent.');

    revalidatePath('/dashboard/admin/premises');
    revalidatePath('/dashboard/admin/agents');

    // Non-fatal WhatsApp notification to the agent
    try {
      const { data: agentUser } = await adminDb
        .from('users')
        .select('phone, name')
        .eq('id', data.agentId)
        .single();
      // Also fetch premise name for a meaningful message
      const { data: premiseData } = await adminDb
        .from('premises')
        .select('name')
        .eq('id', premiseId)
        .single();
      if (agentUser?.phone && premiseData?.name) {
        void notifyAgentAssigned({
          phone: agentUser.phone,
          agentName: agentUser.name || data.agentName,
          premiseName: premiseData.name,
        });
      }
    } catch (notifyErr: unknown) {
      console.error('[WhatsApp] notifyAgentAssigned failed (non-fatal):', notifyErr instanceof Error ? notifyErr.message : 'Unknown error');
    }

    return { success: true, agentId: data.agentId, agentName: data.agentName };
  } catch (e: unknown) {
    console.error('Error designating agent:', e);
    return { success: false, error: e instanceof Error ? e.message : 'An unknown error occurred.' };
  }
}

/**
 * Resolves an agent email to a user preview (for real-time lookup as admin types).
 * Does NOT write anything — just a read for the UI confirmation step.
 */
export async function lookupUserByEmail(
  email: string
): Promise<{ success: boolean; user?: { id: string; name: string; photo_url: string; is_agent: boolean }; error?: string }> {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') throw new Error('Unauthorized');

    const adminDb = await getAdminDb();
    if (!adminDb) throw new Error('Admin database not available.');

    const { data, error } = await adminDb
      .from('users')
      .select('id, name, photo_url, is_agent')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (error || !data) {
      return { success: false, error: 'No user found with that email. Ask them to sign up first.' };
    }

    return { success: true, user: data };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'An unknown error occurred.' };
  }
}

/**
 * Remove agent designation from a user.
 * Their commission history (agent_ledger) is preserved.
 */
export async function removeAgentDesignation(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') throw new Error('Unauthorized');

    const adminDb = await getAdminDb();
    if (!adminDb) throw new Error('Admin database not available.');

    await adminDb.from('users').update({ is_agent: false }).eq('id', userId);
    revalidatePath('/dashboard/admin/agents');
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'An unknown error occurred.' };
  }
}

// ─── PAYOUT REQUEST (USER SELF-SERVICE) ─────────────────────────────────────

/**
 * User submits a payout request. Balance is frozen but NOT deducted yet.
 * Admin must approve (rpc_process_payout) to actually deduct the balance.
 *
 * KYC gate: user must have kyc_verified=true and agent_payout_upi set for cash.
 */
export async function submitPayoutRequest(payload: {
  type: 'cash' | 'token_conversion';
  source: 'agent' | 'referral' | 'combined';
  amount: number;
  tokensRequested?: number;   // for token_conversion: how many tokens to credit
  conversionRate?: number;    // snapshot of admin's conversion rate at time of request
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, profile } = await requireAuth();
    const adminDb = await getAdminDb();
    if (!adminDb) throw new Error('Admin database not available.');

    // KYC gate for cash payouts
    if (payload.type === 'cash') {
      if (!profile.kyc_verified) {
        throw new Error('KYC not verified. Complete your KYC (UPI ID + PAN card) before requesting a cash payout.');
      }
      if (!profile.agent_payout_upi) {
        throw new Error('UPI ID is required for cash payouts. Add it in your profile settings.');
      }
    }

    // Check no pending request already exists
    const { data: existing } = await adminDb
      .from('payout_requests')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing'])
      .limit(1)
      .single();

    if (existing) {
      throw new Error('You already have a pending payout request. Wait for admin to process it before submitting another.');
    }

    // Check settings for threshold
    const { data: settings } = await adminDb
      .from('settings')
      .select('payout_threshold_agent, token_conversion_rate, tds_enabled, tds_rate')
      .eq('id', 'global')
      .single();

    if (!settings) throw new Error('System configuration unavailable. Please try again.');

    const threshold = settings.payout_threshold_agent || 0;
    if (profile.agent_commission_balance < threshold) {
      throw new Error(`Your balance (₹${profile.agent_commission_balance}) hasn't reached the payout threshold (₹${threshold}).`);
    }

    // Calculate TDS for cash payouts
    let tdsDeducted = 0;
    let netAmount = payload.amount;
    if (payload.type === 'cash' && settings.tds_enabled) {
      tdsDeducted = Math.floor(payload.amount * (settings.tds_rate / 100) * 100) / 100;
      netAmount = payload.amount - tdsDeducted;
    }

    const { error } = await adminDb.from('payout_requests').insert({
      user_id: user.id,
      amount: payload.amount,
      type: payload.type,
      status: 'pending',
      source: payload.source,
      upi_id: payload.type === 'cash' ? profile.agent_payout_upi : null,
      tds_deducted: tdsDeducted,
      net_amount: netAmount,
      tokens_credited: payload.tokensRequested || 0,
      conversion_rate: payload.conversionRate || settings.token_conversion_rate || 1,
      context: { userSnapshotBalance: profile.agent_commission_balance },
    });

    if (error) throw error;

    revalidatePath('/dashboard/visitor/earnings');
    return { success: true };
  } catch (e: unknown) {
    console.error('Error submitting payout request:', e);
    return { success: false, error: e instanceof Error ? e.message : 'An unknown error occurred.' };
  }
}

// ─── PAYOUT APPROVAL (ADMIN) ─────────────────────────────────────────────────

/**
 * Admin marks a payout request as paid.
 * For cash: enters UTR reference. Balance deducted atomically via RPC.
 * For token_conversion: one-click, tokens credited atomically via RPC.
 */
export async function adminProcessPayout(
  requestId: string,
  utrNote?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') throw new Error('Unauthorized');

    const adminDb = await getAdminDb();
    if (!adminDb) throw new Error('Admin database not available.');

    // Fetch request info for WhatsApp notification BEFORE the RPC modifies it
    const { data: reqInfo } = await adminDb
      .from('payout_requests')
      .select('user_id, type, amount, tokens_credited')
      .eq('id', requestId)
      .single();

    const { data, error } = await adminDb.rpc('rpc_process_payout', {
      p_request_id: requestId,
      p_admin_id: profile.id,
      p_utr_note: utrNote || null,
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to process payout.');

    revalidatePath('/dashboard/admin/payouts');

    // Audit log
    if (reqInfo) {
      try {
        const { data: reqUser } = await adminDb.from('users').select('phone, name').eq('id', reqInfo.user_id).single();
        const agentName = reqUser?.name || 'Unknown Agent';
        const logDesc = reqInfo.type === 'token_conversion'
          ? `Admin ${profile.name} approved token conversion for ${agentName}: ${reqInfo.tokens_credited || 0} tokens credited.`
          : `Admin ${profile.name} approved cash payout of ₹${reqInfo.amount} for ${agentName}. UTR: ${utrNote || 'N/A'}.`;
        void createLogEntry({
          actorId: profile.id,
          actorName: profile.name,
          actorRole: 'admin',
          action: LogAction.PAYOUT_APPROVED,
          description: logDesc,
        });
        // WhatsApp notification
        if (reqUser?.phone) {
          if (reqInfo.type === 'token_conversion') {
            void notifyTokensConverted({ phone: reqUser.phone, name: reqUser.name, tokens: String(reqInfo.tokens_credited || 0) });
          } else {
            void notifyPayoutApproved({ phone: reqUser.phone, name: reqUser.name, amount: String(reqInfo.amount), utr: utrNote || 'N/A' });
          }
        }
      } catch (notifyErr: unknown) {
        console.error('[WhatsApp] Payout approved notify failed (non-fatal):', notifyErr instanceof Error ? notifyErr.message : 'Unknown error');
      }
    }

    return { success: true };
  } catch (e: unknown) {
    console.error('Error processing payout:', e);
    return { success: false, error: e instanceof Error ? e.message : 'An unknown error occurred.' };
  }
}

/**
 * Admin rejects a payout request with a reason.
 * Balance remains, user is notified.
 */
export async function adminRejectPayout(
  requestId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') throw new Error('Unauthorized');

    const adminDb = await getAdminDb();
    if (!adminDb) throw new Error('Admin database not available.');

    const { data, error } = await adminDb.rpc('rpc_reject_payout', {
      p_request_id: requestId,
      p_admin_id: profile.id,
      p_reason: reason,
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to reject payout.');

    revalidatePath('/dashboard/admin/payouts');

    // Audit log + WhatsApp notification
    try {
      const { data: reqInfo } = await adminDb
        .from('payout_requests').select('amount, user_id').eq('id', requestId).single();
      if (reqInfo) {
        const { data: reqUser } = await adminDb.from('users').select('phone, name').eq('id', reqInfo.user_id).single();
        const agentName = reqUser?.name || 'Unknown Agent';
        void createLogEntry({
          actorId: profile.id,
          actorName: profile.name,
          actorRole: 'admin',
          action: LogAction.PAYOUT_REJECTED,
          description: `Admin ${profile.name} rejected payout of ₹${reqInfo.amount} for ${agentName}. Reason: ${reason}.`,
        });
        if (reqUser?.phone) {
          void notifyPayoutRejected({ phone: reqUser.phone, name: reqUser.name, amount: String(reqInfo.amount), reason });
        }
      }
    } catch (notifyErr: any) {
      console.error('[WhatsApp] Payout rejected notify failed (non-fatal):', notifyErr.message);
    }

    return { success: true };
  } catch (e: unknown) {
    console.error('Error rejecting payout:', e);
    return { success: false, error: e instanceof Error ? e.message : 'An unknown error occurred.' };
  }
}

// ─── KYC UPDATE (USER SELF-SERVICE) ──────────────────────────────────────────

/**
 * User updates their payout UPI / PAN number.
 * KYC verification itself (kyc_verified=true) is set only by admin via adminUpdateUser().
 */
export async function updatePayoutDetails(payload: {
  agent_payout_upi?: string;
  pan_number?: string;
  pan_card_url?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await requireAuth();
    const adminDb = await getAdminDb();
    if (!adminDb) throw new Error('Admin database not available.');

    const { error } = await adminDb
      .from('users')
      .update(payload)
      .eq('id', user.id);

    if (error) throw error;
    revalidatePath('/dashboard/visitor/earnings');
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'An unknown error occurred.' };
  }
}

// ─── ADMIN DATA FETCHERS ───────────────────────────────────────────────────

/**
 * Admin: Get all pending payout requests with user details.
 */
export async function getPayoutRequestsForAdmin(): Promise<{
  success: boolean;
  data?: (PayoutRequest & { userName: string; userEmail: string; userPhoto: string })[];
  error?: string;
}> {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') throw new Error('Unauthorized');

    const adminDb = await getAdminDb();
    if (!adminDb) throw new Error('Admin database not available.');

    const { data: requests, error } = await adminDb
      .from('payout_requests')
      .select('*')
      .order('requested_at', { ascending: true });

    if (error) throw error;

    const userIds = [...new Set((requests || []).map((r: PayoutRequest) => r.user_id))];
    const { data: users } = await adminDb
      .from('users')
      .select('id, name, email, photo_url')
      .in('id', userIds);

    const userMap = new Map((users || []).map((u: Record<string, any>) => [u.id, u]));

    const enriched = (requests || []).map((r: PayoutRequest) => ({
      ...r,
      userName: userMap.get(r.user_id)?.name || 'Unknown',
      userEmail: userMap.get(r.user_id)?.email || '',
      userPhoto: userMap.get(r.user_id)?.photo_url || '',
    }));

    return { success: true, data: enriched };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'An unknown error occurred.' };
  }
}

/**
 * Admin: Get all agents overview (all users where is_agent=true).
 */
export async function getAgentsOverview(): Promise<{
  success: boolean;
  data?: AgentOverview[];
  error?: string;
}> {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') throw new Error('Unauthorized');

    const adminDb = await getAdminDb();
    if (!adminDb) throw new Error('Admin database not available.');

    const { data, error } = await adminDb
      .from('users')
      .select('id, name, email, phone, photo_url, is_agent, agent_commission_balance, kyc_verified, pan_number, pan_card_url, agent_payout_upi')
      .eq('is_agent', true)
      .order('agent_commission_balance', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'An unknown error occurred.' };
  }
}

/**
 * Admin: Approve KYC for an agent (sets kyc_verified=true).
 */
export async function adminApproveKyc(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') throw new Error('Unauthorized');

    const adminDb = await getAdminDb();
    if (!adminDb) throw new Error('Admin database not available.');

    const { data: user } = await adminDb.from('users').select('name, phone').eq('id', userId).single();
    await adminDb.from('users').update({ kyc_verified: true }).eq('id', userId);
    
    if (user?.phone) {
      notifyKycVerified({
        phone: user.phone,
        name: user.name || 'Agent',
      });
    }

    revalidatePath('/dashboard/admin/agents');
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'An unknown error occurred.' };
  }
}
