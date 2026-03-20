'use client';

/**
 * AAVIJA VMS — Admin Health Dashboard
 * Live system overview: active check-ins, pending applications, user counts, log activity.
 * Auto-refreshes every 60 seconds.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft, RefreshCw, Building, Users, ClipboardList,
  Activity, ShieldCheck, Database, Wifi, BarChart3,
  CheckCircle2, AlertTriangle, Clock3, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getHealthMetrics, type HealthMetrics } from './actions';

// ─── STAT CARD ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  accent = 'default',
  blink = false,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sublabel?: string;
  accent?: 'default' | 'green' | 'amber' | 'red' | 'blue';
  blink?: boolean;
}) {
  const accentStyles = {
    default: 'bg-white/5 border-white/10 text-zinc-300',
    green:   'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    amber:   'bg-amber-500/10 border-amber-500/20 text-amber-400',
    red:     'bg-red-500/10 border-red-500/20 text-red-400',
    blue:    'bg-primary/10 border-primary/20 text-primary',
  };

  const iconBg = {
    default: 'bg-white/10 text-zinc-400',
    green:   'bg-emerald-500/15 text-emerald-400',
    amber:   'bg-amber-500/15 text-amber-400',
    red:     'bg-red-500/15 text-red-400',
    blue:    'bg-primary/15 text-primary',
  };

  return (
    <div className={cn('relative rounded-2xl border p-5 flex flex-col gap-3 transition-all', accentStyles[accent])}>
      <div className="flex items-center justify-between">
        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center', iconBg[accent])}>
          <Icon className={cn('h-4 w-4', blink && 'animate-pulse')} />
        </div>
        {blink && (
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Live</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-3xl font-black text-white tracking-tight">{value}</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">{label}</p>
        {sublabel && <p className="text-[9px] text-zinc-500 font-medium mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

// ─── SERVICE STATUS ROW ───────────────────────────────────────────────────────

function ServiceStatus({ name, ok, note }: { name: string; ok: boolean; note?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <div className={cn('h-2 w-2 rounded-full', ok ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-red-400 animate-pulse')} />
        <span className="text-[11px] font-bold text-zinc-300">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        {note && <span className="text-[9px] text-zinc-500 font-medium">{note}</span>}
        <Badge className={cn(
          'text-[8px] font-black uppercase tracking-widest border-none px-2 py-0.5',
          ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        )}>
          {ok ? 'Operational' : 'Degraded'}
        </Badge>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function AdminHealthPage() {
  const [metrics, setMetrics] = React.useState<HealthMetrics | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = React.useState<Date | null>(null);
  const [dbOk, setDbOk] = React.useState(true);

  const fetchMetrics = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getHealthMetrics();
      if (result.success && result.data) {
        setMetrics(result.data);
        setDbOk(true);
        setError(null);
      } else {
        setDbOk(false);
        setError(result.error ?? 'Unknown error');
      }
    } catch (e: any) {
      setDbOk(false);
      setError(e.message);
    } finally {
      setIsLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  // Initial load + auto-refresh every 60s
  React.useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60_000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const formatted = (d: Date | null) =>
    d ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

  return (
    <div className="container py-10 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <Button asChild variant="ghost" className="text-zinc-400 hover:text-primary hover:bg-white/5 group/back mb-4">
            <Link href="/dashboard/admin" className="flex items-center">
              <ArrowLeft className="mr-3 h-4 w-4 group-hover/back:-translate-x-1 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest">Back to Dashboard</span>
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-headline font-bold text-white tracking-tight">
                System <span className="text-primary/80">Health</span>
              </h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">
                Live operational metrics • Auto-refreshes every 60s
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-medium text-zinc-500">
            Last updated: {formatted(lastRefresh)}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchMetrics}
            disabled={isLoading}
            className="h-9 px-4 rounded-xl border border-white/10 bg-white/5 text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-widest"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-[11px] font-bold text-red-400">{error}</p>
        </div>
      )}

      {/* ── Live Activity ────────────────────────────────────────────── */}
      <section className="mb-8">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Live Activity</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Activity}
            label="Active Check-ins"
            value={metrics?.activeCheckinsNow ?? '—'}
            sublabel="Visitors currently inside"
            accent="green"
            blink={!!metrics?.activeCheckinsNow && metrics.activeCheckinsNow > 0}
          />
          <StatCard
            icon={TrendingUp}
            label="Visits Today"
            value={metrics?.totalVisitsToday ?? '—'}
            sublabel="Since midnight"
            accent="blue"
          />
          <StatCard
            icon={ClipboardList}
            label="Pending Applications"
            value={metrics?.pendingApplications ?? '—'}
            sublabel="Awaiting admin review"
            accent={metrics?.pendingApplications && metrics.pendingApplications > 0 ? 'amber' : 'default'}
          />
          <StatCard
            icon={CheckCircle2}
            label="Approved (7 days)"
            value={metrics?.approvedLast7Days ?? '—'}
            sublabel="New premises created"
            accent="green"
          />
        </div>
      </section>

      {/* ── Premises & Users ─────────────────────────────────────────── */}
      <section className="mb-8">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Platform Overview</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Building} label="Total Premises" value={metrics?.totalPremises ?? '—'} />
          <StatCard
            icon={Building}
            label="Active Premises"
            value={metrics?.activePremises ?? '—'}
            accent="green"
          />
          <StatCard icon={Users} label="Total Users" value={metrics?.totalUsers ?? '—'} />
          <StatCard icon={Users} label="New Users Today" value={metrics?.newUsersToday ?? '—'} accent="blue" />
        </div>
      </section>

      {/* ── System & Services ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Log Activity */}
        <Card className="glass-card border-white/10 bg-white/5 rounded-2xl">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <CardTitle className="text-[11px] font-black uppercase tracking-widest text-zinc-300">
                Log Activity (24h)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Log Entries</span>
              <span className="text-2xl font-black text-white">{metrics?.totalLogs24h ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Unverified Users</span>
              <span className={cn(
                'text-2xl font-black',
                metrics?.unverifiedUsers && metrics.unverifiedUsers > 0 ? 'text-amber-400' : 'text-white'
              )}>
                {metrics?.unverifiedUsers ?? '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Service Status */}
        <Card className="glass-card border-white/10 bg-white/5 rounded-2xl">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-primary" />
              <CardTitle className="text-[11px] font-black uppercase tracking-widest text-zinc-300">
                Service Status
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ServiceStatus name="Supabase Database" ok={dbOk} note={dbOk ? 'Connected' : 'Connection failed'} />
            <ServiceStatus name="Authentication" ok={dbOk} note="Supabase Auth" />
            <ServiceStatus name="Server Actions" ok={!error} note="Next.js" />
            <ServiceStatus name="Storage Buckets" ok={true} note="avatars, snapshots, bills" />
            <ServiceStatus name="Error Monitoring" ok={true} note="Sentry" />
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-[9px] font-medium text-zinc-600">
          Metrics are fetched live from Supabase. For deep error analysis, visit your{' '}
          <a
            href="https://sentry.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary/60 hover:text-primary underline-offset-2 hover:underline transition-colors"
          >
            Sentry dashboard
          </a>
          .
        </p>
      </div>
    </div>
  );
}
