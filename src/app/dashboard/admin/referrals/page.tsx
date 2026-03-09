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

  // Top referrers aggregation
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
    <div className="container py-10 max-w-6xl">
      <div className="flex items-center gap-4 mb-6">
        <Button asChild variant="outline" size="sm"><Link href="/dashboard/admin"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Referral Program</h1>
          <p className="text-sm text-muted-foreground">Overview of all referral commissions. Manage payouts on the Payouts page.</p>
        </div>
        <div className="flex items-center gap-2">
          {settings?.referral_enabled
            ? <><ToggleRight className="h-5 w-5 text-green-500" /><span className="text-sm text-green-600 font-medium">Program Active</span></>
            : <><ToggleLeft className="h-5 w-5 text-muted-foreground" /><span className="text-sm text-muted-foreground">Program Disabled</span></>
          }
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/admin/token-settings">Manage Settings</Link>
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary p-1.5 bg-primary/10 rounded-lg" />
              <div>
                <p className="text-2xl font-bold">₹{totalCommissionsPaid.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total Commissions Credited</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary p-1.5 bg-primary/10 rounded-lg" />
              <div>
                <p className="text-2xl font-bold">{totalActiveReferrers}</p>
                <p className="text-xs text-muted-foreground">Active Referrers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary p-1.5 bg-primary/10 rounded-lg" />
              <div>
                <p className="text-2xl font-bold">{events.length}</p>
                <p className="text-xs text-muted-foreground">Commission Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Top Referrers */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Top Referrers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topReferrers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No referrals yet.</p>
            ) : (
              <div className="divide-y">
                {topReferrers.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.count} referral{r.count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-sm font-semibold text-green-600">₹{r.earned.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Commission Events</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No commission events yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referrer</TableHead>
                    <TableHead>Referee</TableHead>
                    <TableHead>Purchase</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.slice(0, 50).map(ev => (
                    <TableRow key={ev.id}>
                      <TableCell className="text-sm font-medium">{ev.referrerName}</TableCell>
                      <TableCell className="text-sm">{ev.refereeName}</TableCell>
                      <TableCell className="text-sm">{ev.purchase_amount} tokens</TableCell>
                      <TableCell className="text-sm font-medium text-green-600">₹{Number(ev.commission_amount).toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(ev.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
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
  );
}
