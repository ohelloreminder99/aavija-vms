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

    // --- DEFENSIVE SECURITY: RELAXED CSP FOR PRODUCTION HYDRATION ---
    const cspHeader = `
      default-src 'self' https: http:;
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:;
      style-src 'self' 'unsafe-inline' https: http:;
      img-src 'self' blob: data: https://*.supabase.co https://*.googleusercontent.com https://*.unsplash.com https://picsum.photos https://placehold.co;
      font-src 'self' data: https: http:;
      connect-src 'self' https: http: wss: ws:;
      frame-src 'self' https://api.razorpay.com https://challenges.cloudflare.com https://td.doubleclick.net;
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      block-all-mixed-content;
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    response.headers.set('Content-Security-Policy', cspHeader);

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
