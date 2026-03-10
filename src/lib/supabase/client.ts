import { createBrowserClient } from '@supabase/ssr'

/**
 * Synchronous client creation for the browser.
 * Reads regional credentials from cookies injected by middleware.
 */
export function createClient() {
  // Helper to get cookie on browser
  const getCookie = (name: string) => {
    if (typeof document === 'undefined') return undefined;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const val = parts.pop()?.split(';').shift();
      // Filter out malformed cookie values from previous failed runs
      if (val === 'undefined' || val === 'null' || !val) return undefined;
      return val;
    }
    return undefined;
  };

  const cookieUrl = getCookie('x-region-url');
  const cookieKey = getCookie('x-region-anon-key');

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const rawUrl = cookieUrl || envUrl;
  const rawKey = cookieKey || envKey;

  // Sanitize: strip literal quotes from .env strings and handle empty/undefined
  const url = (rawUrl || '').replace(/['"]/g, '').trim();
  const key = (rawKey || '').replace(/['"]/g, '').trim();

  if (!url || !url.startsWith('http')) {
    const source = cookieUrl ? 'Cookie (x-region-url)' : 'Env (NEXT_PUBLIC_SUPABASE_URL)';
    throw new Error(`Invalid supabaseUrl: Missing or malformed. Detected Source: ${source}. Value: "${url}"`);
  }

  if (!key) {
    const source = cookieKey ? 'Cookie (x-region-anon-key)' : 'Env (NEXT_PUBLIC_SUPABASE_ANON_KEY)';
    throw new Error(`Invalid supabaseAnonKey: Missing. Detected Source: ${source}`);
  }

  return createBrowserClient(url, key)
}
