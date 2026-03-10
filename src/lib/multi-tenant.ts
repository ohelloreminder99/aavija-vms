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
    // Clean hostname for comparison (handles localhost:3000, [::1]:3000, etc.)
    const cleanHost = hostname.split(':')[0].toLowerCase().replace(/[\[\]]/g, '');

    // 1. Check for hardcoded development overrides
    if (cleanHost === 'localhost' || cleanHost === '127.0.0.1' || cleanHost === '::1' || hostname.includes('preview')) {
        const FALLBACK_URL = "https://plruocrysgpyyfypcjwe.supabase.co";
        const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBscnVvY3J5c2dweXlmeXBjandlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MDY3MTAsImV4cCI6MjA4NzM4MjcxMH0.LE-vFHeyOIbmV4o5v5Y3cuP_-RHstYtU6oZywrm9gLU";

        return {
            code: 'DEV',
            domain: hostname,
            supabase_url: (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/['"]/g, '').trim() || FALLBACK_URL,
            supabase_anon_key: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim() || FALLBACK_KEY,
        };
    }

    // 2. Fetch all active regions (cached logic can be added here)
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // EMERGENCY FALLBACK (Direct from .env.local analysis)
    const FALLBACK_URL = "https://plruocrysgpyyfypcjwe.supabase.co";
    const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBscnVvY3J5c2dweXlmeXBjandlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MDY3MTAsImV4cCI6MjA4NzM4MjcxMH0.LE-vFHeyOIbmV4o5v5Y3cuP_-RHstYtU6oZywrm9gLU";

    const url = rawUrl.replace(/['"]/g, '').trim() || FALLBACK_URL;
    const key = rawKey.replace(/['"]/g, '').trim() || FALLBACK_KEY;

    const masterSupabase = createClient(url, key);

    try {
        const { data: regions } = await masterSupabase
            .from('regions')
            .select('*')
            .eq('is_active', true);

        if (!regions || regions.length === 0) return defaultRegion();

        // 3. Match hostname to region domain
        const match = regions.find(r => hostname.includes(r.domain));
        return match || defaultRegion();
    } catch (e) {
        console.error("Master Supabase connection failed, falling back to default.", e);
        return defaultRegion();
    }
}

function defaultRegion(): RegionConfig {
    const FALLBACK_URL = "https://plruocrysgpyyfypcjwe.supabase.co";
    const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBscnVvY3J5c2dweXlmeXBjandlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MDY3MTAsImV4cCI6MjA4NzM4MjcxMH0.LE-vFHeyOIbmV4o5v5Y3cuP_-RHstYtU6oZywrm9gLU";

    return {
        code: 'IN',
        domain: 'india.aavija.com',
        supabase_url: (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/['"]/g, '').trim() || FALLBACK_URL,
        supabase_anon_key: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim() || FALLBACK_KEY,
    };
}
