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
      if (val === 'undefined' || val === 'null' || !val) return undefined;
      return val;
    }
    return undefined;
  };

  const FALLBACK_URL = "https://plruocrysgpyyfypcjwe.supabase.co";
  const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBscnVvY3J5c2dweXlmeXBjandlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MDY3MTAsImV4cCI6MjA4NzM4MjcxMH0.LE-vFHeyOIbmV4o5v5Y3cuP_-RHstYtU6oZywrm9gLU";

  const cookieUrl = getCookie('x-region-url');
  const cookieKey = getCookie('x-region-anon-key');

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Prioritize Local ENV for localhost, but FALLBACK if things look "wrong"
  let url = (cookieUrl || envUrl || FALLBACK_URL).replace(/['"]/g, '').trim();
  let key = (cookieKey || envKey || FALLBACK_KEY).replace(/['"]/g, '').trim();

  // FINAL ISOLATION: Validate with standard URL constructor
  try {
    if (!url) throw new Error("URL is empty");
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith('http')) throw new Error("Protocol is not http/https");
  } catch (e) {
    // If validation fails even with fallback, the env is truly broken
    // FORCE hardcoded values as a ultimate failsafe
    url = FALLBACK_URL;
    key = FALLBACK_KEY;
  }

  // Final validation for the key
  if (!key || key === 'undefined' || key === 'null') {
    key = FALLBACK_KEY;
  }

  return createBrowserClient(url, key)
}
