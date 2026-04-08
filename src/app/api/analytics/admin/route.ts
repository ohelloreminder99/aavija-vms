import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminDb } from '@/lib/supabase/server';

export async function GET() {
  try {
    // Auth check — must be admin
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', authData.user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminDb = await getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // --- KPIs ---
    const [
      { count: totalVisits },
      { count: activeVisits },
      { count: totalUsers },
      { count: totalPremises },
      { data: revenueData },
    ] = await Promise.all([
      adminDb.from('visits').select('*', { count: 'exact', head: true }),
      adminDb.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      adminDb.from('users').select('*', { count: 'exact', head: true }),
      adminDb.from('premises').select('*', { count: 'exact', head: true }),
      adminDb.from('invoices').select('total_amount'),
    ]);

    const totalRevenue = (revenueData || []).reduce((sum: number, inv: any) => sum + (inv.total_amount || 0), 0);

    // --- VISITS OVER TIME (last 30 days) ---
    const { data: visitsByDay } = await adminDb
      .from('visits')
      .select('checkin_time')
      .gte('checkin_time', thirtyDaysAgo)
      .order('checkin_time', { ascending: true });

    const visitDayMap: Record<string, number> = {};
    (visitsByDay || []).forEach((v: any) => {
      const day = v.checkin_time?.substring(0, 10);
      if (day) visitDayMap[day] = (visitDayMap[day] || 0) + 1;
    });

    // --- REVENUE OVER TIME (last 30 days) ---
    const { data: invoicesByDay } = await adminDb
      .from('invoices')
      .select('timestamp, totalAmount')
      .gte('timestamp', thirtyDaysAgo)
      .order('timestamp', { ascending: true });

    const revenueDayMap: Record<string, { owner: number; visitor: number }> = {};
    (invoicesByDay || []).forEach((inv: any) => {
      const day = inv.timestamp?.substring(0, 10);
      if (!day) return;
      if (!revenueDayMap[day]) revenueDayMap[day] = { owner: 0, visitor: 0 };
      // visitor invoices have no premiseId
      if (inv.premise_id) {
        revenueDayMap[day].owner += inv.total_amount || 0;
      } else {
        revenueDayMap[day].visitor += inv.total_amount || 0;
      }
    });

    // --- VISIT STATUS BREAKDOWN ---
    const { data: allStatuses } = await adminDb.from('visits').select('status');
    const statusMap: Record<string, number> = {};
    (allStatuses || []).forEach((v: any) => {
      const s = v.status || 'unknown';
      statusMap[s] = (statusMap[s] || 0) + 1;
    });

    // --- TOP PREMISES BY VISITS ---
    const { data: premiseVisits } = await adminDb
      .from('visits')
      .select('premise_name')
      .gte('checkin_time', thirtyDaysAgo);

    const premiseMap: Record<string, number> = {};
    (premiseVisits || []).forEach((v: any) => {
      const name = v.premise_name || 'Unknown';
      premiseMap[name] = (premiseMap[name] || 0) + 1;
    });
    const topPremises = Object.entries(premiseMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    // --- NEW USERS OVER TIME (last 30 days) ---
    const { data: newUsers } = await adminDb
      .from('users')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true });

    const userDayMap: Record<string, number> = {};
    (newUsers || []).forEach((u: any) => {
      const day = u.created_at?.substring(0, 10);
      if (day) userDayMap[day] = (userDayMap[day] || 0) + 1;
    });

    // Build time-series arrays spanning the full 30-day window
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      days.push(d.toISOString().substring(0, 10));
    }

    const visitTimeSeries = days.map((day) => ({
      date: day,
      visits: visitDayMap[day] || 0,
    }));

    const revenueTimeSeries = days.map((day) => ({
      date: day,
      owner: Math.round((revenueDayMap[day]?.owner || 0) * 100) / 100,
      visitor: Math.round((revenueDayMap[day]?.visitor || 0) * 100) / 100,
    }));

    const userTimeSeries = days.map((day) => ({
      date: day,
      users: userDayMap[day] || 0,
    }));

    const statusBreakdown = Object.entries(statusMap).map(([name, value]) => ({
      name,
      value,
    }));

    return NextResponse.json({
      kpis: {
        totalVisits: totalVisits || 0,
        activeVisits: activeVisits || 0,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalUsers: totalUsers || 0,
        totalPremises: totalPremises || 0,
      },
      visitTimeSeries,
      revenueTimeSeries,
      userTimeSeries,
      statusBreakdown,
      topPremises,
    });
  } catch (e: any) {
    console.error('[Admin Analytics]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
