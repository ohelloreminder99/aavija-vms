import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getRegionConfig } from './lib/multi-tenant'

export async function middleware(request: NextRequest) {
    const hostname = request.headers.get('host') || ''
    const config = await getRegionConfig(hostname)

    const response = NextResponse.next()

    // Inject regional credentials into cookies so the browser client
    // can pick them up synchronously without a secondary fetch.
    // These are public anon keys, so this is safe for a VMS.
    response.cookies.set('x-region-url', config.supabase_url, { path: '/' })
    response.cookies.set('x-region-anon-key', config.supabase_anon_key, { path: '/' })
    response.cookies.set('x-region-code', config.code, { path: '/' })

    // --- DEFENSIVE SECURITY: STRICT CSP ---
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const cspHeader = `
      default-src 'self';
      script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: http: 'unsafe-inline';
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      img-src 'self' blob: data: https://*.supabase.co https://*.googleusercontent.com;
      font-src 'self' https://fonts.gstatic.com;
      connect-src 'self' https://*.supabase.co https://api.razorpay.com wss://*.supabase.co;
      frame-src 'self' https://api.razorpay.com https://challenges.cloudflare.com;
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      block-all-mixed-content;
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    response.headers.set('Content-Security-Policy', cspHeader);
    response.headers.set('x-nonce', nonce);

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
}
