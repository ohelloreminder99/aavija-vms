
'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { LogAction } from '@/services/log-actions';
import { UserProfile } from '@/services/user-service';
import { Premise, StaffMember } from '@/services/premise-service';
import { createLogEntry } from '@/services/log-service';
import { revalidatePath } from 'next/cache';
import { sendVisitorArrivalNotification } from '@/services/whatsapp-service';

// Serializable types for client-side consumption
export type SerializableUserProfile = {
  id: string;
  name: string;
  role: string;
  is_verified: boolean;
  is_active: boolean;
  token_balance_visitor: number;
  global_rating: number;
  active_checkin_id: string | null;
  photo_url?: string;
  city?: string;
  companyName?: string;
  vehicles?: any;
  selected_vehicle_number?: string;
  products?: any;
};
export type SerializableCheckinHost = {
  id: string;
  name: string;
  identity: string;
  photo_url: string;
  availability: 'available' | 'busy' | 'do-not-disturb';
  token_balance?: number;
  isDisabled?: boolean;
};
export type SerializableVisit = {
  id: string;
  visitor_id: string;
  visitor_name: string;
  host_id: string;
  host_name?: string;
  premise_id: string;
  checkin_time: string;
  checkout_time: string | null;
  status: 'active' | 'completed' | 'declined' | 'force_closed';
};

/**
 * Verifies a check-in token and fetches the visitor's and available hosts' data.
 */
