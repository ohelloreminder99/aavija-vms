'use server';

/**
 * AAVIJA VMS — Referral Service (Phase 2C)
 * Author note (Phase 2C, 2026-03-07 by Antigravity):
 *
 * DESIGN:
 *   ANY signed-up user automatically gets a referral code (generated at signup
 *   or back-filled by phase2c_migrations.sql for existing users).
 *   When someone signs up via /signup?ref=CODE, rpc_apply_referral_code links them.
 *   On every token purchase that meets the minimum threshold, rpc_fire_referral_commission
 *   atomically credits real-money commission to the referrer's referral_commission_balance.
 *
 *   Commission is separate from agent commission (agent_commission_balance).
 *   Both balances feed into the SAME payout_requests table (source: 'referral' or 'agent').
 *
 * PAYOUT:
 *   Users request payout via the same /dashboard/visitor/earnings page (Phase 2B).
 *   The earnings page will be updated to show both agent + referral balances combined.
 */

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { notifyReferralCommission, notifyThresholdReached } from './whatsapp-service';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type ReferralEvent = {
    id: string;
    referrer_id: string;
    referee_id: string;
    purchase_amount: number;     // tokens purchased
    commission_amount: number;   // ₹ credited
    commission_rate: number;
    status: 'credited' | 'paid_out';
    created_at: string;
};

export type ReferralStats = {
    referral_code: string;
    total_referrals: number;
    total_earned: number;          // ₹ lifetime
    pending_balance: number;       // current referral_commission_balance
    referrals: ReferralEvent[];
};

// ─── CODE GENERATION ─────────────────────────────────────────────────────────

/**
 * Ensure the calling user has a referral code. Generates one if missing.
 * Safe to call multiple times — returns existing code if already set.
 */
