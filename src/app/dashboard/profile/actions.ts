'use server';

import { getAdminDb, createClient } from '@/lib/supabase/server';
import { LogAction } from '@/services/log-actions';
import { createLogEntry } from '@/services/log-service';
// import { verifyAppCheck } from '@/lib/app-check-verification';

// --- WhatsApp OTP Actions ---

export async function sendWhatsAppOtp(payload: {
  userId: string;
  phone: string;
  countryCode: string;
}): Promise<{ success: boolean; error?: string }> {
  const { userId, phone, countryCode } = payload;

  const { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return {
      success: false,
      error:
        'WhatsApp API credentials are not configured on the server. Please add them to your environment variables.',
    };
  }

  const adminDb = getAdminDb();
  if (!adminDb) {
    return {
      success: false,
      error: 'The server could not authenticate to perform this action. Please ensure your server environment is set up with valid credentials.',
    };
  }

  // SECURITY PATCH: Prevent IDOR
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user || authData.user.id !== userId) {
    return { success: false, error: 'Unauthorized: You can only request OTPs for your own account.' };
  }

  try {
    // Temporarily disabled App Check verification to unblock development.
    // TODO: Re-enable App Check once the reCAPTCHA environment is fully configured.
    // await verifyAppCheck();

    // 2. Rate Limiting Logic
    const { data: userDoc } = await adminDb.from('users').select('*').eq('id', userId).single();
    if (!userDoc) {
      throw new Error("User profile not found.");
    }

    const { data: settingsDoc } = await adminDb.from('settings').select('*').eq('id', 'global').single();

    const otpRequestLimit = settingsDoc?.otp_request_limit_hourly || 3;

    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    const actionTimestamps = userDoc.action_timestamps || {};
    const requestTimestamps = actionTimestamps.whatsapp_otp_requests || [];
    const recentRequests = requestTimestamps.filter((ts: string) => new Date(ts).getTime() > oneHourAgo);

    if (recentRequests.length >= otpRequestLimit) {
      throw new Error("You have requested too many OTPs. Please try again in an hour.");
    }

    recentRequests.push(new Date().toISOString());
    actionTimestamps.whatsapp_otp_requests = recentRequests;

    await adminDb.from('users').update({
      action_timestamps: actionTimestamps
    }).eq('id', userId);

    // 2.5 Ensure the phone number is not already verified by another user
    const exactMatchPhone = phone; // Ensure exact text matching or format normalized matching if needed
    const { data: existingVerifiedUser } = await adminDb
      .from('users')
      .select('id')
      .eq('phone', exactMatchPhone)
      .eq('is_verified', true)
      .single();

    if (existingVerifiedUser && existingVerifiedUser.id !== userId) {
      throw new Error("This phone number is already registered and verified by another user. Please use a different number or contact support.");
    }

    // 3. OTP Generation and Sending
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data: existingOtp } = await adminDb.from('whatsapp_otps').select('id').eq('id', userId).single();

    if (existingOtp) {
      await adminDb.from('whatsapp_otps').update({ otp, expiresAt }).eq('id', userId);
    } else {
      await adminDb.from('whatsapp_otps').insert({ id: userId, otp, expiresAt });
    }

    const cleanPhone = `${countryCode.replace(/\D/g, '')}${phone.replace(/\D/g, '')}`;

    const response = await fetch(
      `https://graph.facebook.com/v22.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'template',
          template: {
            name: 'aavija_phone_verify',
            language: { code: 'en_US' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: otp }],
              },
              {
                type: 'button',
                sub_type: 'url',
                index: 0,
                parameters: [{ type: 'text', text: otp }],
              },
            ],
          },
        }),
      }
    );

    const responseData = await response.json();

    if (!response.ok) {
      const fbtraceId = responseData?.error?.fbtrace_id;
      let userFacingError = responseData?.error?.message || 'Failed to send OTP.';

      console.error('WhatsApp API Error:', {
        message: userFacingError,
        type: responseData?.error?.type,
        code: responseData?.error?.code,
        error_subcode: responseData?.error?.error_subcode,
        fbtrace_id: fbtraceId,
      });

      if (responseData?.error?.code === 133010) {
        userFacingError = "The recipient's number is not reachable. In a development environment, this often indicates a configuration issue in your Meta Business Account (e.g., the sending number isn't fully connected). Please verify your settings in the WhatsApp Business Manager.";
      } else if (responseData?.error?.code === 132001) {
        userFacingError = "Template configuration mismatch. This could be due to a language mismatch (e.g., 'en' vs 'en_US') or the template name not existing for the selected language. Please check your template settings in Meta Business Manager.";
      } else if (responseData?.error?.code === 132018) {
        userFacingError = "There's an issue with the parameters in your template. Please check if the number and type of parameters match the template exactly.";
      }

      if (fbtraceId) {
        userFacingError += ` (Trace ID: ${fbtraceId})`;
      }

      throw new Error(userFacingError);
    }

    return { success: true };

  } catch (e: any) {
    console.error('Error sending WhatsApp OTP:', e);
    const msg = e.message;
    if (msg && (msg.includes('Could not refresh access token') || msg.includes('Credential'))) {
      const friendlyError = 'The server could not authenticate to perform this action. Please ensure your server environment is set up with valid credentials.';
      return { success: false, error: friendlyError };
    }
    return { success: false, error: msg || 'An unknown error occurred.' };
  }
}

/**
 * Verifies a WhatsApp OTP, updates the user's profile, and deducts tokens.
 */
export async function verifyWhatsAppOtp(payload: {
  userId: string;
  otp: string;
  phone: string; // The new phone number to save
  countryCode: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  const { userId, otp, phone, countryCode } = payload;
  const adminDb = getAdminDb();
  if (!adminDb) {
    return {
      success: false,
      error: 'The server could not authenticate to perform this action. Please ensure your server environment is set up with valid credentials.',
    };
  }

  try {
    let verificationCost = 0;
    let userName = 'Unknown User';

    const { data: userDoc } = await adminDb.from('users').select('*').eq('id', userId).single();
    if (!userDoc) throw new Error('User profile not found.');

    const { data: otpDoc } = await adminDb.from('whatsapp_otps').select('*').eq('id', userId).single();
    if (!otpDoc) throw new Error('No OTP found. Please request a new one.');

    const expiresAt = new Date(otpDoc.expiresAt);

    if (expiresAt < new Date()) {
      await adminDb.from('whatsapp_otps').delete().eq('id', userId);
      throw new Error('The OTP has expired. Please request a new one.');
    }

    if (otpDoc.otp !== otp) throw new Error('The entered code is incorrect.');

    const { data: settingsDoc } = await adminDb.from('settings').select('*').eq('id', 'global').single();

    verificationCost = settingsDoc?.mobile_verification_cost || 0;
    userName = userDoc.name || 'Unknown User';
    const currentBalance = userDoc.token_balance_visitor || 0;

    if (currentBalance < verificationCost) {
      throw new Error(`Insufficient tokens. Verification costs ${verificationCost}, but you have ${currentBalance}.`);
    }

    // Update user profile with new phone and verified status
    const newBalance = currentBalance - verificationCost;

    await adminDb.from('users').update({
      phone: phone,
      countryCode: countryCode, // Notice this might be stored in the users table, check schema if needed
      is_verified: true,
      token_balance_visitor: newBalance,
    }).eq('id', userId);

    // Delete the used OTP document
    await adminDb.from('whatsapp_otps').delete().eq('id', userId);

    // Log the token deduction after the transaction succeeds
    if (verificationCost > 0) {
      await createLogEntry({
        actorId: userId,
        actorName: userName,
        actorRole: 'visitor',
        action: LogAction.PHONE_VERIFICATION_COST,
        description: `${userName} paid ${verificationCost} tokens to verify their WhatsApp number (${countryCode}${phone}).`,
        tokenChange: -verificationCost,
      });
    }

    // Always log the successful verification itself
    await createLogEntry({
      actorId: userId,
      actorName: userName,
      actorRole: 'visitor',
      action: LogAction.PHONE_VERIFIED,
      description: `${userName} successfully verified their phone number (${countryCode}${phone}) via WhatsApp OTP.`,
    });

    return {
      success: true,
      message: `Your phone number has been verified. ${verificationCost} tokens were deducted.`,
    };

  } catch (e: any) {
    console.error('Error verifying WhatsApp OTP:', e);
    const msg = e.message;
    if (msg && (msg.includes('Could not refresh access token') || msg.includes('Credential'))) {
      const friendlyError = 'The server could not authenticate to perform this action. Please ensure your server environment is set up with valid credentials.';
      return { success: false, error: friendlyError };
    }
    return { success: false, error: msg || 'An unknown error occurred.' };
  }
}