export async function processScannedToken(
  token: string,
  premise_id: string
): Promise<{
  success: boolean;
  visitor?: SerializableUserProfile;
  hosts?: SerializableCheckinHost[];
  error?: string;
}> {
  const adminDb = await getAdminDb();
  if (!adminDb) {
    return { success: false, error: 'Server database is not available.' };
  }

  try {
    const { profile } = await requireAuth();
    const isOwner = profile.role === 'owner';
    const premiseRoles = profile.premise_roles?.[premiseId] || [];
    if (profile.role !== 'admin' && !isOwner && !premiseRoles.includes('gatekeeper') && !premiseRoles.includes('host')) {
      throw new Error('Unauthorized: You do not have permission to process tokens for this premise.');
    }

    const { data: tokenData, error: tokenError } = await adminDb
      .from('checkin_tokens')
      .select('*')
      .eq('id', token)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('Invalid or already used QR code.');
    }

    if (tokenData.status !== 'unused') {
      throw new Error('This QR code has already been used or is invalid.');
    }

    if (!tokenData.expires_at) {
      throw new Error('Token data is invalid (missing expiry date).');
    }

    const userId = tokenData.visitor_id;
    if (!userId) {
      throw new Error('Token is not associated with a user.');
    }

    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      await adminDb.from('checkin_tokens').update({ status: 'expired' }).eq('id', token);
      throw new Error('Expired QR code. Please ask the visitor to generate a new one.');
    }

    const { data: visitorData, error: userError } = await adminDb.from('users')
      .select('id, name, email, phone, role, is_verified, is_active, global_rating, token_balance_visitor, active_checkin_id, photo_url, city, vehicles, selected_vehicle_number, products, companyName')
      .eq('id', userId).single();
    if (userError || !visitorData) throw new Error('Visitor profile not found for the user associated with this QR code.');

    const { data: premiseData, error: premiseError } = await adminDb.from('premises')
      .select('id, name, address, city, cityId, is_active, owner_id, agent_id, categoryId, token_balance, require_host_verification')
      .eq('id', premiseId).single();
    if (premiseError || !premiseData) throw new Error('The premise you are scanning for could not be found.');

    const { data: blockedDoc } = await adminDb.from('blocked_visitors').select('id').eq('premise_id', premiseId).eq('visitor_id', userId).single();
    if (blockedDoc) {
      throw new Error("This visitor is blocked from entering this premise.");
    }

    const { data: categoryData } = await adminDb.from('premise_categories')
      .select('id, name, type, deduction_rate_visitor, deduction_rate_premise')
      .eq('id', premiseData.category_id).single();
    let requiredTokensPremiseSide = 0;
    let requiredTokensVisitorSide = 0;
    let categoryType = 'industrial';
    if (categoryData) {
      requiredTokensVisitorSide = categoryData.deduction_rate_visitor || 0;
      requiredTokensPremiseSide = categoryData.deduction_rate_premise || 0;
      categoryType = categoryData.type || 'industrial';
    }

    if (categoryType === 'industrial') {
      if ((premiseData.token_balance || 0) < requiredTokensPremiseSide) {
        throw new Error(`The gate scanner is locked. Premise token balance (${premiseData.token_balance}) is insufficient to cover the premise check-in fee (${requiredTokensPremiseSide}).`);
      }
    }

    const { data: hostMembers, error: memberError } = await adminDb
      .from('premise_members')
      .select('user_id, identity, availability, users!inner(name, photo_url, token_balance_visitor)')
      .eq('premise_id', premiseId)
      .eq('role', 'host')
      .eq('is_active', true)
      .neq('availability', 'do-not-disturb');

    if (memberError) throw memberError;

    const hosts: SerializableCheckinHost[] = (hostMembers || []).map((m: any) => {
      const balance = m.users?.token_balance_visitor || 0;
      const isDisabled = categoryType === 'residential' && balance < requiredTokensPremiseSide;
      return {
        id: m.user_id,
        name: m.users?.name || 'Unknown Host',
        identity: m.identity || '',
        photo_url: m.users?.photo_url || '',
        availability: m.availability || 'available',
        token_balance: balance,
        isDisabled: isDisabled,
      };
    });

    // We update the token status to prevent double processing while finalizing
    await adminDb.from('checkin_tokens').update({ status: 'used' }).eq('id', token);

    // Create the serializable visitor object safely (stripped of Phone/Email PII)
    const serializableVisitor: SerializableUserProfile = {
      name: visitorData.name,
      role: visitorData.role,
      is_verified: visitorData.is_verified,
      is_active: visitorData.is_active,
      token_balance_visitor: visitorData.token_balance_visitor,
      global_rating: visitorData.global_rating,
      active_checkin_id: visitorData.active_checkin_id,
      photo_url: visitorData.photo_url,
      city: visitorData.city,
      company_name: visitorData.company_name,
      vehicles: visitorData.vehicles,
      selected_vehicle_number: visitorData.selected_vehicle_number,
      products: visitorData.products,
      id: visitorData.id,
    };

    return { success: true, visitor: serializableVisitor, hosts };
  } catch (e: any) {
    console.error('Error processing scanned token:', e);
    return { success: false, error: e.message || 'An unknown error occurred.' };
  }
}

interface FinalizeCheckinPayload {
  token: string;
  visitor_id: string;
  host_id: string;
  premise_id: string;
  gatekeeperId: string;
}

/**
 * Finalizes the check-in process by creating visit records and deducting tokens.
 */
