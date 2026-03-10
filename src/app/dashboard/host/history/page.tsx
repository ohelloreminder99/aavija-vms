'use client';

import * as React from 'react';
import {
  Star,
  Loader2,
  Search,
  CheckCircle2,
  UserX,
  AlertTriangle,
  Eye,
  ArrowLeft,
  Download,
} from 'lucide-react';
import { useUser, WithId } from '@/supabase';
import { useUserProfile, type UserProfile } from '@/services/user-service';
import { useCollection } from '@/supabase/firestore/use-collection';
import { useRatingsForVisits } from '@/services/rating-service';
import { submitRatingAndRecalculate, getVisitsForHostInPremise } from '../actions';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, parse } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { blockVisitorFromHost } from '@/services/block-service';
import { useSettings } from '@/services/settings-service';
import { deductTokensForExport } from '../../owner/history/actions';
import Link from 'next/link';

type SerializableVisit = NonNullable<Awaited<ReturnType<typeof getVisitsForHostInPremise>>['visits']>[0];
const PAGE_SIZE = 10;

const StarRatingInput = ({
  rating,
  setRating,
}: {
  rating: number;
  setRating: (rating: number) => void;
}) => {
  const [hoverRating, setHoverRating] = React.useState(0);
  return (
    <div className="flex items-center gap-1.5 p-4 rounded-2xl bg-white/[0.03] border border-white/5 shadow-inner">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'h-10 w-10 cursor-pointer text-zinc-800 transition-all duration-300 transform hover:scale-110',
            (hoverRating || rating) >= star
              ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]'
              : 'hover:text-zinc-600'
          )}
          onMouseEnter={() => setHoverRating(star)}
          onMouseLeave={() => setHoverRating(0)}
          onClick={() => setRating(star)}
        />
      ))}
    </div>
  );
};

