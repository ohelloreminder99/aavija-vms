'use server';

/**
 * AAVIJA VMS — Premise Application Actions
 * Agents apply for a new premise; admin reviews and approves with one click.
 */

import * as Sentry from '@sentry/nextjs';
import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { headers } from 'next/headers';
import { checkRateLimit, contactRateLimit } from '@/lib/rate-limit';
import { notifyAdminNewPremiseApplication, notifyAgentPremiseApproved, notifyOwnerPremiseApproved } from './whatsapp-service';
import { LogAction } from './log-actions';
import { createLogEntry } from './log-service';
import { zSanitize, zSanitizeOptional } from '@/lib/sanitize';
import { withTiming } from '@/lib/with-timing';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type PremiseApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface PremiseApplication {
  id: string;
  status: PremiseApplicationStatus;
  premise_name: string;
  premise_address: string;
  city_id: string | null;
  city_name: string | null;
  city_state: string | null;
  category_id: string | null;
  category_name: string | null;
  owner_email: string;
  agent_user_id: string | null;
  agent_name: string | null;
  agent_email: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

// ─── VALIDATION SCHEMA ────────────────────────────────────────────────────────

const ApplicationSchema = z.object({
  premise_name:    z.string().min(2).max(120).transform(zSanitize),
  premise_address: z.string().min(5).max(300).transform(zSanitize),
  city_id:         z.string().uuid(),
  city_name:       z.string().optional().transform(v => zSanitizeOptional(v)),
  city_state:      z.string().optional().transform(v => zSanitizeOptional(v)),
  category_id:     z.string().uuid().optional(),
  category_name:   z.string().optional().transform(v => zSanitizeOptional(v)),
  owner_email:     z.string().email(),
  // agent fields come from the authenticated session, not user input
});

// ─── CHECK OWNER EMAIL ────────────────────────────────────────────────────────

/**
 * Server-side check: does this email belong to an existing Aavija user?
 * Used for the live ✓/✗ indicator in the apply form.
 */
export async function checkOwnerEmail(
  email: string
): Promise<{ exists: boolean; name?: string }> {
  if (!email || !z.string().email().safeParse(email).success) {
    return { exists: false };
  }
  try {
    const adminDb = await getAdminDb();
    if (!adminDb) return { exists: false };
    const { data } = await adminDb
      .from('users')
      .select('id, name')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();
    return data ? { exists: true, name: data.name } : { exists: false };
  } catch {
    return { exists: false };
  }
}

// ─── SUBMIT APPLICATION ───────────────────────────────────────────────────────

export async function submitPremiseApplication(
  payload: z.infer<typeof ApplicationSchema>
): Promise<{ success: boolean; applicationId?: string; error?: string }> {
  try {
    // 1. Auth — must be logged in
    const { user, profile } = await requireAuth();

    // 2. Rate limit — 3 applications per 5 minutes per user
    const headerList = await headers();
    const ip = headerList.get('x-forwarded-for') || user.id;
    const rateCheck = await checkRateLimit(contactRateLimit, `apply:${ip}`);
    if (!rateCheck.success) {
      return { success: false, error: 'Too many submissions. Please wait before applying again.' };
    }

    // 3. Validate
    const validated = ApplicationSchema.safeParse(payload);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message || 'Invalid input.' };
    }
    const data = validated.data;

    // 4. Confirm owner email exists
    const ownerCheck = await checkOwnerEmail(data.owner_email);
    if (!ownerCheck.exists) {
      return { success: false, error: 'Owner email does not exist in the system. Ask them to sign up first.' };
    }

    const adminDb = await getAdminDb();
    if (!adminDb) return { success: false, error: 'Database connection failed.' };

    // 5. Insert application
    const { data: app, error: insertError } = await adminDb
      .from('premise_applications')
      .insert({
        premise_name: data.premise_name,
        premise_address: data.premise_address,
        city_id: data.city_id,
        city_name: data.city_name || null,
        city_state: data.city_state || null,
        category_id: data.category_id || null,
        category_name: data.category_name || null,
        owner_email: data.owner_email.toLowerCase().trim(),
        agent_user_id: user.id,
        agent_name: profile.name || null,
        agent_email: profile.email || null,
        submitted_by: user.id,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    // 6. Notify admin via WhatsApp (non-fatal)
    try {
      const { data: settings } = await adminDb
        .from('settings')
        .select('*')
        .eq('id', 'global')
        .single();

      let adminPhone = (settings as any)?.admin_whatsapp_phone;

      // If no override in settings, find an admin in users table
      if (!adminPhone) {
        const { data: adminUser } = await adminDb
          .from('users')
          .select('phone')
          .eq('role', 'admin')
          .not('phone', 'is', null)
          .limit(1)
          .maybeSingle();
        adminPhone = adminUser?.phone;
      }

      if (adminPhone) {
        await notifyAdminNewPremiseApplication({
          adminPhone,
          premiseName: data.premise_name,
          agentName: profile.name || 'Unknown Agent',
          agentEmail: profile.email || '',
          ownerEmail: data.owner_email,
        });
      }
    } catch (notifyErr) {
      console.error('[PremiseApp] Admin notification failed (non-fatal):', notifyErr);
    }

    revalidatePath('/dashboard/admin/premises');
    return { success: true, applicationId: app?.id };

  } catch (e: any) {
    console.error('[PremiseApp] submitPremiseApplication failed:', e);
    return { success: false, error: e.message || 'Failed to submit application.' };
  }
}

// ─── GET APPLICATIONS (ADMIN) ─────────────────────────────────────────────────

export async function getPremiseApplications(
  status?: PremiseApplicationStatus
): Promise<{ success: boolean; data?: PremiseApplication[]; error?: string }> {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') return { success: false, error: 'Unauthorized' };

    const adminDb = await getAdminDb();
    if (!adminDb) return { success: false, error: 'Database connection failed.' };

    let query = adminDb
      .from('premise_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return { success: true, data: (data || []) as PremiseApplication[] };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── APPROVE APPLICATION (ADMIN) ──────────────────────────────────────────────

export async function approvePremiseApplication(
  applicationId: string,
  category_id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') return { success: false, error: 'Unauthorized' };

    const adminDb = await getAdminDb();
    if (!adminDb) return { success: false, error: 'Database connection failed.' };

    // ─── ATOMIC OPERATION via Supabase RPC ────────────────────────────────────
    // The `approve_premise_application` SQL function runs as a single DB transaction.
    // If ANY step fails (create premise, update roles, mark approved), ALL changes roll back.
    // Manual performance timing around the RPC for Sentry slow-query monitoring.
    const _rpcStart = performance.now();
    const { data: rpcResult, error: rpcError } = await adminDb.rpc('approve_premise_application', {
      p_application_id: applicationId,
      p_category_id:    categoryId,
      p_admin_id:       profile.id,
      p_admin_name:     profile.name || 'Admin',
    });
    const _rpcMs = Math.round(performance.now() - _rpcStart);
    if (_rpcMs > 3000) {
      Sentry.captureMessage(`[SLOW] approve_premise_application_rpc took ${_rpcMs}ms`, {
        level: 'warning',
        extra: { duration_ms: _rpcMs, applicationId, categoryId },
      });
    }

    if (rpcError) {
      Sentry.captureException(rpcError, { extra: { applicationId, categoryId, adminId: profile.id } });
      throw rpcError;
    }

    const result = rpcResult as any;
    if (!result?.success) {
      return { success: false, error: result?.error || 'Approval transaction failed.' };
    }

    // ─── NOTIFY OWNER & AGENT (non-fatal, after successful RPC) ───────────────
    try {
      const { notifyAgentPremiseApproved, notifyOwnerPremiseApproved } = await import('@/services/whatsapp-service');
      
      // Notify Owner
      if (result.owner_phone) {
        await notifyOwnerPremiseApproved({
          owner_name: result.owner_name || 'Owner',
          ownerPhone: result.owner_phone,
          premiseName: result.premise_name || 'Premise'
        });
      }

      // Notify Agent (if application was submitted by one)
      if (result.agent_id && result.agent_phone) {
        await notifyAgentPremiseApproved({
          agentName: result.agent_name || 'Agent',
          agentPhone: result.agent_phone,
          premiseName: result.premise_name || 'Premise'
        });
      }
    } catch (notifyErr: any) {
      console.error('[PremiseApp] Notification trigger failed:', notifyErr.message);
    }

    // ─── LOG (non-fatal, after successful RPC) ────────────────────────────────
    createLogEntry({
      actor_id: profile.id,
      actor_name: profile.name || 'Admin',
      actor_role: 'admin',
      action: LogAction.PREMISE_CREATED,
      description: `Admin approved premise application: "${result.premise_name}" (owner approved via atomic transaction).`,
      premise_id: result.premise_id,
      context: { premise_id: result.premise_id, applicationId }
    }).catch(err => console.error('[PremiseApp] Log write failed (non-fatal):', err));

    revalidatePath('/dashboard/admin/premises');
    return { success: true };

  } catch (e: any) {
    Sentry.captureException(e, { extra: { applicationId, categoryId } });
    console.error('[PremiseApp] approvePremiseApplication failed:', e);
    return { success: false, error: e.message || 'Approval failed.' };
  }
}

// ─── REJECT APPLICATION (ADMIN) ───────────────────────────────────────────────

export async function rejectPremiseApplication(
  applicationId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') return { success: false, error: 'Unauthorized' };

    const adminDb = await getAdminDb();
    if (!adminDb) return { success: false, error: 'Database connection failed.' };

    const { error } = await adminDb
      .from('premise_applications')
      .update({
        status: 'rejected',
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason || 'No reason provided.',
      })
      .eq('id', applicationId)
      .eq('status', 'pending');

    if (error) throw error;

    revalidatePath('/dashboard/admin/premises');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