export async function finalizeCheckin(payload: FinalizeCheckinPayload): Promise<{ success: boolean, error?: string }> {
  const { token, visitorId, hostId, premiseId, gatekeeperId } = payload;
  const adminDb = await getAdminDb();
  if (!adminDb) {
    return { success: false, error: 'Server database is not available.' };
  }

  try {
    const { ensureNotMaintenanceMode } = await import('@/services/settings-server');
    await ensureNotMaintenanceMode();

    const { profile } = await requireAuth();
    const isOwner = profile.role === 'owner';
    const premiseRoles = profile.premise_roles?.[premiseId] || [];
    if (profile.role !== 'admin' && !isOwner && !premiseRoles.includes('gatekeeper') && !premiseRoles.includes('host')) {
      throw new Error('Unauthorized: You do not have permission to process tokens for this premise.');
    }

    let visitorDeduction = 0;
    let premiseDeduction = 0;

    const { data: tokenDoc } = await adminDb.from('checkin_tokens').select('*').eq('id', token).single();
    if (!tokenDoc || (tokenDoc.status !== 'used' && tokenDoc.status !== 'unused')) {
      throw new Error("Check-in token is invalid or expired.");
    }

    // If this was an offline scan, the UI passed the dummy ID. We must resolve the actual user from the token.
    const resolvedVisitorId = visitorId === 'offline-visitor' ? tokenDoc.visitor_id : visitorId;

    const { data: premiseData } = await adminDb.from('premises').select('*').eq('id', premiseId).single();
    if (!premiseData) throw new Error("Premise not found.");

    const { data: visitorData } = await adminDb.from('users').select('*').eq('id', resolvedVisitorId).single();
    if (!visitorData) throw new Error("Visitor not found.");

    const { data: hostData } = await adminDb.from('users').select('*').eq('id', hostId).single();
    if (!hostData) throw new Error("Host not found.");

    const { data: settingsData } = await adminDb.from('settings').select('*').eq('id', 'global').single();

    // --- RATE LIMITING ---
    const { data: checkinCount } = await adminDb
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .eq('premise_id', premiseId)
      .gte('checkin_time', new Date(Date.now() - 3600000).toISOString());

    const rateLimit = settingsData?.checkin_rate_limit || 100;
    if (checkinCount !== null && checkinCount >= rateLimit) {
      throw new Error(`Gate traffic limit reached (${rateLimit}/hour). Please try again later or contact admin.`);
    }

    if (visitorData.active_checkin_id) {
      throw new Error("This visitor is already checked in somewhere else.");
    }

    const { data: hostBlockDoc } = await adminDb.from('host_blocked_visitors').select('id').eq('host_id', hostId).eq('visitor_id', resolvedVisitorId).single();
    if (hostBlockDoc) throw new Error("This visitor is blocked from seeing this specific host.");

    const visitorName = visitorData.name;
    const premiseName = premiseData.name;
    const ownerId = premiseData.owner_id;
    const visitorRating = visitorData.global_rating || 0;

    let categoryType = 'industrial';
    if (premiseData.category_id) {
      const { data: categoryData } = await adminDb.from('premise_categories').select('*').eq('id', premiseData.category_id).single();
      if (categoryData) {
        visitorDeduction = categoryData.deduction_rate_visitor || 0;
        premiseDeduction = categoryData.deduction_rate_premise || 0;
        categoryType = categoryData.type || 'industrial';
      }
    }

    if (!settingsData?.hide_token_economy) {
      if (categoryType === 'industrial') {
        if ((premiseData.token_balance || 0) < premiseDeduction) throw new Error("Premise has insufficient tokens for check-in.");
      } else if (categoryType === 'residential') {
        if ((hostData.token_balance_visitor || 0) < premiseDeduction) throw new Error(`Host has insufficient tokens for check-in. Balance: ${hostData.token_balance_visitor} Required: ${premiseDeduction}`);
      }

      if ((visitorData.token_balance_visitor || 0) < visitorDeduction) {
        throw new Error(`Visitor has insufficient tokens. Balance: ${visitorData.token_balance_visitor} Required: ${visitorDeduction}`);
      }
    }

    const hostForNotification: { name: string; phone: string; is_verified: boolean; } = {
      name: hostData.name,
      phone: hostData.phone,
      is_verified: hostData.is_verified,
    };
    const countryCodeForNotification = settingsData?.default_country_code || '+91';

    const now = Date.now();
    const visitTtlDays = settingsData?.visit_ttl_days;
    let expires_at: string | undefined = undefined;
    if (visitTtlDays && Number.isInteger(visitTtlDays) && visitTtlDays > 0) {
      expiresAt = new Date(now + visitTtlDays * 24 * 60 * 60 * 1000).toISOString();
    }

    // Auto-detect gatekeeper's assigned gate
    const { data: memberData } = await adminDb
      .from('premise_members')
      .select('gate_id')
      .eq('premise_id', premiseId)
      .eq('user_id', gatekeeperId)
      .eq('role', 'gatekeeper')
      .single();

    const { data: visitInsertData, error: visitError } = await adminDb.from('visits').insert({
      visitor_id: resolvedVisitorId,
      visitor_name: visitorData.name,
      host_id: hostId,
      host_name: hostData.name,
      premise_id: premiseId,
      checkin_time: new Date(now).toISOString(),
      checkout_time: null,
      status: 'active',
      visitor_snapshot_url: visitorData.photo_url || '',
      vehicle_details: visitorData.vehicles?.find((v: any) => v.number === visitorData.selected_vehicle_number) || null,
      checkin_gate_id: memberData?.gate_id,
      ...(expiresAt && { expiresAt }),
    }).select('id').single();

    if (visitError) throw visitError;
    const visitId = visitInsertData.id;

    if (!settingsData?.hide_token_economy) {
      if (categoryType === 'residential' && premiseDeduction > 0) {
        const { error: rpcErr } = await adminDb.rpc('deduct_user_tokens', { p_user_id: hostId, p_amount: premiseDeduction });
        if (rpcErr) throw new Error('Host has insufficient tokens for check-in.');
      } else if (categoryType === 'industrial' && premiseDeduction > 0) {
        const { error: rpcErr2 } = await adminDb.rpc('deduct_premise_tokens', { p_premise_id: premiseId, p_amount: premiseDeduction });
        if (rpcErr2) throw new Error("Premise has insufficient tokens for check-in.");
      }
    }

    // Assign checkin link to visitor AND conditionally deduct visitor wallet
    const visitorUpdatePayload: any = { active_checkin_id: visitId };
    if (!settingsData?.hide_token_economy && visitorDeduction > 0) {
      const { error: rpcErr3 } = await adminDb.rpc('deduct_user_tokens', { p_user_id: resolvedVisitorId, p_amount: visitorDeduction });
      if (rpcErr3) throw new Error(`Visitor has insufficient tokens.`);
    }
    await adminDb.from('users').update(visitorUpdatePayload).eq('id', resolvedVisitorId);

    await adminDb.from('checkin_tokens').delete().eq('id', token);

    // Log actions after transaction
    if (!settingsData?.hide_token_economy && visitorDeduction > 0) {
      await createLogEntry({
        actor_id: resolvedVisitorId,
        actor_name: visitorName,
        actor_role: 'visitor',
        action: LogAction.VISITOR_CHECKIN_COST,
        description: `Checked into ${premiseName}. Cost: ${visitorDeduction} tokens.`,
        token_change: -visitorDeduction,
      });
    }

    if (!settingsData?.hide_token_economy && premiseDeduction > 0) {
      if (categoryType === 'residential') {
        await createLogEntry({
          actor_id: hostId,
          actor_name: hostData.name,
          actor_role: 'host',
          action: LogAction.VISITOR_CHECKIN_COST,
          description: `Visitor ${visitorName} checked in. Cost: ${premiseDeduction} tokens.`,
          token_change: -premiseDeduction,
        });
      } else if (categoryType === 'industrial') {
        await createLogEntry({
          actor_id: ownerId,
          actor_name: 'System',
          actor_role: 'owner',
          action: LogAction.PREMISE_CHECKIN_COST,
          description: `Visitor ${visitorName} checked in. Cost: ${premiseDeduction} tokens.`,
          token_change: -premiseDeduction,
          context: { premise_id: premiseId }
        });
      }
    }

    // Send WhatsApp notification ASYNCHRONOUSLY ("Fire and Forget" Pattern)
    // The node process will keep this promise alive in the background without blocking the Gatekeeper UI checkin!
    if (hostForNotification && hostForNotification.is_verified && hostForNotification.phone) {
      sendVisitorArrivalNotification({
        hostName: hostForNotification.name,
        hostPhone: hostForNotification.phone,
        country_code: countryCodeForNotification,
        visitorName: visitorName,
        premiseName: premiseName,
        visitorRating: visitorRating,
      }).then(async (notificationResult) => {
        if (!notificationResult.success) {
          // If the notification failed in the background, log it silently.
          await createLogEntry({
            actor_id: gatekeeperId,
            actor_name: 'System',
            actor_role: 'gatekeeper',
            action: LogAction.WHATSAPP_NOTIFICATION_FAILED,
            description: `WhatsApp notification to host "${hostForNotification.name}" failed for visitor "${visitorName}". Reason: ${notificationResult.error}`,
            context: { premise_id: premiseId, host_id: hostId, visitor_id: visitorId }
          });
        }
      }).catch(console.error);
    } else {
      // Log why the notification was skipped
      let reason = 'Host phone number is missing.';
      if (hostForNotification && !hostForNotification.is_verified) {
        reason = 'Host phone number is not verified.';
      } else if (!hostForNotification) {
        reason = 'Host details could not be determined.'
      }
      await createLogEntry({
        actor_id: gatekeeperId,
        actor_name: 'System',
        actor_role: 'gatekeeper',
        action: LogAction.WHATSAPP_NOTIFICATION_FAILED,
        description: `WhatsApp notification to host was skipped. Reason: ${reason}`,
        context: { premise_id: premiseId, host_id: hostId, visitor_id: visitorId }
      });
    }

    return { success: true };
  } catch (e: any) {
    console.error('Error finalizing checkin:', e);
    // If it failed, try to mark it unused again so the gatekeeper can retry or visitor can use it again (if not deleted)
    try { await adminDb.from('checkin_tokens').update({ status: 'unused' }).eq('id', token); } catch (e) { }
    return { success: false, error: e.message || 'An unknown error occurred.' };
  }
}

