'use client';

import * as React from 'react';
import {
  ArrowLeft,
  Loader2,
  Search,
  Building,
  User as UserIcon,
  Download,
  History,
  AlertTriangle,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUser, useCollection } from '@/supabase';
import { useUserProfile } from '@/services/user-service';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/services/settings-service';
import { createClient } from '@/lib/supabase/client';
import { Premise } from '@/services/premise-service';
import { getVisitsForVisitorAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { deductTokensForExport, getVisitsForExport } from '../../owner/history/actions';
// Dynamic imports for papaparse and jspdf moved to handleExecuteExport
import { Label } from '@/components/ui/label';

type SerializableVisit = NonNullable<Awaited<ReturnType<typeof getVisitsForVisitorAction>>['visits']>[0];
const PAGE_SIZE = 10;

export default function VisitorHistoryPage() {
  const { user } = useUser();
  const { data: userProfile } = useUserProfile(user?.id);
  const { data: settings, isLoading: isLoadingSettings } = useSettings();
  const [premises, setPremises] = React.useState<Premise[] | null>(null);
  const [isLoadingPremises, setIsLoadingPremises] = React.useState(true);
  const { toast } = useToast();

  const [visits, setVisits] = React.useState<SerializableVisit[]>([]);
  const [isLoadingVisits, setIsLoadingVisits] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [lastVisible, setLastVisible] = React.useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');

  const [exportToConfirm, setExportToConfirm] = React.useState<'csv' | 'pdf' | null>(null);
  const [isExporting, setIsExporting] = React.useState<'csv' | 'pdf' | null>(null);
  const [startDate, setStartDate] = React.useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = React.useState<Date>(new Date());

  const exportCost = exportToConfirm === 'csv' ? settings?.csv_export_cost_visitor : settings?.pdf_export_cost_visitor;

  const { data: realtimePulse } = useCollection({
    table: 'visits',
    filters: user?.id ? [{ column: 'visitor_id', operator: 'eq', value: user.id }] : undefined,
    __memo: true
  });
  const pulseHash = realtimePulse ? realtimePulse.length : 0;

  React.useEffect(() => {
    setIsLoadingPremises(true);
    const fetchPremises = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.from('premises').select('*');
        if (error) throw error;
        setPremises(data);
      } catch (err) {
        console.error('Failed to fetch premises', err);
      } finally {
        setIsLoadingPremises(false);
      }
    };
    fetchPremises();
  }, []);

  React.useEffect(() => {
    if (!user?.id || !settings) {
      if (!isLoadingSettings) setIsLoadingVisits(false);
      return;
    }

    const fetchInitialVisits = async () => {
      setIsLoadingVisits(true);
      setError(null);
      try {
        const historyDays = settings?.history_days_visitor;
        const startDateString = historyDays && historyDays > 0 ? subDays(new Date(), historyDays).toISOString() : undefined;
        const result = await getVisitsForVisitorAction({ visitorId: user.id, limit: PAGE_SIZE, startDate: startDateString });

        if (result.success && result.visits) {
          setVisits(result.visits);
          setLastVisible(result.lastVisible);
          setHasMore(result.visits.length === PAGE_SIZE);
        } else {
          throw new Error(result.error || 'Failed to load visits.');
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load visits.');
      } finally {
        setIsLoadingVisits(false);
      }
    };

    fetchInitialVisits();
  }, [user?.id, settings, isLoadingSettings, pulseHash]);

  const handleLoadMore = async () => {
    if (!user?.id || !hasMore || isLoadingMore || !settings) return;

    setIsLoadingMore(true);
    try {
      const historyDays = settings.history_days_visitor;
      const startDateString = historyDays && historyDays > 0 ? subDays(new Date(), historyDays).toISOString() : undefined;
      const result = await getVisitsForVisitorAction({ visitorId: user.id, limit: PAGE_SIZE, startAfter: lastVisible, startDate: startDateString });

      if (result.success && result.visits) {
        setVisits((prev) => [...prev, ...result.visits!]);
        setLastVisible(result.lastVisible);
        setHasMore(result.visits.length === PAGE_SIZE);
      } else {
        throw new Error(result.error || 'Failed to load more visits.');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load more visits.');
    } finally {
      setIsLoadingMore(false);
    }
  };



  const handleExecuteExport = async (exportType: 'csv' | 'pdf') => {
    if (!userProfile) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not identify user.' });
      return;
    }
    setIsExporting(exportType);
    const result = await deductTokensForExport({
      target: { type: 'user', id: userProfile.id },
      actorId: userProfile.id,
      actorName: userProfile.name,
      actorRole: 'visitor',
      exportType: exportType,
    });

    if (result.success) {
      toast({ title: 'Tokens Deducted', description: `Cost for ${exportType.toUpperCase()} export has been deducted. Fetching extended data...` });

      const exportableDays = settings?.export_history_days_visitor || 30;
      const exportStartDate = subDays(new Date(), exportableDays).toISOString();

      const exportDataResult = await getVisitsForExport({ visitorId: userProfile.id, startDate: exportStartDate });

      if (!exportDataResult.success || !exportDataResult.visits) {
        toast({ variant: 'destructive', title: 'Export Failed', description: exportDataResult.error || 'Failed to fetch historical data.' });
        setIsExporting(null);
        setExportToConfirm(null);
        return;
      }

      const totalExportVisits = exportDataResult.visits;

      if (exportType === 'csv') {
        const Papa = (await import('papaparse')).default;
        const dataToExport = totalExportVisits.map((visit: SerializableVisit) => ({
          'Location': premiseMap.get(visit.premise_id) || 'Unknown Location',
          'Host Name': visit.host_name || 'Autonomous',
          'Check-in Time': format(new Date(visit.checkin_time), 'PPpp'),
          'Check-out Time': visit.checkout_time ? format(new Date(visit.checkout_time), 'PPpp') : 'N/A',
          Status: visit.status,
        }));
        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', `my_visit_history_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else { // PDF
        const { jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');

        const doc = new jsPDF();
        doc.text(`Your Visit History`, 14, 16);
        doc.setFontSize(10);
        doc.text(`Report generated on: ${format(new Date(), 'PPpp')}`, 14, 22);

        autoTable(doc, {
          startY: 30,
          head: [['Location', 'Host', 'Check-in', 'Check-out', 'Status']],
          body: totalExportVisits.map((visit: SerializableVisit) => [
            premiseMap.get(visit.premise_id) || 'Unknown',
            visit.host_name || 'Autonomous',
            format(new Date(visit.checkin_time), 'Pp'),
            visit.checkout_time ? format(new Date(visit.checkout_time), 'Pp') : 'N/A',
            visit.status,
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [44, 62, 80] },
        });

        doc.save(`my_visit_history_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      }
    } else {
      toast({ variant: 'destructive', title: 'Export Failed', description: result.error });
    }
    setIsExporting(null);
    setExportToConfirm(null);
  };

  const isLoading = isLoadingVisits || isLoadingPremises || isLoadingSettings;

  const premiseMap = React.useMemo(() => {
    if (!premises) return new Map<string, string>();
    return new Map(premises.map((p) => [p.id, p.name]));
  }, [premises]);

  const filteredVisits = React.useMemo(() => {
    if (!visits) return [];
    let dateFilteredVisits = visits;

    const fromDate = new Date(startDate);
    const toDate = new Date(endDate);

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    dateFilteredVisits = visits.filter((visit) => {
      const visitDate = new Date(visit.checkin_time);
      return visitDate >= fromDate && visitDate <= toDate;
    });

    const lowerSearch = searchTerm.toLowerCase();
    if (!lowerSearch) return dateFilteredVisits;

    return dateFilteredVisits.filter(
      (v) =>
        (premiseMap.get(v.premise_id) || '').toLowerCase().includes(lowerSearch) ||
        (v.host_name || '').toLowerCase().includes(lowerSearch) ||
        v.status.toLowerCase().includes(lowerSearch)
    );
  }, [visits, searchTerm, premiseMap, startDate, endDate]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col h-64 items-center justify-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Retrieving Records...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col h-64 items-center justify-center space-y-4 px-8 text-center">
          <AlertTriangle className="h-10 w-10 text-red-500/50" />
          <p className="text-zinc-400 text-sm max-w-xs">{error}</p>
        </div>
      );
    }

    if (!visits || visits.length === 0) {
      return (
        <div className="py-24 text-center bg-[#010a05]/95 backdrop-blur-3xl/[0.01]">
          <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
            <History className="h-8 w-8 text-zinc-400" />
          </div>
          <p className="mb-2 font-bold text-white uppercase tracking-widest text-sm">No History Found</p>
          <p className="text-xs text-zinc-400 max-w-[200px] mx-auto leading-relaxed">
            You haven&apos;t visited any locations yet.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <Table>
          <TableHeader className="bg-[#010a05]/95 backdrop-blur-3xl/[0.03]">
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6 pl-8">Location</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Host</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Check-in</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Check-out</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVisits.map((visit) => (
              <TableRow key={visit.id} className="border-white/5 hover:bg-white/[0.02] backdrop-blur-3xl/[0.02] group/row transition-colors">
                <TableCell className="pl-8 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/5 group-hover/row:bg-primary/10 group-hover/row:border-primary/20 transition-all">
                      <Building className="h-3 w-3 text-zinc-400 group-hover/row:text-primary transition-colors" />
                    </div>
                    <span className="font-bold text-white group-hover/row:text-primary transition-colors">{premiseMap.get(visit.premise_id) || 'Unknown Location'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-3 w-3 text-zinc-400" />
                    <span className="text-zinc-300 font-medium">{visit.host_name || 'Autonomous'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-[11px] text-zinc-400">{visit.checkin_time ? format(new Date(visit.checkin_time), 'PPp') : 'N/A'}</span>
                </TableCell>
                <TableCell>
                  {visit.checkout_time ? (
                    <span className="font-mono text-[11px] text-zinc-400">{format(new Date(visit.checkout_time), 'PPp')}</span>
                  ) : (
                    <Badge variant="outline" className="text-[8px] bg-sky-500/5 text-sky-400 border-sky-500/20 font-black uppercase tracking-widest">Active Link</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-[8px] font-black uppercase tracking-widest",
                    visit.status === 'active' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20")}>
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
              {isLoadingMore ? <Loader2 className="mr-3 h-4 w-4 animate-spin text-primary" /> : "Load More Records"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const visibleDays = settings?.history_days_visitor;
  const description = `Audit log of your recent visits across the ecosystem from the last ${visibleDays ?? '...'} days.`;

  return (
    <div className="container py-10 max-w-7xl">
      <div className="mb-8 flex items-center justify-between">
        <Button asChild variant="ghost" className="text-zinc-400 hover:text-primary hover:bg-white/5 group/back">
          <Link href="/dashboard/visitor" className="flex items-center">
            <ArrowLeft className="mr-3 h-4 w-4 group-hover/back:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Back to Dashboard</span>
          </Link>
        </Button>
      </div>

      <Card className="glass-card border-white/5 shadow-2xl overflow-hidden relative mb-20">
        <div className="absolute inset-0 mesh-blue opacity-5 pointer-events-none" />
        <CardHeader className="relative z-10 border-b border-white/5 pb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <History className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-4xl font-headline font-bold text-white tracking-tight">Visit <span className="text-primary/80">History</span></CardTitle>
          </div>
          <CardDescription className="text-zinc-400 text-[11px] font-medium uppercase tracking-widest max-w-xl leading-relaxed mt-2">{description}</CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 pt-8">
          <div className="space-y-8">
            <div className="p-6 bg-[#010a05]/95 backdrop-blur-3xl/[0.02] border border-white/5 rounded-3xl space-y-6 relative overflow-hidden">
              <div className="absolute inset-0 mesh-obsidian opacity-5 pointer-events-none" />
              <div className="relative z-10 flex flex-wrap items-end gap-6">
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                />

                <div className="flex items-center gap-3 ml-auto">
                  <Button variant="outline" onClick={() => setExportToConfirm('csv')} disabled={filteredVisits.length === 0 || isLoading || !!isExporting} className="h-11 bg-black/20 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest px-6 transition-all">
                    {isExporting === 'csv' ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" /> : <Download className="mr-2 h-4 w-4" />}
                    Export CSV
                  </Button>
                  <Button variant="outline" onClick={() => setExportToConfirm('pdf')} disabled={filteredVisits.length === 0 || isLoading || !!isExporting} className="h-11 bg-black/20 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest px-6 transition-all">
                    {isExporting === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" /> : <Download className="mr-2 h-4 w-4" />}
                    Export PDF
                  </Button>
                </div>
              </div>

              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 transition-colors group-focus-within:text-primary" />
                <Input
                  placeholder="Search by location, host or status..."
                  className="pl-12 bg-black/40 border-white/5 text-white h-12 rounded-2xl placeholder:text-zinc-300 focus:border-primary/30 transition-all focus:ring-primary/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

            </div>

            <div className="rounded-3xl border border-white/5 bg-black/20 overflow-hidden shadow-2xl">
              {renderContent()}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!exportToConfirm} onOpenChange={(open) => !open && setExportToConfirm(null)}>
        <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight">Download Report</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
              Downloading this report costs <span className="text-primary font-black">{exportCost ?? '...'} tokens</span> from your personal balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 pt-6">
            <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-400 hover:text-white hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleExecuteExport(exportToConfirm!)} disabled={isExporting !== null} className="bg-primary text-[#010a05] font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:bg-primary/90 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Download
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
