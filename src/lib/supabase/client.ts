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

  // EMERGENCY FALLBACK (Direct from .env.local analysis)
  const FALLBACK_URL = "https://plruocrysgpyyfypcjwe.supabase.co";
  const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBscnVvY3J5c2dweXlmeXBjandlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MDY3MTAsImV4cCI6MjA4NzM4MjcxMH0.LE-vFHeyOIbmV4o5v5Y3cuP_-RHstYtU6oZywrm9gLU";

  const rawUrl = cookieUrl || envUrl || FALLBACK_URL;
  const rawKey = cookieKey || envKey || FALLBACK_KEY;

  // Sanitize: strip literal quotes from .env strings and handle empty/undefined
  const url = (rawUrl || '').replace(/['"]/g, '').trim();
  const key = (rawKey || '').replace(/['"]/g, '').trim();

  // Forensic Check: If it still looks malformed, show me the hex dump
  if (!url || !url.startsWith('http')) {
    const hex = Array.from(url).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
    const source = cookieUrl ? 'Cookie' : (envUrl ? 'Env' : 'Hardcoded');
    throw new Error(`CRITICAL: Invalid supabaseUrl from ${source}. Value: "${url}" | Hex: [${hex}]`);
  }

  if (!key) {
    throw new Error(`CRITICAL: Missing supabaseAnonKey.`);
  }

  return createBrowserClient(url, key)
}