export async function cancelCheckin(token: string): Promise<{ success: boolean }> {
  const adminDb = await getAdminDb();
  if (!adminDb) return { success: false };

  try {
    const { data: tokenDoc } = await adminDb.from('checkin_tokens').select('*').eq('id', token).single();
    if (tokenDoc && tokenDoc.status === 'unused') {
      await adminDb.from('checkin_tokens').delete().eq('id', token);
    }
  } catch (e) {
    // Ignore errors if token was already used or deleted
  }
  return { success: true };
}



interface CheckoutPayload {
  visit_id: string;
  visitor_id: string;
  premise_id: string;
}

export async function checkoutVisitor(payload: CheckoutPayload): Promise<{ success: boolean; error?: string }> {
  const { visitId, visitorId, premiseId } = payload;
  const adminDb = await getAdminDb();
  if (!adminDb) return { success: false, error: "Server database connection not available." };

  try {
    const { profile } = await requireAuth();
    const premiseRoles = profile.premise_roles?.[premiseId] || [];
    if (profile.role !== 'admin' && profile.role !== 'owner' && !premiseRoles.includes('gatekeeper') && !premiseRoles.includes('host')) {
      throw new Error('Unauthorized: You do not have permission to check out visitors at this premise.');
    }

    const now = new Date().toISOString();

    // Auto-detect gatekeeper's assigned gate
    const { data: memberData } = await adminDb
      .from('premise_members')
      .select('gate_id')
      .eq('premise_id', premiseId)
      .eq('user_id', profile.id)
      .eq('role', 'gatekeeper')
      .single();

    await adminDb.from('visits').update({ 
      status: 'completed', 
      checkout_time: now,
      checkout_gate_id: memberData?.gate_id 
    }).eq('id', visitId);
    await adminDb.from('users').update({ active_checkin_id: null }).eq('id', visitorId);

    revalidatePath('/dashboard/gatekeeper/active-visits');
    return { success: true };
  } catch (e: any) {
    console.error("Error checking out visitor:", e);
    return { success: false, error: e.message || "An unknown error occurred during checkout." };
  }
}