function RatingDialog({
  visit,
  hostProfile,
  open,
  onOpenChange,
}: {
  visit: SerializableVisit | null;
  hostProfile: WithId<UserProfile> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [rating, setRating] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!visit || !hostProfile) {
      toast({ variant: 'destructive', title: 'Error', description: 'Missing user or visit data to submit rating.' })
      return;
    }
    if (rating === 0) {
      toast({
        variant: 'destructive',
        title: 'Rating Required',
        description: 'Please select at least one star.',
      });
      return;
    }
    setIsSubmitting(true);
    const result = await submitRatingAndRecalculate({
      visitId: visit.id,
      visitorId: visit.visitor_id,
      hostId: visit.host_id,
      premiseId: visit.premise_id,
      rating,
      actor: {
        id: hostProfile.id,
        name: hostProfile.name,
        role: 'host',
      },
    });

    if (result.success) {
      toast({
        title: 'Rating Submitted!',
        description: `You've rated ${visit.visitor_name}.`,
      });
      onOpenChange(false);
    } else {
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: result.error,
      });
    }
    setIsSubmitting(false);
  };

  React.useEffect(() => {
    if (open) {
      setRating(0);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#020617]/90 border-white/10 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <DialogHeader className="space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Star className="h-6 w-6 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
          </div>
          <div>
            <DialogTitle className="text-2xl font-headline font-bold text-white tracking-tight">Rate Your Visitor</DialogTitle>
            <DialogDescription className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1">
              Analyzing encounter with <span className="text-primary">{visit?.visitor_name}</span>
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="py-8 space-y-8">
          <div className="flex flex-col items-center gap-6">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Overall Experience</p>
            <StarRatingInput rating={rating} setRating={setRating} />
          </div>
        </div>
        <DialogFooter className="gap-3">
          <DialogClose asChild>
            <Button variant="ghost" className="text-zinc-500 hover:text-white hover:bg-white/5 border-white/5">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0} className="bg-primary text-white font-black uppercase tracking-widest text-[10px] h-12 px-8 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Lock Rating'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function HostHistoryPage() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const premiseId = searchParams.get('premiseId') ?? undefined;
  const { data: hostProfile, isLoading: isProfileLoading } = useUserProfile(user?.id);
  const { data: settings, isLoading: areSettingsLoading } = useSettings();
  const { toast } = useToast();

  const [visits, setVisits] = React.useState<SerializableVisit[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastVisible, setLastVisible] = React.useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = React.useState(true);

  const [searchTerm, setSearchTerm] = React.useState('');
  const [visitToRate, setVisitToRate] = React.useState<SerializableVisit | null>(null);
  const [visitToBlock, setVisitToBlock] = React.useState<SerializableVisit | null>(null);
  const [isBlocking, setIsBlocking] = React.useState(false);
  const [imageUrlToView, setImageUrlToView] = React.useState<string | null>(null);

  const [exportToConfirm, setExportToConfirm] = React.useState<'csv' | 'pdf' | null>(null);
  const [isExporting, setIsExporting] = React.useState<'csv' | 'pdf' | null>(null);
  const [startDate, setStartDate] = React.useState<string>(format(subDays(new Date(), 30), 'dd/MM/yyyy'));
  const [endDate, setEndDate] = React.useState<string>(format(new Date(), 'dd/MM/yyyy'));
  const [dateError, setDateError] = React.useState<string | null>(null);

  const exportCost = exportToConfirm === 'csv' ? settings?.csv_export_cost_host : settings?.pdf_export_cost_host;

  // Realtime Pulse: Refetch when the visits table changes natively
  const { data: realtimePulse } = useCollection({ table: 'visits', __memo: true });
  const pulseHash = realtimePulse ? realtimePulse.length : 0;

  // Effect for initial data fetch
  React.useEffect(() => {
    if (!user?.id || !premiseId || !settings) {
      if (!isProfileLoading && !areSettingsLoading) {
        setIsLoading(false);
        if (!premiseId) {
          setError("Premise ID not found in URL. Cannot load visits.");
        }
      }
      return;
    }

    const fetchInitialVisits = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const historyDays = settings?.history_days_host;
        const startDate = historyDays && historyDays > 0 ? subDays(new Date(), historyDays).toISOString() : undefined;
        const result = await getVisitsForHostInPremise({
          hostId: user.id,
          premiseId,
          limit: PAGE_SIZE,
          startDate: startDate
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
  }, [user?.id, premiseId, settings, isProfileLoading, areSettingsLoading, pulseHash]);

  const handleLoadMore = async () => {
    if (!user?.id || !premiseId || !settings || !hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const historyDays = settings.history_days_host;
      const startDate = historyDays && historyDays > 0 ? subDays(new Date(), historyDays).toISOString() : undefined;
      const result = await getVisitsForHostInPremise({
        hostId: user.id,
        premiseId,
        limit: PAGE_SIZE,
        startAfter: lastVisible,
        startDate: startDate,
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


  const visitIds = React.useMemo(() => visits?.map((v) => v.id) || [], [visits]);
  const { ratingsMap } = useRatingsForVisits(visitIds);

  const handleBlockConfirm = async () => {
    if (!visitToBlock || !hostProfile) return;

    setIsBlocking(true);
    const result = await blockVisitorFromHost({
      hostId: hostProfile.id,
      visitorId: visitToBlock.visitor_id,
      visitorName: visitToBlock.visitor_name,
      visitorPhotoUrl: visitToBlock.visitor_snapshot_url || '',
      actorName: hostProfile.name,
      actorRole: 'host',
      actorId: hostProfile.id,
    });

    if (result.success) {
      toast({
        title: 'Visitor Blocked',
        description: `${visitToBlock.visitor_name} has been blocked from visiting you.`
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Blocking Failed',
        description: result.error
      });
    }

    setIsBlocking(false);
    setVisitToBlock(null);
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

  const handleExecuteExport = async (exportType: 'csv' | 'pdf') => {
    if (!hostProfile) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not identify user.' });
      return;
    }
    setIsExporting(exportType);
    const result = await deductTokensForExport({
      target: { type: 'user', id: hostProfile.id },
      actorId: hostProfile.id,
      actorName: hostProfile.name,
      actorRole: 'host',
      exportType: exportType,
      premiseIdForLog: premiseId,
    });

    if (result.success) {
      toast({
        title: 'Tokens Deducted',
        description: `Cost for ${exportType.toUpperCase()} export has been deducted.`,
      });

      if (exportType === 'csv') {
        const dataToExport = filteredVisits.map((visit) => ({
          'Visitor Name': visit.visitor_name,
          'Check-in Time': format(new Date(visit.checkin_time), 'PPpp'),
          'Check-out Time': visit.checkout_time ? format(new Date(visit.checkout_time), 'PPpp') : 'N/A',
          Status: visit.status,
        }));
        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', `host_history_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else { // PDF
        const doc = new jsPDF();
        doc.text(`Your Visitor History`, 14, 16);
        doc.setFontSize(10);
        doc.text(`Report generated on: ${format(new Date(), 'PPpp')}`, 14, 22);

        autoTable(doc, {
          startY: 30,
          head: [['Visitor', 'Check-in', 'Check-out', 'Status']],
          body: filteredVisits.map((visit) => [
            visit.visitor_name,
            format(new Date(visit.checkin_time), 'Pp'),
            visit.checkout_time ? format(new Date(visit.checkout_time), 'Pp') : 'N/A',
            visit.status,
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [44, 62, 80] },
        });

        doc.save(`host_history_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      }
    } else {
      toast({ variant: 'destructive', title: 'Export Failed', description: result.error });
    }
    setIsExporting(null);
    setExportToConfirm(null);
  };

  const filteredVisits = React.useMemo(() => {
    if (!visits) return [];

    let dateFilteredVisits = visits;
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

      dateFilteredVisits = visits.filter((visit) => {
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
        v.status.toLowerCase().includes(lowerSearch)
    );
  }, [visits, searchTerm, startDate, endDate]);

  const renderContent = () => {
    if (isLoading || areSettingsLoading) {
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
          <h3 className="mt-4 text-lg font-semibold">Could Not Load Visits</h3>
          <p className="mt-2 text-sm max-w-md mx-auto">
            {error.includes("permission")
              ? "You do not have permission to view this data. Please contact your premise owner or an administrator if you believe this is an error."
              : error
            }
          </p>
        </div>
      )
    }

    if (!visits || visits.length === 0) {
      return (
        <div className="py-20 text-center text-muted-foreground">
          <h3 className="text-lg font-semibold">No visits yet</h3>
          <p>When a visitor checks in to see you at this premise, their visit will appear here.</p>
        </div>
      );
    }
    return (
      <div className="space-y-8">
        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-6 relative overflow-hidden">
          <div className="absolute inset-0 mesh-blue opacity-5 pointer-events-none" />
          <div className="relative z-10 flex flex-wrap items-end gap-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Range Start</Label>
                <div className="relative">
                  <Input id="start-date" type="text" placeholder="DD/MM/YYYY" value={startDate} onChange={(e) => handleDateInputChange(e.target.value, setStartDate)} className="w-[140px] bg-black/20 border-white/10 text-white h-11 font-mono text-xs pl-4" maxLength={10} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date" className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Terminal Date</Label>
                <div className="relative">
                  <Input id="end-date" type="text" placeholder="DD/MM/YYYY" value={endDate} onChange={(e) => handleDateInputChange(e.target.value, setEndDate)} className="w-[140px] bg-black/20 border-white/10 text-white h-11 font-mono text-xs pl-4" maxLength={10} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <Button variant="outline" onClick={() => setExportToConfirm('csv')} disabled={filteredVisits.length === 0 || isLoading || !!dateError || !!isExporting} className="h-11 bg-black/20 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest px-6">
                {isExporting === 'csv' ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" /> : <Download className="mr-2 h-4 w-4" />}
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => setExportToConfirm('pdf')} disabled={filteredVisits.length === 0 || isLoading || !!dateError || !!isExporting} className="h-11 bg-black/20 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest px-6">
                {isExporting === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" /> : <Download className="mr-2 h-4 w-4" />}
                Export PDF
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-700" />
            <Input
              placeholder="Filter by visitor identity or neural status..."
              className="pl-12 bg-black/40 border-white/5 text-white h-12 rounded-2xl placeholder:text-zinc-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {dateError && <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest mt-2 ml-1">{dateError}</p>}
        </div>

        <div className="rounded-3xl border border-white/5 bg-black/20 overflow-hidden shadow-2xl">
          <Table>
            <TableHeader className="bg-white/[0.03]">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6 pl-8 w-16">Snapshot</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Visitor Identity</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Neural Link UP</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Neural Link DOWN</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Protocol Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6 text-right pr-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVisits.map((visit) => {
                const isRated = ratingsMap.has(visit.id);
                const canRate = visit.status === 'completed' && !isRated;

                return (
                  <TableRow key={visit.id} className="border-white/5 hover:bg-white/[0.02] group/row transition-colors">
                    <TableCell className="pl-8 py-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setImageUrlToView(visit.visitor_snapshot_url || null)}
                        disabled={!visit.visitor_snapshot_url}
                        className="h-10 w-10 rounded-xl bg-white/5 border border-white/5 text-zinc-500 hover:text-white hover:bg-white/10 disabled:opacity-20"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-white tracking-tight group-hover/row:text-primary transition-colors">{visit.visitor_name}</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[11px] text-zinc-400">{format(new Date(visit.checkin_time), 'PPp')}</span>
                    </TableCell>
                    <TableCell>
                      {visit.checkout_time ? (
                        <span className="font-mono text-[11px] text-zinc-400">{format(new Date(visit.checkout_time), 'PPp')}</span>
                      ) : (
                        <Badge variant="outline" className="text-[8px] bg-sky-500/5 text-sky-400 border-sky-500/20 font-black uppercase tracking-widest">Active Link</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={visit.status === 'active' ? 'default' : 'secondary'} className={cn("text-[8px] font-black uppercase tracking-widest",
                        visit.status === 'active' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20")}>
                        {visit.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      {visit.status === 'completed' ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" title="Rate Visitor" disabled={!canRate} onClick={() => setVisitToRate(visit)} className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-500 hover:text-amber-500 hover:bg-amber-500/10 disabled:opacity-20 transition-all">
                            <Star className={cn("h-4 w-4", !canRate && "fill-zinc-800")} />
                          </Button>
                          <Button variant="ghost" size="icon" title="Block Visitor" onClick={() => setVisitToBlock(visit)} className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all">
                            <UserX className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : isRated ? (
                        <div className="flex items-center justify-end gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                          <CheckCircle2 className="h-3.3 w-3.5" />
                          <span>Rated</span>
                        </div>
                      ) : (
                        <div className="h-9 w-9 ml-auto rounded-lg bg-zinc-900/50 border border-white/5 flex items-center justify-center">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="mt-8 flex justify-center pb-12">
          {hasMore && (
            <Button onClick={handleLoadMore} variant="outline" disabled={isLoadingMore} className="h-12 px-10 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 font-black uppercase tracking-widest text-[10px] transition-all">
              {isLoadingMore ? <Loader2 className="mr-3 h-4 w-4 animate-spin text-primary" /> : "Sync More Artifacts"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const visibleDays = settings?.history_days_host;
  const exportableDays = settings?.export_history_days_host;
  const description = `A paginated log of your recent visitors, showing the last ${visibleDays ?? '...'} days. You can export up to ${exportableDays ?? '...'} days of your history. You can rate or block visitors after their visit is complete.`;

  return (
    <>
      <div className="container py-10 max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <Button asChild variant="ghost" className="text-zinc-500 hover:text-primary hover:bg-white/5 group/back">
            <Link href={`/dashboard/host?premiseId=${premiseId}`} className="flex items-center">
              <ArrowLeft className="mr-3 h-4 w-4 group-hover/back:-translate-x-1 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest">Back to Console</span>
            </Link>
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Host Intel Pulse Active</span>
          </div>
        </div>

        <Card className="glass-card border-white/5 shadow-2xl relative overflow-hidden mb-20">
          <div className="absolute inset-0 mesh-blue opacity-5 pointer-events-none" />
          <CardHeader className="relative z-10 border-b border-white/5 pb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-4xl font-headline font-bold text-white tracking-tight">Intelligence <span className="text-primary/80">Archival</span></CardTitle>
            </div>
            <CardDescription className="text-zinc-500 text-[11px] font-medium uppercase tracking-widest max-w-2xl leading-relaxed">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 pt-8">{renderContent()}</CardContent>
        </Card>
      </div>

      <RatingDialog
        visit={visitToRate}
        hostProfile={hostProfile}
        open={!!visitToRate && !!hostProfile}
        onOpenChange={(open) => {
          if (!open) {
            setVisitToRate(null);
          }
        }}
      />

      <AlertDialog open={!!visitToBlock} onOpenChange={(open) => !open && setVisitToBlock(null)}>
        <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight">Impose Protocol Restriction?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
              You are about to block <span className="text-red-500 font-bold underline decoration-red-500/30 underline-offset-4">{visitToBlock?.visitor_name}</span>.
              Future check-in requests for your node from this identity will be automatically terminated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 pt-6">
            <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-500 hover:text-white hover:bg-white/5">Abort</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlockConfirm} disabled={isBlocking} className="bg-red-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              {isBlocking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Commence Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!imageUrlToView} onOpenChange={(open) => !open && setImageUrlToView(null)}>
        <DialogContent className="max-w-xl bg-black/95 border-white/10 backdrop-blur-3xl p-0 overflow-hidden">
          <div className="absolute top-4 left-4 z-20">
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[8px] font-black uppercase tracking-widest px-3 py-1">Identity Snapshot</Badge>
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
              <Button className="bg-white/5 text-zinc-400 hover:text-white h-9 text-[10px] font-bold uppercase tracking-widest px-6">Close Trace</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!exportToConfirm} onOpenChange={(open) => !open && setExportToConfirm(null)}>
        <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight">Confirm Data Extraction</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
              Extraction protocol requires a neural contribution of <span className="text-primary font-black">{exportCost ?? '...'} units</span> from your personal balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 pt-6">
            <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-500 hover:text-white hover:bg-white/5">Abort</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleExecuteExport(exportToConfirm!)} disabled={isExporting !== null} className="bg-primary text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:bg-primary/90 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Authorize Deduction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


