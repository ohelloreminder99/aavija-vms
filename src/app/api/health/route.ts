import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/supabase/server';

export async function GET() {
    const start = Date.now();

    try {
        // 1. Check Database Connectivity
        const supabase = await getAdminDb();
        const { error: dbError } = await supabase.from('users').select('count', { count: 'exact', head: true });

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