interface ForceCheckoutPayload extends CheckoutPayload {
  actor: {
    id: string;
    name: string;
    role: 'owner' | 'admin';
  }
}

export async function forceCheckoutVisitor(payload: ForceCheckoutPayload): Promise<{ success: boolean; error?: string }> {
  const { visitId, visitorId, premiseId, actor } = payload;
  const adminDb = await getAdminDb();
  if (!adminDb) return { success: false, error: "Server database connection not available." };

  try {
    const { user, profile } = await requireAuth();
    if (profile.role !== 'admin') {
      const { data: permCheck } = await adminDb.from('premises').select('owner_id').eq('id', premiseId).single();
      if (!permCheck || permCheck.owner_id !== user.id) throw new Error('Unauthorized: You do not own this premise.');
    }

    const { data: visitData, error: fetchError } = await adminDb.from('visits').select('*').eq('id', visitId).single();
    if (fetchError || !visitData) {
      throw new Error("Visit not found.");
    }

    const now = new Date().toISOString();

    await adminDb.from('visits').update({ status: 'force_closed', checkout_time: now }).eq('id', visitId);
    await adminDb.from('users').update({ active_checkin_id: null }).eq('id', visitorId);

    if (visitData) {
      await createLogEntry({
        actor_id: actor.id,
        actor_name: actor.name,
        actor_role: actor.role,
        action: actor.role === 'admin' ? LogAction.FORCE_CHECKOUT_ADMIN : LogAction.FORCE_CHECKOUT_OWNER,
        description: `${actor.role} "${actor.name}" forcefully checked out visitor "${visitData.visitor_name}".`,
        context: { premise_id: premiseId }
      });
    }

    revalidatePath(`/dashboard/owner/history?premiseId=${premiseId}`);
    revalidatePath('/dashboard/admin/visits');
    return { success: true };
  } catch (e: any) {
    console.error("Error during force checkout:", e);
    return { success: false, error: e.message || "An unknown error occurred during force checkout." };
  }
}

