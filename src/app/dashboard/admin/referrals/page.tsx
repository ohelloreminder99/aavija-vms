'use client';

import * as React from 'react';
import { Loader2, ArrowLeft, TrendingUp, Users, DollarSign, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getAllReferralEventsForAdmin } from '@/services/referral-service';
import { useSettings } from '@/services/settings-service';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function AdminReferralsPage() {
  const { toast } = useToast();
  const { data: settings } = useSettings();

  const [events, setEvents] = React.useState<any[]>([]);
  const [totalCommissionsPaid, setTotalCommissionsPaid] = React.useState(0);
  const [totalActiveReferrers, setTotalActiveReferrers] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    getAllReferralEventsForAdmin().then(res => {
      if (res.success && res.data) {
        setEvents(res.data);
        setTotalCommissionsPaid(res.totalCommissionsPaid);
        setTotalActiveReferrers(res.totalActiveReferrers);
      }
      setIsLoading(false);
    });
  }, []);

  const topReferrers = React.useMemo(() => {
    const map = new Map<string, { name: string; count: number; earned: number }>();
    events.forEach(e => {
      const existing = map.get(e.referrer_id) || { name: e.referrerName, count: 0, earned: 0 };
      map.set(e.referrer_id, {
        name: e.referrerName,
        count: existing.count + 1,
        earned: existing.earned + Number(e.commission_amount),
      });
    });
    return Array.from(map.values()).sort((a, b) => b.earned - a.earned).slice(0, 10);
  }, [events]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-10 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <Button asChild variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/10 -ml-4 px-4 h-10 text-[10px] font-black uppercase tracking-widest transition-all">
            <Link href="/dashboard/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
               <h1 className="text-4xl font-headline font-bold text-white tracking-tighter">
                 Sales Agents <span className="text-primary/80">Dashboard</span>
               </h1>
            </div>
            <p className="text-zinc-400 text-[11px] font-medium uppercase tracking-[0.2em] ml-1">
              Track agent performance, referral events, and commission payouts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-3 rounded-2xl backdrop-blur-sm shadow-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
            {settings?.referral_enabled
              ? <><div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">Referral Active</span></>
              : <><div className="h-2 w-2 rounded-full bg-zinc-300" /><span className="text-[9px] text-zinc-400 font-black uppercase tracking-widest">System Offline</span></>
            }
          </div>
          <Button asChild variant="ghost" className="h-9 px-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
            <Link href="/dashboard/admin/token-settings">Parameters</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Credited', value: `₹${totalCommissionsPaid.toLocaleString()}`, icon: DollarSign, sub: 'Global Payouts' },
          { label: 'Active Agents', value: totalActiveReferrers, icon: Users, sub: 'Registered Agents' },
          { label: 'Sales Events', value: events.length, icon: TrendingUp, sub: 'Total Records' },
        ].map((stat, i) => (
          <Card key={i} className="glass-card border-white/10 bg-white/5 overflow-hidden relative group shadow-xl">
            <div className="absolute inset-0 mesh-obsidian opacity-20 group-hover:opacity-30 transition-opacity pointer-events-none" />
            <CardContent className="p-8 relative z-10 flex items-center gap-6">
              <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-primary/30 transition-all">
                <stat.icon className="h-6 w-6 text-zinc-400 group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-3xl font-headline font-bold text-white tracking-tight">{stat.value}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mt-1">{stat.label}</p>
                <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{stat.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-6">
          <div className="flex items-center gap-2 px-2">
            <Users className="h-4 w-4 text-zinc-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Top Sales Agents</span>
          </div>
          <Card className="glass-card border-white/10 bg-white/5 overflow-hidden shadow-xl">
            <CardContent className="p-0">
              {topReferrers.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">No Active Agents</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {topReferrers.map((r, i) => (
                    <div key={i} className="group flex items-center justify-between px-6 py-5 hover:bg-white/5 transition-colors">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">{r.name}</p>
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">{r.count} SUCCESSFUL REFERRALS</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-500 tabular-nums">₹{r.earned.toLocaleString()}</p>
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-tighter mt-0.5">Earnings</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center gap-2 px-2">
            <TrendingUp className="h-4 w-4 text-zinc-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Recent Activity</span>
          </div>
          <Card className="glass-card border-white/10 bg-white/5 overflow-hidden shadow-xl">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Loading history...</p>
                </div>
              ) : events.length === 0 ? (
                <div className="py-32 text-center">
                  <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">No history found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-400 h-12 px-6">Agent</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-400 h-12 px-6">Customer</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-400 h-12 px-6">Tokens</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-400 h-12 px-6">Commission</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase tracking-widest text-zinc-400 h-12 px-6">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.slice(0, 50).map(ev => (
                      <TableRow key={ev.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                        <TableCell className="px-6 py-4 text-[11px] font-bold text-white group-hover:text-primary transition-colors">{ev.referrerName}</TableCell>
                        <TableCell className="px-6 py-4 text-[11px] text-zinc-400 font-medium">{ev.refereeName}</TableCell>
                        <TableCell className="px-6 py-4 text-[11px] text-zinc-400 font-mono tracking-tighter">{ev.purchase_amount} TOKENS</TableCell>
                        <TableCell className="px-6 py-4">
                          <span className="text-[11px] font-black text-emerald-500 tabular-nums">₹{Number(ev.commission_amount).toFixed(2)}</span>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right">
                          <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-tighter">
                            {new Date(ev.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
