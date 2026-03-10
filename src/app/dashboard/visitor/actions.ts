'use server';

import { getAdminDb } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

// Simple Node.js In-Memory Rate Limiter Map
const rateLimitCache = new Map<string, { count: number, resetAt: number }>();

function isRateLimited(userId: string, maxRequests: number = 5, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitCache.get(userId);
  if (record && record.resetAt > now) {
    record.count++;
    if (record.count > maxRequests) return true;
  } else {
    rateLimitCache.set(userId, { count: 1, resetAt: now + windowMs });
  }
  return false;
}

/**
 * A Server Action to generate a short-lived, single-use check-in token.
 * It will first delete any existing 'unused' tokens for the user to ensure only one is active.
 */
export async function generateCheckinToken(userId: string): Promise<{
  success: boolean;
  token?: string;
  expiresAt?: number;
  error?: string;
}> {
  if (!userId) {
    return { success: false, error: 'User ID is required.' };
  }

  // SECURITY PATCH: Prevent IDOR
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user || authData.user.id !== userId) {
    return { success: false, error: 'Unauthorized: You can only generate tokens for your own account.' };
  }

  const adminDb = await getAdminDb();
  if (!adminDb) {
    return {
      success: false,
      error:
        'Could not connect to the database. Server may not be configured for admin access.',
    };
  }

  // Fetch critical security settings once
  const { data: settings } = await adminDb.from('settings').select('qr_code_expiry_seconds, rate_limit_max_requests, rate_limit_window_ms').single();
  const maxRequests = settings?.rate_limit_max_requests ?? 5;
  const windowMs = settings?.rate_limit_window_ms ?? 60000;
  const expirySeconds = settings?.qr_code_expiry_seconds ?? 60;

  // SECURITY PATCH: Rate Limiting
  if (isRateLimited(userId, maxRequests, windowMs)) {
    return { success: false, error: `Rate limit exceeded. Please wait before generating another QR code.` };
  }

  try {
    // 1. Find and delete any pre-existing 'unused' tokens for this user.
    await adminDb.from('checkin_tokens').delete().eq('visitor_id', userId).eq('status', 'unused');

    // 2. Create the new token
    const token = randomBytes(16).toString('hex');
    const now = Date.now();
    const expiresAt = now + (expirySeconds * 1000);

    const { error } = await adminDb.from('checkin_tokens').insert({
      id: token,
      visitor_id: userId,
      created_at: new Date(now).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      status: 'unused',
    });

    if (error) throw error;

    return {
      success: true,
      token: token,
      expiresAt: expiresAt,
    };
  } catch (error: any) {
    console.error('Error generating check-in token:', error);
    const msg = error.message;
    if (msg && (msg.includes('Could not refresh access token') || msg.includes('Credential'))) {
      const friendlyError = 'Could not generate QR code. This feature requires server credentials that may not be available in your current environment.';
      return { success: false, error: friendlyError };
    }

    return {
      success: false,
      error: msg || 'An unknown server error occurred.',
    };
  }
}

/**
 * A Server Action to delete a check-in token.
 * This is typically called when the QR code dialog is closed before use.
 * It will now only delete the token if it hasn't been scanned yet.
 */
export async function deleteCheckinToken(tokenId: string): Promise<{ success: boolean; error?: string }> {
  if (!tokenId) {
    return { success: false, error: 'Token ID is required.' };
  }

  // SECURITY PATCH: Prevent IDOR
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { success: false, error: 'Unauthorized.' };
  }

  const adminDb = await getAdminDb();
  if (!adminDb) {
    return {
      success: false,
      error: 'Could not connect to the database. Server may not be configured for admin access.',
    };
  }

  try {
    const { data: tokenDoc, error } = await adminDb.from('checkin_tokens').select('*').eq('id', tokenId).single();
    if (error && error.code !== 'PGRST116') throw error; // Allow NOT_FOUND

    if (tokenDoc) {
      // Ensure the caller actually owns this token before deleting it!
      if (tokenDoc.visitor_id !== authData.user.id) {
        return { success: false, error: 'Unauthorized: You can only delete your own tokens.' };
      }

      // Only delete if it exists and is still 'unused'.
      if (tokenDoc.status === 'unused') {
        await adminDb.from('checkin_tokens').delete().eq('id', tokenId);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting check-in token:', error);

    const msg = error.message;
    if (msg && (msg.includes('Could not refresh access token') || msg.includes('Credential'))) {
      const friendlyError = 'Could not delete token. This feature requires server credentials that may not be available in your current environment.';
      return { success: false, error: friendlyError };
    }

    return { success: false, error: msg || 'An unknown server error occurred.' };
  }
}
