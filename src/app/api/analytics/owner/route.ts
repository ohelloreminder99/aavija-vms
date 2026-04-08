import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const premiseId = searchParams.get('premise_id');

    if (!premiseId) {
      return NextResponse.json({ error: 'premiseId required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate that the user has owner or admin role for this premise
    const { data: profile } = await supabase
      .from('users')
      .select('role, premise_roles')
      .eq('id', authData.user.id)
      .single();

    const isAdmin = profile?.role === 'admin';
    const premiseRoles = profile?.premise_roles as Record<string, string[]> | null;
    const rolesForPremise = premiseRoles?.[premiseId] || [];
    const isOwnerOrHost =
      rolesForPremise.includes('owner') || rolesForPremise.includes('host');

    if (!isAdmin && !isOwnerOrHost) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // All visits for this premise (last 30 days)
    const { data: recentVisits } = await supabase
      .from('visits')
      .select('checkin_time, checkout_time, status, host_name')
      .eq('premise_id', premiseId)
      .gte('checkin_time', thirtyDaysAgo)
      .order('checkin_time', { ascending: true });

    // All visit counts for KPI
    const { count: totalVisits } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .eq('premise_id', premiseId);

    const { count: activeVisits } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .eq('premise_id', premiseId)
      .eq('status', 'active');

    // Token invoices for this premise
    const { data: invoices } = await supabase
      .from('invoices')
      .select('timestamp, tokenAmount, totalAmount')
      .eq('premise_id', premiseId)
      .gte('timestamp', thirtyDaysAgo)
      .order('timestamp', { ascending: true });

    // Build day-series for visits
    const visitDayMap: Record<string, number> = {};
    const hourMap: Record<number, number> = {};
    const statusMap: Record<string, number> = {};
    const hostMap: Record<string, number> = {};

    let totalDuration = 0;
    let completedCount = 0;

    (recentVisits || []).forEach((v: any) => {
      const day = v.checkin_time?.substring(0, 10);
      if (day) visitDayMap[day] = (visitDayMap[day] || 0) + 1;

      const hour = new Date(v.checkin_time).getHours();
      hourMap[hour] = (hourMap[hour] || 0) + 1;

      const s = v.status || 'unknown';
      statusMap[s] = (statusMap[s] || 0) + 1;

      if (v.host_name) {
        hostMap[v.host_name] = (hostMap[v.host_name] || 0) + 1;
      }

      if (v.checkout_time && v.checkin_time) {
        const dur =
          new Date(v.checkout_time).getTime() - new Date(v.checkin_time).getTime();
        if (dur > 0) {
          totalDuration += dur;
          completedCount++;
        }
      }
    });

    const avgDurationMinutes =
      completedCount > 0 ? Math.round(totalDuration / completedCount / 60000) : 0;

    // Token spend by day
    const tokenDayMap: Record<string, number> = {};
    (invoices || []).forEach((inv: any) => {
      const day = inv.timestamp?.substring(0, 10);
      if (day) tokenDayMap[day] = (tokenDayMap[day] || 0) + (inv.token_amount || 0);
    });

    // Build 30-day arrays
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      days.push(d.toISOString().substring(0, 10));
    }

    const visitTimeSeries = days.map((day) => ({
      date: day,
      visits: visitDayMap[day] || 0,
    }));

    const tokenTimeSeries = days.map((day) => ({
      date: day,
      tokens: tokenDayMap[day] || 0,
    }));

    const hourlyData = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${h.toString().padStart(2, '0')}:00`,
      visits: hourMap[h] || 0,
    }));

    const statusBreakdown = Object.entries(statusMap).map(([name, value]) => ({
      name,
      value,
    }));

    const topHosts = Object.entries(hostMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    const topHost = topHosts[0]?.name || 'N/A';

    return NextResponse.json({
      kpis: {
        totalVisits: totalVisits || 0,
        activeVisits: activeVisits || 0,
        avgDurationMinutes,
        topHost,
      },
      visitTimeSeries,
      tokenTimeSeries,
      hourlyData,
      statusBreakdown,
      topHosts,
    });
  } catch (e: any) {
    console.error('[Owner Analytics]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
