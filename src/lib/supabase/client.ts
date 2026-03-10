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
    if (parts.length === 2) return parts.pop()?.split(';').shift();
  };

  const rawUrl = getCookie('x-region-url') || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const rawKey = getCookie('x-region-anon-key') || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Sanitize: strip literal quotes from .env strings
  const url = (rawUrl || '').replace(/['"]/g, '');
  const key = (rawKey || '').replace(/['"]/g, '');

  return createBrowserClient(url, key)
}