export async function ensureReferralCode(): Promise<{
    success: boolean;
    code?: string;
    error?: string;
}> {
    try {
        const { user } = await requireAuth();
        const adminDb = await getAdminDb();
        if (!adminDb) throw new Error('Admin database not available.');

        const { data, error } = await adminDb.rpc('rpc_generate_referral_code', {
            p_user_id: user.id,
            p_length: 8,
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error);

        return { success: true, code: data.code };
    } catch (e: any) {
        console.error('Error ensuring referral code:', e);
        return { success: false, error: e.message };
    }
}

// ─── APPLY REFERRAL CODE AT SIGNUP ───────────────────────────────────────────

/**
 * Apply a referral code to the current user's account.
 * Called from the signup flow when ?ref=CODE is in the URL.
 * Can only be applied once — the referred_by field is immutable after set.
 */
export async function applyReferralCode(
    referralCode: string,
    overrideUserId?: string  // pass user.id from auth-form to bypass requireAuth() at signup
): Promise<{
    success: boolean;
    welcomeTokens?: number;
    error?: string;
}> {
    try {
        let user_id: string;
        if (overrideUserId) {
            // Called from signup flow — user.id is known from the client-side
            // authData but server-side cookie hasn't propagated yet.
            user_id = overrideUserId;
        } else {
            const { user } = await requireAuth();
            user_id = user.id;
        }

        const adminDb = await getAdminDb();
        if (!adminDb) throw new Error('Admin database not available.');

        // Get welcome token setting
        const { data: settings } = await adminDb
            .from('settings')
            .select('referral_enabled, referral_reward_tokens')
            .eq('id', 'global')
            .single();

        if (!settings?.referral_enabled) {
            // Referral program is off — don't block the call but skip (non-fatal)
            console.log('[Referral] Skipped: referral program is disabled in settings.');
            return { success: false, error: 'Referral system is currently disabled.' };
        }

        const welcomeTokens = settings.referral_reward_tokens || 0;

        const { data, error } = await adminDb.rpc('rpc_apply_referral_code', {
            p_referee_id: user_id,
            p_referral_code: referralCode,
            p_welcome_tokens: welcomeTokens,
        });

        if (error) throw error;
        if (!data?.success) return { success: false, error: data?.error };

        return { success: true, welcomeTokens: data.welcomeTokens };
    } catch (e: any) {
        console.error('Error applying referral code:', e);
        return { success: false, error: e.message };
    }
}

// ─── FIRE COMMISSION (called from token-service.ts) ───────────────────────────

/**
 * Fire referral commission for a token purchase.
 * Called INSIDE purchaseTokens() after the purchase is confirmed.
 * Never throws — commission failure must not roll back a successful purchase.
 *
 * @param refereeId   The user who just bought tokens
 * @param tokensBought  Number of tokens purchased
 * @param purchaseAmountInr  The INR value paid (excluding GST)
 */
export async function fireReferralCommission(
    refereeId: string,
    tokensBought: number,
    purchaseAmountInr: number
): Promise<void> {
    try {
        const adminDb = await getAdminDb();
        if (!adminDb) return;

        const { data: settings } = await adminDb
            .from('settings')
            .select('referral_enabled, referral_commission_rate, referral_min_purchase_tokens')
            .eq('id', 'global')
            .single();

        if (!settings?.referral_enabled) return;
        if (!settings.referral_commission_rate || settings.referral_commission_rate <= 0) return;

        const minTokens = settings.referral_min_purchase_tokens || 0;

        const { data: result } = await adminDb.rpc('rpc_fire_referral_commission', {
            p_referee_id: refereeId,
            p_tokens_purchased: tokensBought,
            p_purchase_amount_inr: purchaseAmountInr,
            p_commission_rate: settings.referral_commission_rate,
            p_min_tokens: minTokens,
        });

        // Trigger notifications if commission was credited
        if (result?.success && result?.referrerId) {
            const { data: referrer } = await adminDb
                .from('users')
                .select('name, phone, referral_commission_balance')
                .eq('id', result.referrerId)
                .single();

            if (referrer?.phone) {
                // 1. Notify about the new commission
                notifyReferralCommission({
                    phone: referrer.phone,
                    name: referrer.name || 'Referrer',
                    earned: String(result.commissionAmount),
                    newBalance: String(referrer.referral_commission_balance),
                });

                // 2. Check threshold (default ₹500 if not in settings, but we should check settings)
                const { data: thresholdData } = await adminDb.from('settings').select('referral_min_payout_amount').eq('id', 'global').single();
                const threshold = thresholdData?.referral_min_payout_amount || 500;
                
                if (referrer.referral_commission_balance >= threshold && (referrer.referral_commission_balance - result.commissionAmount) < threshold) {
                    notifyThresholdReached({
                        phone: referrer.phone,
                        name: referrer.name || 'Referrer',
                        balance: String(referrer.referral_commission_balance),
                    });
                }
            }
        }
    } catch (e: any) {
        // Log but never crash — purchase already succeeded
        console.error('[Referral] Commission fire failed (non-fatal):', e.message);
    }
}

// ─── USER STATS ───────────────────────────────────────────────────────────────

/**
 * Get the calling user's referral stats for the Refer & Earn page.
 */
export async function getMyReferralStats(): Promise<{
    success: boolean;
    data?: ReferralStats;
    error?: string;
}> {
    try {
        const { user } = await requireAuth();
        const adminDb = await getAdminDb();
        if (!adminDb) throw new Error('Admin database not available.');

        // Ensure user has a referral code
        await ensureReferralCode();

        const [
            { data: userDoc },
            { data: referralEvents },
        ] = await Promise.all([
            adminDb.from('users').select('referral_code, referral_commission_balance').eq('id', user.id).single(),
            adminDb.from('referrals').select('*').eq('referrer_id', user.id).order('created_at', { ascending: false }).limit(50),
        ]);

        const totalEarned = (referralEvents || []).reduce((sum: number, r: any) => sum + Number(r.commission_amount), 0);

        return {
            success: true,
            data: {
                referral_code: userDoc?.referral_code || '',
                total_referrals: (referralEvents || []).length,
                total_earned: totalEarned,
                pending_balance: userDoc?.referral_commission_balance || 0,
                referrals: referralEvents || [],
            },
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ─── ADMIN DATA ────────────────────────────────────────────────────────────────

/**
 * Admin: Get all referral events with referrer and referee names.
 * Used for the admin referrals overview page.
 */
export async function getAllReferralEventsForAdmin(): Promise<{
    success: boolean;
    data?: (ReferralEvent & { referrerName: string; refereeName: string })[];
    totalCommissionsPaid: number;
    totalActiveReferrers: number;
    error?: string;
}> {
    try {
        const { profile } = await requireAuth();
        if (profile.role !== 'admin') throw new Error('Unauthorized');

        const adminDb = await getAdminDb();
        if (!adminDb) throw new Error('Admin database not available.');

        const { data: events, error } = await adminDb
            .from('referrals')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) throw error;

        const userIds = [
            ...new Set([
                ...(events || []).map((e: any) => e.referrer_id),
                ...(events || []).map((e: any) => e.referee_id),
            ]),
        ];

        const { data: users } = await adminDb
            .from('users')
            .select('id, name')
            .in('id', userIds);

        const nameMap = new Map((users || []).map((u: any) => [u.id, u.name]));

        const enriched = (events || []).map((e: any) => ({
            ...e,
            referrerName: nameMap.get(e.referrer_id) || 'Unknown',
            refereeName: nameMap.get(e.referee_id) || 'Unknown',
        }));

        const totalCommissionsPaid = enriched.reduce((s: number, e: any) => s + Number(e.commission_amount), 0);
        const totalActiveReferrers = new Set(enriched.map((e: any) => e.referrer_id)).size;

        return { success: true, data: enriched, totalCommissionsPaid, totalActiveReferrers };
    } catch (e: any) {
        return { success: false, data: [], totalCommissionsPaid: 0, totalActiveReferrers: 0, error: e.message };
    }
}
