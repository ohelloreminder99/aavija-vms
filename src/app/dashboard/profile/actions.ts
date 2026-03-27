'use server';

import { getAdminDb, createClient } from '@/lib/supabase/server';
import { LogAction } from '@/services/log-actions';
import { createLogEntry } from '@/services/log-service';
import { sendOtpVerification } from '@/services/whatsapp-service';

// --- WhatsApp OTP Actions ---

export async function sendWhatsAppOtp(payload: {
  userId: string;
  phone: string;
  countryCode: string;
}): Promise<{ success: boolean; error?: string }> {
  const { userId, phone, countryCode } = payload;

  const adminDb = await getAdminDb();
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
    const { data: userDoc, error: userDocErr } = await adminDb.from('users')
      .select('id, name, phone, token_balance_visitor, action_timestamps')
      .eq('id', userId).single();
    
    if (userDocErr) {
      throw new Error(`Database error fetching profile: ${userDocErr.message}`);
    }
    if (!userDoc) {
      throw new Error("User profile not found.");
    }

    const { data: settingsDoc } = await adminDb.from('settings')
      .select('otp_request_limit_hourly, mobile_verification_cost')
      .eq('id', 'global').single();

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
      .maybeSingle();

    if (existingVerifiedUser && existingVerifiedUser.id !== userId) {
      throw new Error("This phone number is already registered and verified by another user. Please use a different number or contact support.");
    }

    // 3. OTP Generation and Sending
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data: existingOtp } = await adminDb.from('whatsapp_otps').select('id').eq('id', userId).maybeSingle();

    if (existingOtp) {
      await adminDb.from('whatsapp_otps').update({ otp, expiresAt }).eq('id', userId);
    } else {
      await adminDb.from('whatsapp_otps').insert({ id: userId, otp, expiresAt });
    }

    const result = await sendOtpVerification({
      phone: `${countryCode}${phone}`,
      otp,
    });
 
     if (!result.success) {
       throw new Error(result.error || 'Failed to send OTP.');
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
  const adminDb = await getAdminDb();
  if (!adminDb) {
    return {
      success: false,
      error: 'The server could not authenticate to perform this action. Please ensure your server environment is set up with valid credentials.',
    };
  }

  try {
    let verificationCost = 0;
    let userName = 'Unknown User';

    const { data: userDoc } = await adminDb.from('users')
      .select('id, name, token_balance_visitor')
      .eq('id', userId).single();
    if (!userDoc) throw new Error('User profile not found.');

    const { data: otpDoc } = await adminDb.from('whatsapp_otps').select('id, otp, expiresAt').eq('id', userId).single();
    if (!otpDoc) throw new Error('No OTP found. Please request a new one.');

    const expiresAt = new Date(otpDoc.expiresAt);

    if (expiresAt < new Date()) {
      await adminDb.from('whatsapp_otps').delete().eq('id', userId);
      throw new Error('The OTP has expired. Please request a new one.');
    }

    if (otpDoc.otp !== otp) throw new Error('The entered code is incorrect.');

    const { data: settingsDoc } = await adminDb.from('settings')
      .select('mobile_verification_cost')
      .eq('id', 'global').single();

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
