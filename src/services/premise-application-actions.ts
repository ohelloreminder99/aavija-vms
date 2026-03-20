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
  premise_name: z.string().min(2).max(120),
  premise_address: z.string().min(5).max(300),
  city_id: z.string().uuid(),
  city_name: z.string().optional(),
  city_state: z.string().optional(),
  category_id: z.string().uuid().optional(),
  category_name: z.string().optional(),
  owner_email: z.string().email(),
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
        agent_user_id: profile.is_agent ? user.id : null,
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
  categoryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') return { success: false, error: 'Unauthorized' };

    const adminDb = await getAdminDb();
    if (!adminDb) return { success: false, error: 'Database connection failed.' };

    // ─── ATOMIC OPERATION via Supabase RPC ────────────────────────────────────
    // The `approve_premise_application` SQL function runs as a single DB transaction.
    // If ANY step fails (create premise, update roles, mark approved), ALL changes roll back.
    const { data: rpcResult, error: rpcError } = await adminDb.rpc('approve_premise_application', {
      p_application_id: applicationId,
      p_category_id: categoryId,
      p_admin_id: profile.id,
      p_admin_name: profile.name || 'Admin',
    });

    if (rpcError) {
      Sentry.captureException(rpcError, { extra: { applicationId, categoryId, adminId: profile.id } });
      throw rpcError;
    }

    const result = rpcResult as any;
    if (!result?.success) {
      return { success: false, error: result?.error || 'Approval transaction failed.' };
    }

    // ─── LOG (non-fatal, after successful RPC) ────────────────────────────────
    createLogEntry({
      actorId: profile.id,
      actorName: profile.name || 'Admin',
      actorRole: 'admin',
      action: LogAction.PREMISE_CREATED,
      description: `Admin approved premise application: "${result.premise_name}" (owner approved via atomic transaction).`,
      premiseId: result.premise_id,
      context: { applicationId, premiseId: result.premise_id },
    }).catch(err => console.error('[PremiseApp] Log write failed (non-fatal):', err));

    // ─── NOTIFICATIONS (fire-and-forget, after successful RPC) ───────────────
    const notificationPromises: Promise<void>[] = [];

    if (result.owner_phone) {
      notificationPromises.push(
        notifyOwnerPremiseApproved({
          ownerPhone: result.owner_phone,
          ownerName: result.premise_name,
          premiseName: result.premise_name,
        }).catch(err => console.error('[PremiseApp] Owner notification failed:', err))
      );
    }

    if (result.agent_user_id) {
      notificationPromises.push(
        (async () => {
          const { data: agentUser } = await adminDb
            .from('users')
            .select('phone')
            .eq('id', result.agent_user_id)
            .single();

          if (agentUser?.phone) {
            await notifyAgentPremiseApproved({
              agentPhone: agentUser.phone,
              agentName: result.agent_name || 'Agent',
              premiseName: result.premise_name,
            });
          }
        })().catch(err => console.error('[PremiseApp] Agent notification failed:', err))
      );
    }

    if (notificationPromises.length > 0) {
      Promise.all(notificationPromises).then(() =>
        console.log(`[PremiseApp] ${notificationPromises.length} notification(s) sent.`)
      );
    }

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