interface EmergencyContactPayload {
  visit_id: string;
  premise_id: string;
}

/**
 * High-Security 'Break-Glass' action. Fetches strict PII (phone numbers)
 * only during an active visit, while creating an immutable Audit Trail for Accountability.
 */
export async function getEmergencyContactInfo(payload: EmergencyContactPayload): Promise<{
  success: boolean;
  visitorPhone?: string;
  hostPhone?: string;
  error?: string;
}> {
  const { visitId, premiseId } = payload;
  const adminDb = await getAdminDb();
  if (!adminDb) return { success: false, error: "Server database connection not available." };

  try {
    const { user, profile } = await requireAuth();
    const isOwner = profile.role === 'owner';
    const premiseRoles = profile.premise_roles?.[premiseId] || [];
    if (profile.role !== 'admin' && !isOwner && !premiseRoles.includes('gatekeeper') && !premiseRoles.includes('host')) {
      throw new Error('Unauthorized: You do not have permission to access emergency contacts for this premise.');
    }

    const { data: visitData, error: fetchError } = await adminDb.from('visits').select('*').eq('id', visitId).single();
    if (fetchError || !visitData) throw new Error("Visit not found.");
    if (visitData.status !== 'active') throw new Error("Emergency contact information is only available for active visits.");

    const { data: visitorData } = await adminDb.from('users').select('phone, name').eq('id', visitData.visitor_id).single();
    const { data: hostData } = await adminDb.from('users').select('phone, name').eq('id', visitData.host_id).single();

    // The critical step: The Audit Trail (Trusting internal Session ID, not client JSON)
    await createLogEntry({
      actor_id: user.id,
      actor_name: profile.name || 'Unknown Security Staff',
      actor_role: profile.role || 'gatekeeper', // or host
      action: LogAction.EMERGENCY_CONTACT_ACCESSED,
      description: `Accessed Emergency Phone Numbers for visitor "${visitData.visitor_name}" and host "${visitData.host_name}".`,
      context: { premiseId, visitId }
    });

    const { decryptPII } = await import('@/services/encryption-service');
    const decryptedVisitorPhone = await decryptPII(visitorData?.phone || '');
    const decryptedHostPhone = await decryptPII(hostData?.phone || '');

    return {
      success: true,
      visitorPhone: decryptedVisitorPhone || 'Not provided',
      hostPhone: decryptedHostPhone || 'Not provided'
    };

  } catch (e: any) {
    console.error("Error accessing emergency contacts:", e);
    return { success: false, error: e.message || "An unknown error occurred while fetching emergency contacts." };
  }
}
