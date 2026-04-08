'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { LogAction } from '@/services/log-actions';
import { createLogEntry } from '@/services/log-service';

interface DeductTokensPayload {
  target: {
    type: 'user' | 'premise';
    id: string;
  };
  actor_id: string;
  actor_name: string;
  actor_role: string;
  exportType: 'csv' | 'pdf';
  premiseIdForLog?: string; // For context when a user (host/visitor) exports
}

export async function deductTokensForExport(
  payload: Omit<DeductTokensPayload, 'cost'>
): Promise<{ success: boolean; error?: string; deductedCost?: number }> {
  const { target, actorId, actorName, actorRole, exportType, premiseIdForLog } = payload;
  let finalCost = 0;
  const adminDb = await getAdminDb();
  if (!adminDb) {
    return {
      success: false,
      error:
        'Admin database not available. This action cannot be performed in the current environment.',
    };
  }

  const table = target.type === 'premise' ? 'premises' : 'users';
  const balanceField = target.type === 'premise' ? 'token_balance' : 'token_balance_visitor';

  try {
    const { user, profile } = await requireAuth();

    const { data: targetData, error: fetchError } = await adminDb
      .from(table)
      .select('*')
      .eq('id', target.id)
      .single();

    if (fetchError || !targetData) {
      throw new Error(`${target.type === 'premise' ? 'Premise' : 'User'} data could not be loaded.`);
    }

    if (profile.role !== 'admin') {
      if (target.type === 'user' && target.id !== user.id) throw new Error('Unauthorized');
      if (target.type === 'premise') {
        // Allow owner, gatekeeper, or host of this premise
        const isOwner = (targetData as any).owner_id === user.id;
        const premiseRoles = profile.premise_roles || {};
        const userRolesForPremise = premiseRoles[target.id];
        const isAssigned = Array.isArray(userRolesForPremise)
          ? userRolesForPremise.length > 0
          : !!userRolesForPremise;
        if (!isOwner && !isAssigned) throw new Error('Unauthorized');
      }
    }

    // --- SECURE COST CALCULATION ---
    if (target.type === 'premise') {
      const categoryId = (targetData as any).category_id;
      if (!categoryId) throw new Error("Premise does not have an assigned category.");

      const { data: categoryData } = await adminDb
        .from('premise_categories')
        .select('pdf_export_cost, csv_export_cost')
        .eq('id', categoryId)
        .single();

      if (!categoryData) throw new Error("Assigned premise category not found.");
      finalCost = exportType === 'csv' ? categoryData.csv_export_cost : categoryData.pdf_export_cost;
    } else {
      const { data: globalSettings } = await adminDb
        .from('settings')
        .select('*')
        .eq('id', 'global')
        .single();

      if (!globalSettings) throw new Error("Global token settings not found.");

      if (actorRole === 'host') {
        finalCost = exportType === 'csv' ? globalSettings.csv_export_cost_host : globalSettings.pdf_export_cost_host;
      } else {
        finalCost = exportType === 'csv' ? globalSettings.csv_export_cost_visitor : globalSettings.pdf_export_cost_visitor;
      }
    }
    // ---------------------------------

    const currentBalance = (targetData as any)[balanceField] || 0;

    if (currentBalance < finalCost) {
      throw new Error(
        `Insufficient tokens. This export costs ${finalCost} tokens, but the balance is only ${currentBalance}.`
      );
    }

    const { error: updateError } = await adminDb
      .from(table)
      .update({ [balanceField]: currentBalance - finalCost })
      .eq('id', target.id);

    if (updateError) throw updateError;

    // Dynamically select the correct role-specific log action
    const logActionKey = exportType === 'csv'
      ? `${actorRole.toUpperCase()}_EXPORT_CSV`
      : `${actorRole.toUpperCase()}_EXPORT_PDF`;
    const logAction = (LogAction as any)[logActionKey] || (exportType === 'csv' ? LogAction.OWNER_EXPORT_CSV : LogAction.OWNER_EXPORT_PDF);

    await createLogEntry({
      actor_id: actorId,
      actor_name: actorName,
      actor_role: actorRole,
      action: logAction,
      description: `${actorRole} "${actorName}" exported visit history as ${exportType.toUpperCase()}. Cost: ${finalCost} tokens.`,
      token_change: -finalCost,
      context: { premise_id: premiseIdForLog || (target.type === 'premise' ? target.id : undefined) },
    });

    if (target.type === 'premise') {
      revalidatePath(`/dashboard/owner?premiseId=${target.id}`);
    } else {
      revalidatePath(`/dashboard/${actorRole.toLowerCase()}/history`);
    }

    return { success: true };
  } catch (e: any) {
    console.error('Error deducting tokens for export:', e);
    return { success: false, error: e.message };
  }
}

export async function getVisitsForExport({
  premiseId,
  visitorId,
  hostId,
  startDate,
  endDate
}: {
  premiseId?: string;
  visitorId?: string;
  hostId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const adminDb = await getAdminDb();
  if (!adminDb) return { success: false, error: 'Database not available' };

  try {
    const { user, profile } = await requireAuth();

    if (profile.role !== 'admin') {
      if (visitorId && visitorId !== user.id) throw new Error('Unauthorized');
      if (hostId && hostId !== user.id) throw new Error('Unauthorized');
      if (premiseId && !visitorId && !hostId) {
        const { data: premise } = await adminDb.from('premises').select('owner_id').eq('id', premiseId).single();
        if (premise?.owner_id !== user.id) throw new Error('Unauthorized');
      }
    }

    let query = adminDb.from('visits').select('*');

    if (premiseId) query = query.eq('premise_id', premiseId);
    if (visitorId) query = query.eq('visitor_id', visitorId);
    if (hostId) query = query.eq('host_id', hostId);

    if (startDate) query = query.gte('checkin_time', startDate);
    if (endDate) query = query.lte('checkin_time', endDate);

    // Order by newest first
    query = query.order('checkin_time', { ascending: false });

    // Enforce a hard cap of 10000 to prevent massive DB sweeps
    const { data: visits, error } = await query.limit(10000);

    if (error) throw error;
    return { success: true, visits };
  } catch (e: any) {
    console.error('getVisitsForExport Error:', e);
    return { success: false, error: e.message };
  }
}
