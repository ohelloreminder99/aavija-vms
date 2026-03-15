'use server';

/**
 * AAVIJA VMS — WhatsApp Notification Service (WhatsApp Cloud API)
 * Author note (Phase 2B/2C, 2026-03-07 by Antigravity):
 *
 * Uses Meta's WhatsApp Cloud API directly — no third-party provider needed.
 *
 * SETUP (one-time, takes ~5 minutes):
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Go to https://developers.facebook.com → Your App → WhatsApp → API Setup
 * 2. Copy your "Phone Number ID"  → WHATSAPP_PHONE_NUMBER_ID
 * 3. Generate a Permanent Token:
 *    - Go to Business Settings → System Users → Add System User (Admin role)
 *    - Assign WhatsApp permission to that user
 *    - Generate token → copy it       → WHATSAPP_ACCESS_TOKEN
 * 4. Add to .env.local:
 *      WHATSAPP_PHONE_NUMBER_ID=1234567890123
 *      WHATSAPP_ACCESS_TOKEN=EAAxx...
 *
 * TEMPLATE CREATION (one-time, per template):
 * ─────────────────────────────────────────────────────────────────────────────
 * Go to: Meta Business Manager → WhatsApp → Message Templates → Create Template
 * Category: UTILITY  |  Language: English
 *
 * Create these 6 templates (exact names matter):
 * ┌─────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────┐
 * │ Template Name                           │ Body Text                                                               │
 * ├─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
 * │ aavija_payout_approved                  │ Hi {{1}}, your payout of ₹{{2}} has been processed successfully. UTR Reference: {{3}}. Thank you! │
 * │ aavija_payout_rejected                  │ Hi {{1}}, your payout of ₹{{2}} could not be approved. Reason: {{3}}. Please contact support if needed. │
 * │ aavija_kyc_verified                     │ Hi {{1}}, your KYC has been verified successfully! You can now request payouts from your dashboard. │
 * │ aavija_tokens_converted                 │ Hi {{1}}, a total of {{2}} tokens have been credited to your account from your commission conversion! │
 * │ aavija_referral_commission              │ Hi {{1}}, you earned ₹{{2}} in referral commission! Your updated balance is ₹{{3}}. Keep sharing! │
 * │ aavija_threshold_reached               │ Hi {{1}}, your balance of ₹{{2}} has reached the payout threshold. Visit your dashboard to claim it! │
 * └─────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────┘
 *
 * Meta approves UTILITY templates within minutes (not days).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── TYPES ────────────────────────────────────────────────────────────────────

type TemplateComponent = {
  type: 'body' | 'button';
  sub_type?: 'url' | 'quick_reply';
  index?: number;
  parameters: { type: 'text'; text: string }[];
};

type WhatsAppPayload = {
  phone: string;       // raw phone number from DB
  templateName: string;
  params: string[];    // positional {{1}}, {{2}}... values
  buttonParams?: string[]; // for the first button if any
};

// ─── PHONE NORMALIZER ─────────────────────────────────────────────────────────

/**
 * Normalizes any Indian phone number to international format without +
 * WhatsApp Cloud API requires: 919876543210 (country code + number, no +)
 */
function normalizePhone(raw: string, defaultCountryCode = '91'): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) return defaultCountryCode + digits.slice(1);
  if (digits.length === 10) return defaultCountryCode + digits;
  if (digits.startsWith('91') && digits.length === 12) return digits;
  return digits;
}

// ─── CORE SENDER ──────────────────────────────────────────────────────────────

