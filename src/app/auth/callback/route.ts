import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { LogAction } from '@/services/log-actions';

// Helper: apply referral code server-side using admin client (no session needed)
async function maybeApplyReferral(
    adminClient: any,
    userId: string,
    refCode: string
): Promise<void> {
    try {
        const { data: settings } = await adminClient
            .from('settings')
            .select('referral_enabled, referral_reward_tokens')
            .eq('id', 'global')
            .single();

        if (!settings?.referral_enabled) return;
        const welcomeTokens = settings.referral_reward_tokens || 0;

        await adminClient.rpc('rpc_apply_referral_code', {
            p_referee_id: userId,
            p_referral_code: refCode,
            p_welcome_tokens: welcomeTokens,
        });
    } catch (e: any) {
        console.error('[Referral] OAuth callback apply code failed (non-fatal):', e.message);
    }
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/dashboard';
    const refCode = searchParams.get('ref'); // referral code passed via e.g. /signup?ref=ABCD1234

    // Check if Supabase sent an error via searchParams (e.g. email collision during OAuth)
    const authError = searchParams.get('error');
    const authErrorDesc = searchParams.get('error_description');

    if (authError || authErrorDesc) {
        if (authErrorDesc?.toLowerCase().includes('database error') || authErrorDesc?.toLowerCase().includes('already registered') || authErrorDesc?.toLowerCase().includes('user already exists')) {
            return NextResponse.redirect(`${origin}/login?error=merge_account`);
        }
        return NextResponse.redirect(`${origin}/login?error=${authError}`);
    }

    if (code) {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        cookieStore.set({ name, value, ...options });
                    },
                    remove(name: string, options: CookieOptions) {
                        cookieStore.delete({ name, ...options });
                    },
                },
            }
        );

        const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('database error saving new user')) {
                return NextResponse.redirect(`${origin}/login?error=merge_account`);
            }
            return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
        }

        if (!error && user) {
            // To bypass RLS and create the initial profile or write logs, use the Service Role Key
            const adminSupabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                {
                    cookies: {
                        get: () => undefined,
                        set: () => { },
                        remove: () => { },
                    }
                }
            );

            // Check if this is the first time the user is logging in (missing profile)
            const { data: userProfile } = await supabase.from('users').select('*').eq('id', user.id).single();

            if (!userProfile) {

                // Automatically create user profile
                const email = user.email!;
                const name = user.user_metadata?.full_name || user.user_metadata?.name || 'Google User';
                const photoUrl = user.user_metadata?.avatar_url || '';

                const isAdmin = process.env.NEXT_PUBLIC_ADMIN_EMAIL && email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

                if (isAdmin) {
                    await adminSupabase.from('users').insert({
                        id: user.id,
                        name: name,
                        email: email,
                        role: 'admin',
                        is_verified: false, // Phone verification is required globally
                        token_balance_visitor: 0,
                        global_rating: 0,
                        photo_url: photoUrl,
                    });
                    await adminSupabase.from('logs').insert({
                        actorId: user.id,
                        actorName: name,
                        actorRole: 'admin',
                        action: LogAction.USER_SIGNUP,
                        description: `New admin user "${name}" (${email}) signed up via Google.`
                    });
                } else {
                    let startingTokens = 0;
                    const { data: settingsData } = await adminSupabase.from('settings').select('*').eq('id', 'global').single();
                    if (settingsData) {
                        startingTokens = settingsData.starting_token_visitor || 0;
                    }

                    await adminSupabase.from('users').insert({
                        id: user.id,
                        name: name,
                        email: email,
                        role: 'visitor',
                        is_verified: false, // Phone verification is required globally
                        token_balance_visitor: startingTokens,
                        global_rating: 0,
                        photo_url: photoUrl,
                    });

                    await adminSupabase.from('logs').insert({
                        actorId: user.id,
                        actorName: name,
                        actorRole: 'visitor',
                        action: LogAction.USER_SIGNUP,
                        description: `New user "${name}" (${email}) signed up via Google as a visitor.`
                    });

                    if (startingTokens > 0) {
                        await adminSupabase.from('logs').insert({
                            actorId: user.id,
                            actorName: name,
                            actorRole: 'visitor',
                            action: LogAction.INITIAL_TOKEN_ALLOCATION,
                            description: `Welcome Bonus: Received ${startingTokens} tokens on Google signup.`,
                            tokenChange: startingTokens,
                        });
                    }

                    // Apply referral code if the OAuth redirect included ?ref=CODE
                    // e.g. user opened /signup?ref=ABCD1234 and clicked "Sign in with Google"
                    if (refCode) {
                        await maybeApplyReferral(adminSupabase, user.id, refCode);
                    }

                    // Auto-generate referral code for the new user
                    try {
                        await adminSupabase.rpc('rpc_generate_referral_code', {
                            p_user_id: user.id,
                            p_length: 8,
                        });
                    } catch (codeErr: any) {
                        console.error('[Referral] Code generation failed (non-fatal):', codeErr.message);
                    }
                }
            } else {
                // Just a regular login
                await adminSupabase.from('logs').insert({
                    actorId: user.id,
                    actorName: userProfile.name || 'Google User',
                    actorRole: userProfile.role || 'visitor',
                    action: LogAction.USER_LOGIN,
                    description: `User logged in via Google.`
                });
            }

            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
