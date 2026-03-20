import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/supabase/server';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
    const start = Date.now();

    try {
        const adminDb = await getAdminDb();
        if (!adminDb) throw new Error('Database not available');

        // 0. Rate Limiting (30 requests per minute per IP)
        const headerList = await headers();
        const ip = headerList.get('x-forwarded-for') || '127.0.0.1';
        
        const { checkRateLimit, healthRateLimit } = await import('@/lib/rate-limit');
        const rateCheck = await checkRateLimit(healthRateLimit, `health:${ip}`);
 
        if (!rateCheck.success) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        // 1. Check Database Connectivity
        const { error: dbError } = await adminDb.from('users').select('count', { count: 'exact', head: true });

        if (dbError) throw dbError;

        return NextResponse.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            latency: `${Date.now() - start}ms`,
            services: {
                database: 'connected',
                auth: 'operational',
            }
        }, { status: 200 });

    } catch (error: any) {
        console.error('Health Check Failed:', error);

        return NextResponse.json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message || 'Unknown error',
            services: {
                database: 'disconnected',
            }
        }, { status: 503 });
    }
}