async function sendWhatsApp(payload: WhatsAppPayload): Promise<void> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 'global').single();

  const phoneNumberId = settings?.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn('[WhatsApp] WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN not set — skipping notification.');
    return;
  }

  const to = normalizePhone(payload.phone);

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: payload.templateName,
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: payload.params.map(text => ({ type: 'text', text })),
        } as TemplateComponent,
        ...(payload.buttonParams ? [
          {
            type: 'button',
            sub_type: 'url',
            index: 0,
            parameters: payload.buttonParams.map(text => ({ type: 'text', text })),
          } as TemplateComponent
        ] : []),
      ],
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WhatsApp Cloud API error ${res.status}: ${errText}`);
  }
}

// ─── NOTIFICATION FUNCTIONS ───────────────────────────────────────────────────
// All functions are non-fatal: they catch errors internally and only log.
// A failed notification NEVER blocks a business action.

/**
 * aavija_payout_approved
 * Body: "Hi {{1}}, your payout of ₹{{2}} has been processed successfully. UTR Reference: {{3}}. Thank you!"
 */
export async function notifyPayoutApproved(p: {
  phone: string;
  name: string;
  amount: string;
  utr: string;
}): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: settings } = await supabase.from('settings').select('wa_template_payout_approved').eq('id', 'global').single();
    
    await sendWhatsApp({
      phone: p.phone,
      templateName: settings?.wa_template_payout_approved || 'aavija_payout_approved',
      params: [p.name, p.amount, p.utr],
    });
  } catch (e: unknown) {
    console.error('[WhatsApp] notifyPayoutApproved failed (non-fatal):', e instanceof Error ? e.message : 'Unknown error');
  }
}

/**
 * aavija_payout_rejected
 * Body: "Hi {{1}}, your payout of ₹{{2}} could not be approved. Reason: {{3}}. Please contact support if needed."
 */
export async function notifyPayoutRejected(p: {
  phone: string;
  name: string;
  amount: string;
  reason: string;
}): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: settings } = await supabase.from('settings').select('wa_template_payout_rejected').eq('id', 'global').single();

    await sendWhatsApp({
      phone: p.phone,
      templateName: settings?.wa_template_payout_rejected || 'aavija_payout_rejected',
      params: [p.name, p.amount, p.reason],
    });
  } catch (e: unknown) {
    console.error('[WhatsApp] notifyPayoutRejected failed (non-fatal):', e instanceof Error ? e.message : 'Unknown error');
  }
}

/**
 * aavija_kyc_verified
 * Body: "Hi {{1}}, your KYC has been verified successfully! You can now request payouts from your dashboard."
 */
export async function notifyKycVerified(p: {
  phone: string;
  name: string;
}): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: settings } = await supabase.from('settings').select('wa_template_kyc_verified').eq('id', 'global').single();

    await sendWhatsApp({
      phone: p.phone,
      templateName: settings?.wa_template_kyc_verified || 'aavija_kyc_verified',
      params: [p.name],
    });
  } catch (e: unknown) {
    console.error('[WhatsApp] notifyKycVerified failed (non-fatal):', e instanceof Error ? e.message : 'Unknown error');
  }
}

/**
 * aavija_tokens_converted
 * Body: "Hi {{1}}, a total of {{2}} tokens have been credited to your account from your commission conversion!"
 */
export async function notifyTokensConverted(p: {
  phone: string;
  name: string;
  tokens: string;
}): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: settings } = await supabase.from('settings').select('wa_template_tokens_converted').eq('id', 'global').single();

    await sendWhatsApp({
      phone: p.phone,
      templateName: settings?.wa_template_tokens_converted || 'aavija_tokens_converted',
      params: [p.name, p.tokens],
    });
  } catch (e: unknown) {
    console.error('[WhatsApp] notifyTokensConverted failed (non-fatal):', e instanceof Error ? e.message : 'Unknown error');
  }
}

/**
 * aavija_referral_commission
 * Body: "Hi {{1}}, you earned ₹{{2}} in referral commission! Your updated balance is ₹{{3}}. Keep sharing!"
 */
export async function notifyReferralCommission(p: {
  phone: string;
  name: string;
  earned: string;
  newBalance: string;
}): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: settings } = await supabase.from('settings').select('wa_template_referral_commission').eq('id', 'global').single();

    await sendWhatsApp({
      phone: p.phone,
      templateName: settings?.wa_template_referral_commission || 'aavija_referral_commission',
      params: [p.name, p.earned, p.newBalance],
    });
  } catch (e: unknown) {
    console.error('[WhatsApp] notifyReferralCommission failed (non-fatal):', e instanceof Error ? e.message : 'Unknown error');
  }
}

/**
 * aavija_threshold_reached
 * Body: "Hi {{1}}, your balance of ₹{{2}} has reached the payout threshold. Visit your dashboard to claim it!"
 */
export async function notifyThresholdReached(p: {
  phone: string;
  name: string;
  balance: string;
}): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: settings } = await supabase.from('settings').select('wa_template_threshold_reached').eq('id', 'global').single();

    await sendWhatsApp({
      phone: p.phone,
      templateName: settings?.wa_template_threshold_reached || 'aavija_threshold_reached',
      params: [p.name, p.balance],
    });
  } catch (e: unknown) {
    console.error('[WhatsApp] notifyThresholdReached failed (non-fatal):', e instanceof Error ? e.message : 'Unknown error');
  }
}

// ─── EXISTING TEMPLATES (you already have these in Meta) ─────────────────────

/**
 * aavija_host_notified  ← your EXISTING template
 * Body: "Hi {{1}}, You have a new Visitor at {{2}}. Visitor Details : Name : {{3}} Star Rating : {{4}} out of 5"
 *
 * Called from gatekeeper/actions.ts → finalizeCheckin (fire-and-forget).
 * Returns { success, error } so the caller can log failures.
 */
export async function sendVisitorArrivalNotification(p: {
  hostName: string;
  hostPhone: string;
  countryCode: string;   // e.g. "+91" — stripped before send
  visitorName: string;
  premiseName: string;
  visitorRating: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // countryCode may be "+91" — normalizePhone handles it
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: settings } = await supabase.from('settings').select('wa_template_host_notified').eq('id', 'global').single();

    await sendWhatsApp({
      phone: p.hostPhone,
      templateName: settings?.wa_template_host_notified || 'aavija_host_notified',
      params: [
        p.hostName,
        p.premiseName, // {{2}} is House/Premise
        p.visitorName, // {{3}} is Visitor Name
        String(p.visitorRating > 0 ? p.visitorRating.toFixed(1) : 'New'),
      ],
    });
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[WhatsApp] sendVisitorArrivalNotification failed (non-fatal):', msg);
    return { success: false, error: msg };
  }
}

/**
 * aavija_phone_verify  ← your EXISTING template
 * Body: "{{1}} is your verification code. For your security, do not share this code."
 *
 * NOTE: For Supabase Auth phone OTP, this template is configured in:
 *   Supabase Dashboard → Auth → SMS Provider → WhatsApp
 * You do NOT need to call this function for normal OTP flow — Supabase handles it.
 * This is only for manual OTP triggers (e.g. re-send button outside Auth flow).
 */
export async function sendOtpVerification(p: {
  phone: string;
  otp: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: settings } = await supabase.from('settings').select('wa_template_phone_verify').eq('id', 'global').single();

    await sendWhatsApp({
      phone: p.phone,
      templateName: settings?.wa_template_phone_verify || 'aavija_phone_verify',
      params: [p.otp],
      buttonParams: [p.otp],
    });
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[WhatsApp] sendOtpVerification failed (non-fatal):', msg);
    return { success: false, error: msg };
  }
}

/**
 * aavija_agent_assigned  ← NEW template (create this in Meta)
 * Category: UTILITY | Language: English (en_US)
 * Body: "Hi {{1}}, you have been assigned as the sales agent for {{2}}. Log in to your Aavija dashboard to view your commission details."
 *
 * Called from agent-service.ts → designateAgentByEmail.
 */
export async function notifyAgentAssigned(p: {
  phone: string;
  agentName: string;
  premiseName: string;
}): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: settings } = await supabase.from('settings').select('wa_template_agent_assigned').eq('id', 'global').single();

    await sendWhatsApp({
      phone: p.phone,
      templateName: settings?.wa_template_agent_assigned || 'aavija_agent_assigned',
      params: [p.agentName, p.premiseName],
    });
  } catch (e: unknown) {
    console.error('[WhatsApp] notifyAgentAssigned failed (non-fatal):', e instanceof Error ? e.message : 'Unknown error');
  }
}
