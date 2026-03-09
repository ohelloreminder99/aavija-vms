import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}

// Function to get an admin client using the service role key.
// This should only be used in secure server environments!
export function getAdminDb() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            cookies: {
                getAll() {
                    return []
                },
                setAll() { }
            }
        }
    )
}

/**
 * Ensures a valid user session exists and fetches their full profile.
 * Use this at the start of Server Actions to prevent IDOR and Privilege Escalation.
 * Throws an Error if unauthorized.
 */
export async function requireAuth() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        throw new Error('Unauthorized: You must be logged in.');
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
        throw new Error('Server misconfiguration: Cannot verify role.');
    }

    const { data: profile, error: profileError } = await adminDb
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        throw new Error('Unauthorized: User profile not found.');
    }

    return { user, profile };
}
