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

    return response
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
