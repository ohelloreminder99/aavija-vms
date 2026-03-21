'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  BarChart2,
  Users,
  Activity,
  Clock,
  User,
  Coins,
  RefreshCw,
} from 'lucide-react';
import { AnalyticsKPICard } from '@/components/shared/charts/AnalyticsKPICard';
import { ChartContainer } from '@/components/shared/charts/ChartContainer';
import { Button } from '@/components/ui/button';

const CHART_COLORS = {
  emerald: '#10b981',
  amber: '#f59e0b',
  cyan: '#06b6d4',
  violet: '#8b5cf6',
  rose: '#f43f5e',
  zinc: '#71717a',
};

const STATUS_COLORS: Record<string, string> = {
  completed: CHART_COLORS.emerald,
  active: CHART_COLORS.cyan,
  declined: CHART_COLORS.rose,
  force_closed: CHART_COLORS.amber,
  unknown: CHART_COLORS.zinc,
};

const TOOLTIP_STYLE = {
  backgroundColor: '#0a1a0f',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  color: '#fff',
  fontSize: '13px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
};

const labelFormatter = (label: React.ReactNode) => {
  const str = String(label ?? '');
  try {
    return new Date(str + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return str;
  }
};

interface OwnerAnalyticsData {
  kpis: {
    totalVisits: number;
    activeVisits: number;
    avgDurationMinutes: number;
    topHost: string;
  };
  visitTimeSeries: { date: string; visits: number }[];
  tokenTimeSeries: { date: string; tokens: number }[];
  hourlyData: { hour: number; label: string; visits: number }[];
  statusBreakdown: { name: string; value: number }[];
  topHosts: { name: string; count: number }[];
}

export default function OwnerAnalyticsPage() {
  const searchParams = useSearchParams();
  const premiseId = searchParams.get('premiseId');

  const [data, setData] = React.useState<OwnerAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    if (!premiseId) {
      setIsLoading(false);
      setError('No premise selected. Please go back and select a premise.');
      return;
    }
    setIsLoading(true);
    setError(null);
    fetch(`/api/analytics/owner?premiseId=${premiseId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load analytics data');
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [premiseId, refreshKey]);

  const fmtDuration = (minutes: number | string) => {
    const m = Number(minutes);
    if (m === 0) return '0 min';
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const fmtDate = (d: string) => {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="container py-10 max-w-7xl">
      {/* Header */}
      <div className="mb-10 flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <BarChart2 className="h-5 w-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
            </div>
            <h1 className="text-4xl font-headline font-bold tracking-tight text-white">
              Premise <span className="text-primary/80">Analytics</span>
            </h1>
          </div>
          <p className="text-zinc-400 text-[11px] font-semibold uppercase tracking-[0.2em] ml-1">
            Property-level insights · Last 30 days where applicable
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="text-zinc-400 hover:text-white hover:bg-white/5 gap-2"
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 px-6 py-4 text-rose-300 text-sm font-medium">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <AnalyticsKPICard
          title="Total Visits"
          value={data?.kpis.totalVisits ?? 0}
          icon={Activity}
          isLoading={isLoading}
          color="emerald"
          subtext="all time"
        />
        <AnalyticsKPICard
          title="Active Now"
          value={data?.kpis.activeVisits ?? 0}
          icon={Users}
          isLoading={isLoading}
          color="cyan"
          subtext="live visitors"
          trend={data && data.kpis.activeVisits > 0 ? 'up' : 'flat'}
        />
        <AnalyticsKPICard
          title="Avg Visit Duration"
          value={data?.kpis.avgDurationMinutes ?? 0}
          icon={Clock}
          isLoading={isLoading}
          color="amber"
          formatter={fmtDuration}
          subtext="completed visits"
        />
        <AnalyticsKPICard
          title="Top Host"
          value={data?.kpis.topHost ?? '—'}
          icon={User}
          isLoading={isLoading}
          color="violet"
          subtext="by check-ins"
        />
      </div>

      {/* Row 1: Visits Over Time + Hourly Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Visits Over Time */}
        <ChartContainer
          title="Daily Visits"
          description="Check-ins per day · Last 30 days"
          isLoading={isLoading}
          minHeight="260px"
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={data?.visitTimeSeries || []}
              margin={{ top: 5, right: 5, bottom: 0, left: -20 }}
            >
              <defs>
                <linearGradient id="ownerVisitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => fmtDate(d)}
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={labelFormatter}
                formatter={(v: any) => [v, 'Visits']}
                cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <Area
                type="monotone"
                dataKey="visits"
                stroke={CHART_COLORS.emerald}
                strokeWidth={2}
                fill="url(#ownerVisitGrad)"
                dot={false}
                activeDot={{ r: 4, fill: CHART_COLORS.emerald, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Hourly Heatmap (Bar) */}
        <ChartContainer
          title="Visit Heatmap by Hour"
          description="When are visitors arriving?"
          isLoading={isLoading}
          minHeight="260px"
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data?.hourlyData || []}
              margin={{ top: 5, right: 5, bottom: 0, left: -20 }}
              barSize={10}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#71717a', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={2}
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: any) => [v, 'Visits']}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar
                dataKey="visits"
                radius={[4, 4, 0, 0]}
                fill={CHART_COLORS.cyan}
                maxBarSize={14}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Row 2: Status Donut + Top Hosts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Status Donut */}
        <ChartContainer
          title="Visit Status Breakdown"
          description="Across all recorded visits"
          isLoading={isLoading}
          minHeight="260px"
        >
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data?.statusBreakdown || []}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
                strokeWidth={0}
              >
                {(data?.statusBreakdown || []).map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={STATUS_COLORS[entry.name] || CHART_COLORS.zinc}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: any, name: any) => [v, String(name ?? '').replace(/_/g, ' ')]}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, color: '#a1a1aa', textTransform: 'capitalize' }}
                formatter={(value) => value.replace(/_/g, ' ')}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Top Hosts */}
        <ChartContainer
          title="Top Hosts by Visits"
          description="Last 30 days"
          isLoading={isLoading}
          minHeight="260px"
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data?.topHosts || []}
              layout="vertical"
              margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={120}
                tickFormatter={(v) => (v.length > 16 ? v.substring(0, 14) + '…' : v)}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: any) => [v, 'Visits']}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar dataKey="count" fill={CHART_COLORS.violet} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Row 3: Token Spend Over Time */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        <ChartContainer
          title="Token Spend Over Time"
          description="Tokens consumed by this premise · 30 days"
          isLoading={isLoading}
          minHeight="220px"
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={data?.tokenTimeSeries || []}
              margin={{ top: 5, right: 5, bottom: 0, left: -20 }}
            >
              <defs>
                <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.amber} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => fmtDate(d)}
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={labelFormatter}
                formatter={(v: any) => [v, 'Tokens']}
                cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <Line
                type="monotone"
                dataKey="tokens"
                stroke={CHART_COLORS.amber}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: CHART_COLORS.amber, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center gap-2 text-zinc-600 text-xs">
        <Coins className="h-3 w-3" />
        <span>Analytics are computed in real-time from your Supabase database.</span>
      </div>
    </div>
  );
}
