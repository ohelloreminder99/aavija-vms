/**
 * AAVIJA VMS — User Setup Check Utility
 * Author note (Phase 2A, 2026-03-07 by Antigravity):
 *
 * PROBLEM FIXED: There were two separate onboarding dialogs with different
 * field checks:
 *   1. dashboard/page.tsx  → checked !phone || !cityId
 *   2. dashboard/layout.tsx → checked !phone || !city || !is_verified
 *
 * Different fields, different dialogs → a new user could satisfy one but
 * not the other, creating an infinite loop they could never escape.
 *
 * FIX: This single function is the ONE source of truth for "does this user
 * need onboarding?". Both page.tsx and layout.tsx import and call this.
 * dashboard/page.tsx no longer has its own dialog — layout.tsx's
 * UserSetupDialog is the only one that runs.
 */

import { UserProfile } from '@/services/user-service';

/**
 * Returns true if the user has not completed onboarding.
 * A user needs setup if they are missing phone, city, or phone verification.
 */
export function needsSetup(profile: UserProfile | null | undefined): boolean {
    if (!profile) return false;

    const missingPhone = !profile.phone || profile.phone.trim() === '';
    const missingCity = !profile.city || profile.city.trim() === '';
    const notVerified = !profile.is_verified;

    return missingPhone || missingCity || notVerified;
}

/**
 * Returns true if the current pathname should bypass the setup gate.
 * Admins and owners are allowed to reach their dashboards without completing
 * setup, since they may be setting up the system itself.
 */
export function shouldBypassSetup(pathname: string): boolean {
    return (
        pathname.startsWith('/dashboard/admin') ||
        pathname.startsWith('/dashboard/owner') ||
        pathname.startsWith('/dashboard/change-password')
    );
}
