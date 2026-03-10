// src/lib/multi-tenant.ts
import { createClient } from '@supabase/supabase-js'

export interface RegionConfig {
    code: string;
    domain: string;
    supabase_url: string;
    supabase_anon_key: string;
}

// In-memory cache for regional configurations
let regionsCache: RegionConfig[] | null = null;

/**
 * Resolves the regional configuration for a given hostname.
 * Falls back to environment variables if no match is found.
 */
export async function getRegionConfig(hostname: string): Promise<RegionConfig> {
    // 1. Check for hardcoded development overrides
    if (hostname === 'localhost' || hostname.includes('preview')) {
        return {
            code: 'DEV',
            domain: hostname,
            supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
            supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        };
    }

    // 2. Fetch all active regions (cached logic can be added here)
    const masterSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: regions } = await masterSupabase
        .from('regions')
        .select('*')
        .eq('is_active', true);

    if (!regions) return defaultRegion();

    // 3. Match hostname to region domain
    const match = regions.find(r => hostname.includes(r.domain));
    return match || defaultRegion();
}

function defaultRegion(): RegionConfig {
    return {
        code: 'IN',
        domain: 'india.aavija.com',
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    };
}
