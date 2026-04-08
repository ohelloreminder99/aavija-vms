'use server';

/**
 * AAVIJA VMS — Block Service
 * Author note (Phase 2A, 2026-03-07 by Antigravity):
 *   All block/unblock operations now use atomic Postgres RPC functions
 *   (rpc_block_visitor_premise, rpc_unblock_visitor_premise,
 *    rpc_block_visitor_host, rpc_unblock_visitor_host).
 *   This eliminates the previous race condition where two simultaneous block
 *   actions could both read the same balance and each write the same reduced
 *   value, effectively performing one deduction for the price of two.
 *   The RPCs use FOR UPDATE row locking + all writes in a single transaction.
 *   See: database_sql_backups/phase2a_migrations.sql
 */

import { getAdminDb } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// === DATA TYPES ===

export interface PremiseBlock {
  blockedAt: string;
  blockedBy: string;
  visitorName: string;
  visitorPhotoUrl: string;
}

export interface HostBlock {
  blockedAt: string;
  blockedBy: string;
  visitorName: string;
  visitorPhotoUrl: string;
}

// === SHARED HELPERS ===

interface BlockActionPayload {
  actor_id: string;
  actor_name: string;
  actor_role: string;
  visitor_id: string;
}

interface PremiseBlockPayload extends BlockActionPayload {
  premise_id: string;
  visitorName: string;
  visitorPhotoUrl: string;
}

interface HostBlockPayload extends BlockActionPayload {
  host_id: string;
  premise_id: string; // Added premiseId
  visitorName: string;
  visitorPhotoUrl: string;
}

/**
 * Fetches settings and calculates the log expiry timestamp.
 * Returns null for expiresAt if TTL is not configured.
 */
async function getLogExpiry(adminDb: NonNullable<Awaited<ReturnType<typeof getAdminDb>>>): Promise<{
  settings: Record<string, any>;
  expires_at: string | null;
}> {
  const { data: settings } = await adminDb
    .from('settings')
    .select('log_ttl_days, block_visitor_cost, unblock_visitor_cost, block_visitor_cost_host, unblock_visitor_cost_host')
    .eq('id', 'global')
    .single();

  // GUARD: Settings must be available for any token operation.
  // If null, actions would silently cost 0 tokens — that is never acceptable.
  if (!settings) {
    throw new Error('System configuration unavailable. Action aborted for safety.');
  }

  let expires_at: string | null = null;
  const ttlDays = settings.log_ttl_days;
  if (ttlDays && Number.isInteger(ttlDays) && ttlDays > 0) {
    expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
  }

  return { settings, expiresAt };
}


// === SERVER ACTIONS ===

export async function blockVisitorFromPremise(
  payload: PremiseBlockPayload
): Promise<{ success: boolean; error?: string }> {
  const { premiseId, visitorId, actorId, actorName, actorRole, visitorName, visitorPhotoUrl } = payload;

  const adminDb = await getAdminDb();
  if (!adminDb) return { success: false, error: 'Admin database not available.' };

  try {
    const { settings, expiresAt } = await getLogExpiry(adminDb);
    const blockCost = settings.block_visitor_cost ?? 0;

    const { data, error } = await adminDb.rpc('rpc_block_visitor_premise', {
      p_premise_id: premiseId,
      p_visitor_id: visitorId,
      p_block_cost: settings?.block_visitor_cost ?? 0,
      p_actor_id: actorId,
      p_actor_name: actorName,
      p_actor_role: actorRole,
      p_visitor_name: visitorName,
      p_visitor_photo: visitorPhotoUrl,
      p_expires_at: expiresAt,
    });

    if (error) throw error;
    if (data && !data.success) throw new Error(data.error);

    revalidatePath('/dashboard/owner/blocked');
    revalidatePath('/dashboard/owner/history');
    return { success: true };
  } catch (e: any) {
    console.error('Error blocking visitor from premise:', e);
    return { success: false, error: e.message };
  }
}


export async function unblockVisitorFromPremise(
  payload: Omit<PremiseBlockPayload, 'visitorName' | 'visitorPhotoUrl'>
): Promise<{ success: boolean; error?: string }> {
  const { premiseId, visitorId, actorId, actorName, actorRole } = payload;

  const adminDb = await getAdminDb();
  if (!adminDb) return { success: false, error: 'Admin database not available.' };

  try {
    const { settings, expiresAt } = await getLogExpiry(adminDb);
    const unblockCost = settings.unblock_visitor_cost ?? 0;

    const { data, error } = await adminDb.rpc('rpc_unblock_visitor_premise', {
      p_premise_id: premiseId,
      p_visitor_id: visitorId,
      p_unblock_cost: settings?.unblock_visitor_cost ?? 0,
      p_actor_id: actorId,
      p_actor_name: actorName,
      p_actor_role: actorRole,
      p_expires_at: expiresAt,
    });

    if (error) throw error;
    if (data && !data.success) throw new Error(data.error);

    revalidatePath('/dashboard/owner/blocked');
    return { success: true };
  } catch (e: any) {
    console.error('Error unblocking visitor from premise:', e);
    return { success: false, error: e.message };
  }
}


export async function blockVisitorFromHost(
  payload: HostBlockPayload
): Promise<{ success: boolean; error?: string }> {
  const { hostId, visitorId, actorId, actorName, actorRole, visitorName, visitorPhotoUrl } = payload;

  const adminDb = await getAdminDb();
  if (!adminDb) return { success: false, error: 'Admin database not available.' };

  try {
    const { settings, expiresAt } = await getLogExpiry(adminDb);
    const blockCost = settings.block_visitor_cost_host ?? 0;

    const { data, error } = await adminDb.rpc('rpc_block_visitor_host', {
      p_host_id: hostId,
      p_visitor_id: visitorId,
      p_block_cost: settings?.block_visitor_cost_host ?? 0,
      p_actor_id: actorId,
      p_actor_name: actorName,
      p_actor_role: actorRole,
      p_visitor_name: visitorName,
      p_visitor_photo: visitorPhotoUrl,
      p_premise_id: payload.premise_id, // Pass premiseId
      p_expires_at: expiresAt,
    });

    if (error) throw error;
    if (data && !data.success) throw new Error(data.error);

    revalidatePath('/dashboard/host/blocked');
    return { success: true };
  } catch (e: any) {
    console.error('Error blocking visitor from host:', e);
    return { success: false, error: e.message };
  }
}


export async function unblockVisitorFromHost(
  payload: Omit<HostBlockPayload, 'visitorName' | 'visitorPhotoUrl'>
): Promise<{ success: boolean; error?: string }> {
  const { hostId, visitorId, actorId, actorName, actorRole } = payload;

  const adminDb = await getAdminDb();
  if (!adminDb) return { success: false, error: 'Admin database not available.' };

  try {
    const { settings, expiresAt } = await getLogExpiry(adminDb);
    const unblockCost = settings.unblock_visitor_cost_host ?? 0;

    const { data, error } = await adminDb.rpc('rpc_unblock_visitor_host', {
      p_host_id: hostId,
      p_visitor_id: visitorId,
      p_premise_id: payload.premise_id, // Pass premiseId
      p_unblock_cost: settings?.unblock_visitor_cost_host ?? 0,
      p_actor_id: actorId,
      p_actor_name: actorName,
      p_actor_role: actorRole,
      p_expires_at: expiresAt,
    });

    if (error) throw error;
    if (data && !data.success) throw new Error(data.error);

    revalidatePath('/dashboard/host/blocked');
    return { success: true };
  } catch (e: any) {
    console.error('Error unblocking visitor from host:', e);
    return { success: false, error: e.message };
  }
}
