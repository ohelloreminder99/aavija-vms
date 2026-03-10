'use client';

import * as React from 'react';
import {
  ArrowLeft,
  Loader2,
  Search,
  Eye,
  History,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import Image from 'next/image';
import { useUser, useCollection } from '@/supabase';
import { useUserProfile } from '@/services/user-service';
import { useSettings } from '@/services/settings-service';
import Link from 'next/link';
import { format, subDays, parse } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSearchParams } from 'next/navigation';
import { getVisitsForPremise } from '../../admin/premises/actions';
import { cn } from '@/lib/utils';

type SerializableVisit = NonNullable<Awaited<ReturnType<typeof getVisitsForPremise>>['visits']>[0];
const PAGE_SIZE = 10;

export default function GatekeeperHistoryPage() {
  const { user } = useUser();
  const { data: userProfile } = useUserProfile(user?.id);
  const { data: settings, isLoading: isLoadingSettings } = useSettings();
  const searchParams = useSearchParams();
  const premiseIdFromUrl = searchParams.get('premiseId');

  const premiseId = premiseIdFromUrl || (userProfile?.premise_roles && Object.keys(userProfile.premise_roles)[0]);

  const [visits, setVisits] = React.useState<SerializableVisit[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastVisible, setLastVisible] = React.useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = React.useState(true);

  const [imageUrlToView, setImageUrlToView] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');

  const [startDate, setStartDate] = React.useState<string>(format(subDays(new Date(), 30), 'dd/MM/yyyy'));
  const [endDate, setEndDate] = React.useState<string>(format(new Date(), 'dd/MM/yyyy'));
  const [dateError, setDateError] = React.useState<string | null>(null);

  // Realtime Pulse: Dynamically refetch data if another guard processes a check-in
  const { data: realtimePulse } = useCollection({ table: 'visits', __memo: true });
  const pulseHash = realtimePulse ? realtimePulse.length : 0;

  // Effect for the initial data fetch. Runs only when component mounts or critical IDs/settings change.
  React.useEffect(() => {
    if (!premiseId || !settings) {
      if (isLoadingSettings) return;
      setIsLoading(false);
      if (!premiseId) {
        setError("Could not determine the premise ID.");
      }
      return;
    }

    const fetchInitialVisits = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const historyDays = settings?.history_days_gatekeeper;
        const startDateString = historyDays && historyDays > 0 ? subDays(new Date(), historyDays).toISOString() : undefined;

        const result = await getVisitsForPremise({
          premiseId,
          limit: PAGE_SIZE,
          startDate: startDateString,
        });

        if (result.success && result.visits) {
          setVisits(result.visits);
          setLastVisible(result.lastVisible);
          setHasMore(result.visits.length === PAGE_SIZE);
        } else {
          throw new Error(result.error || 'Failed to load visits.');
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialVisits();
  }, [premiseId, settings, isLoadingSettings, pulseHash]);

  const handleLoadMore = async () => {
    if (!premiseId || !hasMore || isLoadingMore || !settings) return;

    setIsLoadingMore(true);
    try {
      const historyDays = settings.history_days_gatekeeper;
      const startDateString = historyDays && historyDays > 0 ? subDays(new Date(), historyDays).toISOString() : undefined;

      const result = await getVisitsForPremise({
        premiseId,
        limit: PAGE_SIZE,
        startAfter: lastVisible,
        startDate: startDateString,
      });

      if (result.success && result.visits) {
        setVisits(prev => [...prev, ...result.visits!]);
        setLastVisible(result.lastVisible);
        setHasMore(result.visits.length === PAGE_SIZE);
      } else {
        throw new Error(result.error || 'Failed to load more visits.');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleDateInputChange = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const digitsOnly = value.replace(/\D/g, '');
    let formattedDate = digitsOnly;

    if (digitsOnly.length > 4) {
      formattedDate = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4, 8)}`;
    } else if (digitsOnly.length > 2) {
      formattedDate = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
    }
    setter(formattedDate);
  };

  const filteredVisits = React.useMemo(() => {
    if (!visits) return [];

    let dateFilteredVisits = visits.filter(v => v.status !== 'active');

    // Apply date range filter
    setDateError(null);
    try {
      const fromDate = parse(startDate, 'dd/MM/yyyy', new Date());
      const toDate = parse(endDate, 'dd/MM/yyyy', new Date());

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        setDateError('Invalid date format. Please use DD/MM/YYYY.');
        return [];
      }
      if (fromDate > toDate) {
        setDateError('Start date cannot be after end date.');
        return [];
      }

      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);

      dateFilteredVisits = dateFilteredVisits.filter((visit) => {
        const visitDate = new Date(visit.checkin_time);
        return visitDate >= fromDate && visitDate <= toDate;
      });
    } catch (e) {
      setDateError('An error occurred while parsing dates.');
      return [];
    }

    const lowerSearch = searchTerm.toLowerCase();
    if (!lowerSearch) return dateFilteredVisits;

    return dateFilteredVisits.filter(
      (v) =>
        v.visitor_name.toLowerCase().includes(lowerSearch) ||
        (v.host_name || '').toLowerCase().includes(lowerSearch) ||
        v.status.toLowerCase().includes(lowerSearch)
    );
  }, [visits, searchTerm, startDate, endDate]);

  const renderContent = () => {
    if (isLoading || isLoadingSettings) {
      return (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="py-20 text-center text-destructive border-2 border-dashed border-destructive/50 rounded-lg bg-destructive/10">
          <AlertTriangle className="mx-auto h-12 w-12" />
          <h3 className="mt-4 text-lg font-semibold">Could Not Load History</h3>
          <p className="mt-2 text-sm max-w-md mx-auto">{error}</p>
        </div>
      );
    }

    if (!visits || visits.length === 0) {
      return (
        <div className="py-24 text-center bg-white/[0.01]">
          <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
            <History className="h-8 w-8 text-zinc-700" />
          </div>
          <p className="mb-2 font-bold text-white uppercase tracking-widest text-sm">No History Found</p>
          <p className="text-xs text-zinc-500 max-w-[200px] mx-auto leading-relaxed">
            No check-ins have been recorded at this premise yet.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <Table>
          <TableHeader className="bg-white/[0.03]">
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6 pl-8 w-16">Snapshot</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Visitor Name</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Host Met</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Check-in</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Check-out</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVisits.map((visit) => (
              <TableRow key={visit.id} className="border-white/5 hover:bg-white/[0.02] group/row transition-colors">
                <TableCell className="pl-8 py-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setImageUrlToView(visit.visitor_snapshot_url || null)}
                    disabled={!visit.visitor_snapshot_url}
                    className="h-10 w-10 rounded-xl bg-white/5 border border-white/5 text-zinc-500 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="font-bold text-white tracking-tight group-hover/row:text-primary transition-colors">{visit.visitor_name}</div>
                </TableCell>
                <TableCell>
                  <div className="text-zinc-400 font-medium">{visit.host_name || 'N/A'}</div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-[11px] text-zinc-400">{visit.checkin_time ? format(new Date(visit.checkin_time), 'PPp') : 'N/A'}</span>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-[11px] text-zinc-400">{visit.checkout_time ? format(new Date(visit.checkout_time), 'PPp') : 'N/A'}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-widest bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
                    {visit.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-8 flex justify-center pb-12">
          {hasMore && (
            <Button onClick={handleLoadMore} variant="outline" disabled={isLoadingMore} className="h-12 px-10 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 font-black uppercase tracking-widest text-[10px] transition-all">
              {isLoadingMore ? <Loader2 className="mr-3 h-4 w-4 animate-spin text-primary" /> : "Load More"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const historyDays = settings?.history_days_gatekeeper;
  const description = historyDays && historyDays > 0
    ? `A paginated log of visitor check-ins from the last ${historyDays} days.`
    : 'A paginated log of all visitor check-ins at this premise.';

  return (
    <>
      <div className="container py-10 max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <Button asChild variant="ghost" className="text-zinc-500 hover:text-primary hover:bg-white/5 group/back">
            <Link href={`/dashboard/gatekeeper?premiseId=${premiseId}`} className="flex items-center">
              <ArrowLeft className="mr-3 h-4 w-4 group-hover/back:-translate-x-1 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest">Back to Dashboard</span>
            </Link>
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Live Sync Active</span>
          </div>
        </div>

        <Card className="glass-card border-white/5 shadow-2xl relative overflow-hidden mb-20">
          <div className="absolute inset-0 mesh-blue opacity-5 pointer-events-none" />
          <CardHeader className="relative z-10 border-b border-white/5 pb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <History className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-4xl font-headline font-bold text-white tracking-tight">Visit <span className="text-primary/80">History</span></CardTitle>
            </div>
            <CardDescription className="text-zinc-500 text-[11px] font-medium uppercase tracking-widest max-w-2xl leading-relaxed">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 pt-8">
            <div className="space-y-8">
              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-6 relative overflow-hidden">
                <div className="absolute inset-0 mesh-blue opacity-5 pointer-events-none" />
                <div className="relative z-10 flex flex-wrap items-end gap-6">
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start-date" className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Start Date</Label>
                      <div className="relative">
                        <Input id="start-date" type="text" placeholder="DD/MM/YYYY" value={startDate} onChange={(e) => handleDateInputChange(e.target.value, setStartDate)} className="w-[140px] bg-black/20 border-white/10 text-white h-11 font-mono text-xs pl-4" maxLength={10} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date" className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">End Date</Label>
                      <div className="relative">
                        <Input id="end-date" type="text" placeholder="DD/MM/YYYY" value={endDate} onChange={(e) => handleDateInputChange(e.target.value, setEndDate)} className="w-[140px] bg-black/20 border-white/10 text-white h-11 font-mono text-xs pl-4" maxLength={10} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-700 transition-colors group-focus-within:text-primary" />
                  <Input
                    placeholder="Search by visitor name, host name, or status..."
                    className="pl-12 bg-black/40 border-white/5 text-white h-12 rounded-2xl placeholder:text-zinc-600 focus:border-primary/30 transition-all focus:ring-primary/20"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {dateError && <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest mt-2 ml-1">{dateError}</p>}
              </div>

              <div className="rounded-3xl border border-white/5 bg-black/20 overflow-hidden shadow-2xl">
                {renderContent()}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!imageUrlToView} onOpenChange={(open) => !open && setImageUrlToView(null)}>
        <DialogContent className="max-w-xl bg-black/95 border-white/10 backdrop-blur-3xl p-0 overflow-hidden">
          <div className="absolute top-4 left-4 z-20">
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[8px] font-black uppercase tracking-widest px-3 py-1">Visitor Photo</Badge>
          </div>
          {imageUrlToView && (
            <div className="relative aspect-square w-full">
              <Image
                src={imageUrlToView}
                alt="Visitor snapshot"
                fill
                className="object-contain"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-40" />
            </div>
          )}
          <div className="p-4 bg-[#020617] border-t border-white/5 flex justify-end">
            <DialogClose asChild>
              <Button className="bg-white/5 text-zinc-400 hover:text-white h-9 text-[10px] font-bold uppercase tracking-widest px-6">Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
