'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { env } from '@/lib/env';
import { LogAction } from '@/services/log-actions';
import { applyReferralCode, ensureReferralCode } from '@/services/referral-service';
import { z } from 'zod';

const SignupSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().optional(),
  refCode: z.string().nullable().optional(),
});

export async function checkAuthRateLimit(): Promise<{ success: boolean; error?: string }> {
  try {
    const { checkRateLimit, loginRateLimit } = await import('@/lib/rate-limit');
    const headerList = await headers();
    const ip = headerList.get('x-forwarded-for') || '127.0.0.1';
 
    // Double-check with Redis (primary for speed/third-party request)
    const rateCheck = await checkRateLimit(loginRateLimit, `auth:${ip}`);
    if (!rateCheck.success) {
      return { success: false, error: `Too many login attempts. Please try again later.` };
    }
 
    // Fallback: Check maintenance mode and DB-based global limit (optional secondary)
    const adminDb = await getAdminDb();
    if (adminDb) {
      const { data: settings } = await adminDb
        .from('settings')
        .select('is_maintenance_mode, maintenance_message')
        .eq('id', 'global')
        .single();
 
      if (settings?.is_maintenance_mode) {
        return { success: false, error: settings.maintenance_message };
      }
    }
 
    return { success: true };
  } catch (err) {
    console.error('[RateLimit] Failed to check auth rate limit:', err);
    return { success: true }; // Fail open
  }
}

export async function handleSignupProfile(
  userId: string, 
  email: string, 
  name: string,
  refCode?: string | null
): Promise<{ success: boolean; error?: string; welcomeTokens?: number }> {
  // 1. Server-side validation
  const validated = SignupSchema.safeParse({ userId, email, name, refCode });
  if (!validated.success) {
    return { success: false, error: 'Invalid input: ' + validated.error.errors.map(e => e.message).join(', ') };
  }

  const adminDb = await getAdminDb();
  if (!adminDb) return { success: false, error: 'Database connection failed' };

  try {
    const isAdmin = env.ADMIN_EMAIL && email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase();
    const role = isAdmin ? 'admin' : 'visitor';

    let startingTokens = 0;
    if (role === 'visitor') {
      const { data: settingsData } = await adminDb.from('settings').select('starting_token_visitor').eq('id', 'global').single();
      if (settingsData) {
        startingTokens = settingsData.starting_token_visitor || 0;
      }
    }

    const { error: insertError } = await adminDb.from('users').insert({
      id: userId,
      name: name || (isAdmin ? 'Admin' : 'Unnamed User'),
      email: email,
      role: role,
      is_verified: false,
      token_balance_visitor: startingTokens,
      global_rating: 0,
      photo_url: '',
    });

    if (insertError) throw insertError;

    // Log the signup
    await adminDb.from('logs').insert({
      actorId: userId,
      actorName: name || (isAdmin ? 'Admin' : 'Unnamed User'),
      actorRole: role,
      action: LogAction.USER_SIGNUP,
      description: `New ${role} user "${name || 'User'}" (${email}) signed up.`
    });

    if (startingTokens > 0) {
      await adminDb.from('logs').insert({
        actorId: userId,
        actorName: name || 'User',
        actorRole: role,
        action: LogAction.INITIAL_TOKEN_ALLOCATION,
        description: `Welcome Bonus: Received ${startingTokens} tokens on signup.`,
        tokenChange: startingTokens,
      });
    }

    let welcomeTokens = 0;
    // Apply referral code if present
    if (refCode && role === 'visitor') {
      try {
        const refResult = await applyReferralCode(refCode, userId);
        if (refResult.success && refResult.welcomeTokens) {
          welcomeTokens = refResult.welcomeTokens;
          // Log the referral welcome token credit
          await adminDb.from('logs').insert({
            actorId: userId,
            actorName: name || 'User',
            actorRole: 'visitor',
            action: LogAction.REFERRAL_WELCOME_TOKENS,
            description: `${name || 'User'} received ${welcomeTokens} bonus tokens for signing up via referral code "${refCode}".`,
            tokenChange: welcomeTokens,
          });
        }
      } catch (refErr) {
        console.error('[AuthAction] Referral apply failed (non-fatal):', refErr);
      }
    }

    // Generate referral code for the new user
    try {
      // Since requireAuth() might fail if session isn't established yet,
      // we might need a variant of ensureReferralCode that takes userId.
      // For now, let's just use the RPC directly in adminDb.
      await adminDb.rpc('rpc_generate_referral_code', {
          p_user_id: userId,
          p_length: 8,
      });
    } catch (codeErr) {
      console.error('[AuthAction] Referral code generation failed (non-fatal):', codeErr);
    }

    return { success: true, welcomeTokens };
  } catch (err: any) {
    console.error('[AuthAction] Profile creation failed:', err);
    return { success: false, error: err.message || 'Failed to create user profile' };
  }
}
