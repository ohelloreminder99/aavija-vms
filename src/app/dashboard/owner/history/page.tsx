'use client';

import * as React from 'react';
import {
  ArrowLeft,
  Loader2,
  Search,
  UserX,
  Download,
  Star,
  Eye,
  History as HistoryIcon,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUser, useDoc, useCollection } from '@/supabase';
import { useUserProfile } from '@/services/user-service';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, subDays, parse } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/services/settings-service';
import { cn } from '@/lib/utils';
import { blockVisitorFromPremise } from '@/services/block-service';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { deductTokensForExport, getVisitsForExport } from './actions';
import { useSearchParams } from 'next/navigation';
import { Premise } from '@/services/premise-service';
import { PremiseCategory } from '@/services/premise-category-service';
import { getVisitsForPremise } from '../../admin/premises/actions';
import { forceCheckoutVisitor } from '../../gatekeeper/actions';
import Image from 'next/image';
import { createLogEntry } from '@/services/log-service';
import { LogAction } from '@/services/log-actions';

type SerializableVisit = NonNullable<Awaited<ReturnType<typeof getVisitsForPremise>>['visits']>[0];
const PAGE_SIZE = 10;

export default function HistoryPage() {
  const { user } = useUser();
  const { data: userProfile } = useUserProfile(user?.id);
  const searchParams = useSearchParams();
  const premiseId = searchParams.get('premiseId');

  const { data: settings, isLoading: isLoadingSettings } = useSettings();
  const { toast } = useToast();

  const premiseDocRef = React.useMemo(() => {
    if (!premiseId) return null;
    return { table: 'premises', id: premiseId, __memo: true };
  }, [premiseId]);
  const { data: premise, isLoading: isLoadingPremise } = useDoc<Premise>(premiseDocRef);

  const categoryDocRef = React.useMemo(() => {
    if (!premise?.categoryId) return null;
    return { table: 'premise_categories', id: premise.categoryId, __memo: true };
  }, [premise?.categoryId]);
  const { data: category, isLoading: isLoadingCategory } = useDoc<PremiseCategory>(categoryDocRef);

  const [visits, setVisits] = React.useState<SerializableVisit[]>([]);
  const [isLoadingVisits, setIsLoadingVisits] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [lastVisible, setLastVisible] = React.useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [searchTerm, setSearchTerm] = React.useState('');
  const [visitorFilter, setVisitorFilter] = React.useState('all');
  const [hostFilter, setHostFilter] = React.useState('all');

  const [visitToBlock, setVisitToBlock] = React.useState<SerializableVisit | null>(null);
  const [visitToForceCheckout, setVisitToForceCheckout] = React.useState<SerializableVisit | null>(null);
  const [exportToConfirm, setExportToConfirm] = React.useState<'csv' | 'pdf' | null>(null);
  const [isBlocking, setIsBlocking] = React.useState(false);
  const [isCheckingOut, setIsCheckingOut] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState<'csv' | 'pdf' | null>(null);
  const [imageUrlToView, setImageUrlToView] = React.useState<string | null>(null);

  const [startDate, setStartDate] = React.useState<string>(format(subDays(new Date(), 30), 'dd/MM/yyyy'));
  const [endDate, setEndDate] = React.useState<string>(format(new Date(), 'dd/MM/yyyy'));
  const [dateError, setDateError] = React.useState<string | null>(null);

  const isLoading = isLoadingVisits || isLoadingSettings || isLoadingPremise || isLoadingCategory;

  // Realtime Pulse: Dynamically refetch owner log whenever check-ins arrive
  const { data: realtimePulse } = useCollection({ table: 'visits', __memo: true });
  const pulseHash = realtimePulse ? realtimePulse.length : 0;

  // Effect for the initial data fetch
  React.useEffect(() => {
    if (!premiseId || !settings) {
      if (!isLoadingSettings) {
        setIsLoadingVisits(false);
      }
      return;
    };

    const fetchInitialData = async () => {
      setIsLoadingVisits(true);
      setError(null);

      try {
        const historyDays = settings?.history_days_owner;
        const computedStartDate = historyDays && historyDays > 0 ? subDays(new Date(), historyDays).toISOString() : undefined;

        const result = await getVisitsForPremise({
          premiseId,
          limit: PAGE_SIZE,
          startDate: computedStartDate,
        });

        if (result.success && result.visits) {
          setVisits(result.visits);
          setLastVisible(result.lastVisible);
          setHasMore(result.visits.length === PAGE_SIZE);
          if (userProfile && premiseId) {
            createLogEntry({
              actorId: userProfile.id,
              actorName: userProfile.name,
              actorRole: 'owner',
              action: LogAction.VIEW_PREMISE_HISTORY_OWNER,
              description: `Owner "${userProfile.name}" viewed visit history for premise ID ${premiseId}.`,
              context: { premiseId }
            });
          }
        } else {
          throw new Error(result.error || 'Failed to load visits.');
        }
      } catch (e: any) {
        setError(e.message);
        toast({ variant: 'destructive', title: 'Error', description: e.message });
      } finally {
        setIsLoadingVisits(false);
      }
    };

    fetchInitialData();
  }, [premiseId, settings, isLoadingSettings, toast, userProfile, pulseHash]);

  const handleLoadMore = async () => {
    if (!premiseId || !hasMore || isLoadingMore || !settings) return;

    setIsLoadingMore(true);
    try {
      const historyDays = settings.history_days_owner;
      const computedStartDate = historyDays && historyDays > 0 ? subDays(new Date(), historyDays).toISOString() : undefined;

      const result = await getVisitsForPremise({
        premiseId,
        limit: PAGE_SIZE,
        startAfter: lastVisible,
        startDate: computedStartDate,
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
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsLoadingMore(false);
    }
  };

  const exportCost = exportToConfirm === 'csv' ? category?.csv_export_cost : category?.pdf_export_cost;

  const uniqueVisitors = React.useMemo(() => {
    if (!visits) return [];
    const visitorMap = new Map<string, { id: string, name: string }>();
    visits.forEach(visit => {
      if (!visitorMap.has(visit.visitor_id)) {
        visitorMap.set(visit.visitor_id, { id: visit.visitor_id, name: visit.visitor_name });
      }
    });
    return Array.from(visitorMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [visits]);

  const uniqueHosts = React.useMemo(() => {
    if (!visits) return [];
    const hostMap = new Map<string, { id: string, name: string }>();
    visits.forEach(visit => {
      if (visit.host_id && visit.host_name && !hostMap.has(visit.host_id)) {
        hostMap.set(visit.host_id, { id: visit.host_id, name: visit.host_name });
      }
    });
    return Array.from(hostMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [visits]);

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

  const handleBlockConfirm = async () => {
    if (!visitToBlock || !userProfile || !premiseId) return;

    setIsBlocking(true);
    const result = await blockVisitorFromPremise({
      premiseId,
      visitorId: visitToBlock.visitor_id,
      visitorName: visitToBlock.visitor_name,
      visitorPhotoUrl: visitToBlock.visitor_snapshot_url || '',
      actorName: userProfile.name,
      actorRole: 'owner',
      actorId: userProfile.id,
    });

    if (result.success) {
      toast({
        title: 'Visitor Blocked',
        description: `${visitToBlock.visitor_name} has been blocked from this premise.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Blocking Failed',
        description: result.error,
      });
    }

    setIsBlocking(false);
    setVisitToBlock(null);
  };

  const handleForceCheckoutConfirm = async () => {
    if (!visitToForceCheckout || !userProfile || !premiseId) return;

    setIsCheckingOut(true);
    const result = await forceCheckoutVisitor({
      visitId: visitToForceCheckout.id,
      premiseId: premiseId,
      visitorId: visitToForceCheckout.visitor_id,
      actor: { id: userProfile.id, name: userProfile.name, role: 'owner' }
    });

    if (result.success) {
      toast({ title: 'Success', description: `${visitToForceCheckout.visitor_name} has been forcefully checked out.` });
      // Refresh local visits
      setVisits(prev => prev.map(v => v.id === visitToForceCheckout.id ? { ...v, status: 'completed', checkout_time: new Date().toISOString() } : v));
    } else {
      toast({ variant: 'destructive', title: 'Checkout Failed', description: result.error });
    }

    setIsCheckingOut(false);
    setVisitToForceCheckout(null);
  }

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

    let dropdownFilteredVisits = dateFilteredVisits;
    if (visitorFilter !== 'all') {
      dropdownFilteredVisits = dropdownFilteredVisits.filter(v => v.visitor_id === visitorFilter);
    }
    if (hostFilter !== 'all') {
      dropdownFilteredVisits = dropdownFilteredVisits.filter(v => v.host_id === hostFilter);
    }

    const lowerSearch = searchTerm.toLowerCase();
    if (!lowerSearch) return dropdownFilteredVisits;

    return dropdownFilteredVisits.filter(
      (v) =>
        v.visitor_name.toLowerCase().includes(lowerSearch) ||
        (v.host_name || '').toLowerCase().includes(lowerSearch) ||
        v.status.toLowerCase().includes(lowerSearch)
    );
  }, [visits, searchTerm, startDate, endDate, visitorFilter, hostFilter]);

  const handleExecuteExport = async (exportType: 'csv' | 'pdf') => {
    if (!userProfile || !premiseId || !category) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not identify user, premise, or category.' });
      return;
    }

    setIsExporting(exportType);
    const result = await deductTokensForExport({
      target: { type: 'premise', id: premiseId },
      actorId: userProfile.id,
      actorName: userProfile.name,
      actorRole: 'owner',
      exportType: exportType,
    });

    if (result.success) {
      toast({
        title: 'Tokens Deducted',
        description: `Cost for ${exportType.toUpperCase()} export has been deducted. Fetching full data...`,
      });

      const exportableDays = settings?.export_history_days_owner || 30;
      const exportStartDate = subDays(new Date(), exportableDays).toISOString();

      const exportDataResult = await getVisitsForExport({
        premiseId: premiseId,
        startDate: exportStartDate,
      });

      if (!exportDataResult.success || !exportDataResult.visits) {
        toast({ variant: 'destructive', title: 'Export Failed', description: exportDataResult.error || 'Failed to fetch historical data.' });
        setIsExporting(null);
        setExportToConfirm(null);
        return;
      }

      const totalExportVisits = exportDataResult.visits;

      if (exportType === 'csv') {
        const dataToExport = totalExportVisits.map((visit) => ({
          'Visitor Name': visit.visitor_name,
          'Host Name': visit.host_name || 'Autonomous',
          'Check-in Time': format(new Date(visit.checkin_time), 'PPpp'),
          'Check-out Time': visit.checkout_time ? format(new Date(visit.checkout_time), 'PPpp') : 'N/A',
          Status: visit.status,
          'Vehicle Plate': visit.vehicle_details?.plate || 'N/A',
        }));
        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', `premise_history_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else { // PDF
        const doc = new jsPDF();
        doc.text(`Visit History for ${premise?.name}`, 14, 16);
        doc.setFontSize(10);
        doc.text(`Report generated on: ${format(new Date(), 'PPpp')}`, 14, 22);

        autoTable(doc, {
          startY: 30,
          head: [['Visitor', 'Host', 'Check-in', 'Check-out', 'Status', 'Vehicle']],
          body: totalExportVisits.map((visit) => [
            visit.visitor_name,
            visit.host_name || 'Autonomous',
            format(new Date(visit.checkin_time), 'Pp'),
            visit.checkout_time ? format(new Date(visit.checkout_time), 'Pp') : 'N/A',
            visit.status,
            visit.vehicle_details ? `${visit.vehicle_details.plate} (${visit.vehicle_details.model})` : 'N/A',
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [44, 62, 80] },
        });

        doc.save(`premise_history_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      }
    } else {
      toast({ variant: 'destructive', title: 'Export Failed', description: result.error });
    }
    setIsExporting(null);
    setExportToConfirm(null);
  };

  const renderContent = () => {
    if (isLoadingVisits || isLoadingSettings) {
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
            <HistoryIcon className="h-8 w-8 text-zinc-700" />
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
        <div className="rounded-3xl border border-white/5 bg-black/20 overflow-hidden shadow-2xl">
          <Table>
            <TableHeader className="bg-white/[0.03]">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6 pl-8 w-16">Photo</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Visitor Name</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Host</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Check-in</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Check-out</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6 text-right pr-8">Actions</TableHead>
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
                    <div className="text-[11px] font-medium text-zinc-400">{visit.host_name || 'Autonomous'}</div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[11px] text-zinc-500">{visit.checkin_time ? format(new Date(visit.checkin_time), 'PPp') : 'N/A'}</span>
                  </TableCell>
                  <TableCell>
                    {visit.checkout_time ? (
                      <span className="font-mono text-[11px] text-zinc-500">{format(new Date(visit.checkout_time), 'PPp')}</span>
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
                    <div className="flex justify-end gap-2">
                      {visit.status === 'active' ? (
                        <Button variant="outline" size="sm" onClick={() => setVisitToForceCheckout(visit)} className="h-8 bg-amber-500/5 border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white text-[9px] font-black uppercase tracking-widest px-4 rounded-lg transition-all">
                          Force Out
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" title="Block Visitor" onClick={() => setVisitToBlock(visit)} className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all">
                          <UserX className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

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

  const visibleDays = settings?.history_days_owner;
  const exportableDays = settings?.export_history_days_owner;
  const description = `A list of recent visits in the last ${visibleDays ?? '...'} days. You can download up to ${exportableDays ?? '...'} days of history as CSV or PDF.`;

  return (
    <>
      <div className="container py-10 max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <Button asChild variant="ghost" className="text-zinc-500 hover:text-primary hover:bg-white/5 group/back">
            <Link href={`/dashboard/owner?premiseId=${premiseId}`} className="flex items-center">
              <ArrowLeft className="mr-3 h-4 w-4 group-hover/back:-translate-x-1 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest">Back to Dashboard</span>
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Live Sync</span>
          </div>
        </div>

        <Card className="glass-card border-white/5 shadow-2xl relative overflow-hidden mb-20">
          <div className="absolute inset-0 mesh-blue opacity-5 pointer-events-none" />
          <CardHeader className="relative z-10 border-b border-white/5 pb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <HistoryIcon className="h-5 w-5 text-primary" />
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
                      <Input id="start-date" type="text" placeholder="DD/MM/YYYY" value={startDate} onChange={(e) => handleDateInputChange(e.target.value, setStartDate)} className="w-[140px] bg-black/20 border-white/10 text-white h-11 font-mono text-xs" maxLength={10} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date" className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">End Date</Label>
                      <Input id="end-date" type="text" placeholder="DD/MM/YYYY" value={endDate} onChange={(e) => handleDateInputChange(e.target.value, setEndDate)} className="w-[140px] bg-black/20 border-white/10 text-white h-11 font-mono text-xs" maxLength={10} />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-auto">
                    <Button variant="outline" onClick={() => setExportToConfirm('csv')} disabled={filteredVisits.length === 0 || isLoading || !!dateError || !!isExporting} className="h-11 bg-black/20 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest px-6 transition-all">
                      {isExporting === 'csv' ? <Loader2 className="mr-2 (h-4 w-4 animate-spin text-primary" /> : <Download className="mr-2 h-4 w-4" />}
                      Export CSV
                    </Button>
                    <Button variant="outline" onClick={() => setExportToConfirm('pdf')} disabled={filteredVisits.length === 0 || isLoading || !!dateError || !!isExporting} className="h-11 bg-black/20 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest px-6 transition-all">
                      {isExporting === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" /> : <Download className="mr-2 h-4 w-4" />}
                      Export PDF
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                  <div className="md:col-span-2 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-700" />
                    <Input
                      placeholder="Search visitor, host or status..."
                      className="pl-12 bg-black/40 border-white/5 text-white h-12 rounded-2xl placeholder:text-zinc-800 focus:border-primary/30"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={visitorFilter} onValueChange={setVisitorFilter}>
                    <SelectTrigger className="h-12 bg-black/40 border-white/5 text-zinc-300 rounded-2xl font-bold uppercase tracking-widest text-[10px]">
                      <SelectValue placeholder="All Visitors" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#020617] border-white/10">
                      <SelectItem value="all" className="text-zinc-400 uppercase tracking-widest font-black text-[9px]">All Visitors</SelectItem>
                      {uniqueVisitors.map((v) => (
                        <SelectItem key={v.id} value={v.id} className="text-white">{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={hostFilter} onValueChange={setHostFilter}>
                    <SelectTrigger className="h-12 bg-black/40 border-white/5 text-zinc-300 rounded-2xl font-bold uppercase tracking-widest text-[10px]">
                      <SelectValue placeholder="All Hosts" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#020617] border-white/10">
                      <SelectItem value="all" className="text-zinc-400 uppercase tracking-widest font-black text-[9px]">All Hosts</SelectItem>
                      {uniqueHosts.map((h) => (
                        <SelectItem key={h.id} value={h.id} className="text-white">{h.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {dateError && <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest mt-2 ml-1">{dateError}</p>}
              </div>

              {renderContent()}
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
              <Image src={imageUrlToView} alt="Visitor" fill className="object-contain" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-t from-black opacity-40" />
            </div>
          )}
          <div className="p-4 bg-[#020617] border-t border-white/5 flex justify-end">
            <DialogClose asChild>
              <Button className="bg-white/5 text-zinc-400 hover:text-white h-9 text-[10px] font-bold uppercase tracking-widest px-6 rounded-lg">Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!exportToConfirm} onOpenChange={(open) => !open && setExportToConfirm(null)}>
        <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight">Download Report</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
              Downloading this report costs <span className="text-primary font-black">{exportCost ?? '...'} tokens</span> from the premise balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 pt-6">
            <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-500 hover:text-white hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleExecuteExport(exportToConfirm!)} disabled={isExporting !== null} className="bg-primary text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:bg-primary/90 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Download
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!visitToBlock} onOpenChange={(open) => !open && setVisitToBlock(null)}>
        <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight">Block Visitor?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
              This will permanently block <span className="text-red-500 font-bold underline decoration-red-500/30 underline-offset-4">{visitToBlock?.visitor_name}</span> from entering this premise.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 pt-6">
            <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-500 hover:text-white hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlockConfirm} disabled={isBlocking} className="bg-red-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              {isBlocking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!visitToForceCheckout} onOpenChange={(open) => !open && setVisitToForceCheckout(null)}>
        <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight">Force Checkout?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
              Use this if <span className="text-amber-500 font-bold">{visitToForceCheckout?.visitor_name}</span> has already left but is still showing as active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 pt-6">
            <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-500 hover:text-white hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceCheckoutConfirm} disabled={isCheckingOut} className="bg-amber-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:bg-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              {isCheckingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Force Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
