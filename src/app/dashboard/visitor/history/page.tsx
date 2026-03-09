'use client';

import * as React from 'react';
import {
  ArrowLeft,
  Loader2,
  Search,
  Building,
  User as UserIcon,
  Download,
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
import { useUser, WithId, useCollection } from '@/supabase';
import { useUserProfile } from '@/services/user-service';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { format, subDays, parse } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/services/settings-service';
import { createClient } from '@/lib/supabase/client';
import { Premise } from '@/services/premise-service';
import { getVisitsForVisitorAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { deductTokensForExport, getVisitsForExport } from '../../owner/history/actions';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Label } from '@/components/ui/label';

type SerializableVisit = NonNullable<Awaited<ReturnType<typeof getVisitsForVisitorAction>>['visits']>[0];
const PAGE_SIZE = 10;

export default function VisitorHistoryPage() {
  const { user } = useUser();
  const { data: userProfile } = useUserProfile(user?.id);
  const { data: settings, isLoading: isLoadingSettings } = useSettings();
  const [premises, setPremises] = React.useState<WithId<Premise>[] | null>(null);
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
  const [startDate, setStartDate] = React.useState<string>(format(subDays(new Date(), 30), 'dd/MM/yyyy'));
  const [endDate, setEndDate] = React.useState<string>(format(new Date(), 'dd/MM/yyyy'));
  const [dateError, setDateError] = React.useState<string | null>(null);

  const exportCost = exportToConfirm === 'csv' ? settings?.csv_export_cost_visitor : settings?.pdf_export_cost_visitor;

  // Realtime Pulse: Automatically refetch visitor history upon database mutations
  const { data: realtimePulse } = useCollection({ table: 'visits', __memo: true });
  const pulseHash = realtimePulse ? realtimePulse.length : 0;

  React.useEffect(() => {
    setIsLoadingPremises(true);
    const fetchPremises = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.from('premises').select('*');
        if (error) throw error;
        setPremises((data as unknown) as WithId<Premise>[]);
      } catch (err: any) {
        console.error('Failed to fetch premises', err);
      } finally {
        setIsLoadingPremises(false);
      }
    };
    fetchPremises();
  }, []);

  React.useEffect(() => {
    if (!user?.id || !settings) {
      if (!isLoadingSettings) {
        setIsLoadingVisits(false);
      }
      return;
    }

    const fetchInitialVisits = async () => {
      setIsLoadingVisits(true);
      setError(null);
      try {
        const historyDays = settings?.history_days_visitor;
        const startDate =
          historyDays && historyDays > 0
            ? subDays(new Date(), historyDays).toISOString()
            : undefined;
        const result = await getVisitsForVisitorAction({
          visitorId: user.id,
          limit: PAGE_SIZE,
          startDate,
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
        toast({ variant: 'destructive', title: 'Error', description: e.message });
      } finally {
        setIsLoadingVisits(false);
      }
    };

    fetchInitialVisits();
  }, [user?.id, settings, isLoadingSettings, toast, pulseHash]);

  const handleLoadMore = async () => {
    if (!user?.id || !hasMore || isLoadingMore || !settings) return;

    setIsLoadingMore(true);
    try {
      const historyDays = settings.history_days_visitor;
      const startDate =
        historyDays && historyDays > 0
          ? subDays(new Date(), historyDays).toISOString()
          : undefined;
      const result = await getVisitsForVisitorAction({
        visitorId: user.id,
        limit: PAGE_SIZE,
        startAfter: lastVisible,
        startDate,
      });

      if (result.success && result.visits) {
        setVisits((prev) => [...prev, ...result.visits!]);
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

      const exportDataResult = await getVisitsForExport({
        visitorId: userProfile.id,
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
        const dataToExport = totalExportVisits.map((visit: any) => ({
          'Premise Name': premiseMap.get(visit.premise_id) || 'Unknown Premise',
          'Host Name': visit.host_name || 'N/A',
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
        const doc = new jsPDF();
        doc.text(`Your Visit History`, 14, 16);
        doc.setFontSize(10);
        doc.text(`Report generated on: ${format(new Date(), 'PPpp')}`, 14, 22);

        autoTable(doc, {
          startY: 30,
          head: [['Premise', 'Host', 'Check-in', 'Check-out', 'Status']],
          body: totalExportVisits.map((visit: any) => [
            premiseMap.get(visit.premise_id) || 'Unknown',
            visit.host_name || 'N/A',
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
        (premiseMap.get(v.premise_id) || '').toLowerCase().includes(lowerSearch) ||
        (v.host_name || '').toLowerCase().includes(lowerSearch)
    );
  }, [visits, searchTerm, premiseMap, startDate, endDate]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-red-500 py-10">
          <p>An error occurred while fetching your visit history.</p>
          <p className="text-sm">{error}</p>
        </div>
      );
    }

    if (!visits || visits.length === 0) {
      return (
        <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-lg">
          <p className="mb-2 font-semibold">No Visit History</p>
          <p className="text-sm">
            You haven&apos;t checked into any premises yet.
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="space-y-4 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-end gap-2">
              <div>
                <Label htmlFor="start-date" className="text-xs text-muted-foreground">From</Label>
                <Input id="start-date" type="text" placeholder="DD/MM/YYYY" value={startDate} onChange={(e) => handleDateInputChange(e.target.value, setStartDate)} className="w-[150px]" maxLength={10} />
              </div>
              <div>
                <Label htmlFor="end-date" className="text-xs text-muted-foreground">To</Label>
                <Input id="end-date" type="text" placeholder="DD/MM/YYYY" value={endDate} onChange={(e) => handleDateInputChange(e.target.value, setEndDate)} className="w-[150px]" maxLength={10} />
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" onClick={() => setExportToConfirm('csv')} disabled={filteredVisits.length === 0 || isLoading || !!dateError || !!isExporting}>
                {isExporting === 'csv' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => setExportToConfirm('pdf')} disabled={filteredVisits.length === 0 || isLoading || !!dateError || !!isExporting}>
                {isExporting === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Export PDF
              </Button>
            </div>
            {dateError && <p className="w-full text-xs text-destructive">{dateError}</p>}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by premise or host..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Premise</TableHead>
              <TableHead>Host Met</TableHead>
              <TableHead>Check-in Time</TableHead>
              <TableHead>Check-out Time</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVisits.map((visit) => (
              <TableRow key={visit.id}>
                <TableCell className="font-medium capitalize">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    {premiseMap.get(visit.premise_id) || (
                      <span className="text-muted-foreground">
                        Unknown Premise
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="capitalize">
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    {visit.host_name || (
                      <span className="text-muted-foreground">Unknown Host</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {visit.checkin_time
                    ? format(new Date(visit.checkin_time), 'PPp')
                    : 'N/A'}
                </TableCell>
                <TableCell>
                  {visit.checkout_time
                    ? format(new Date(visit.checkout_time), 'PPp')
                    : 'N/A'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={visit.status === 'active' ? 'default' : 'secondary'}
                    className="capitalize"
                  >
                    {visit.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredVisits.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            No visits match your search criteria.
          </p>
        )}
        <div className="mt-6 flex justify-center">
          {hasMore && (
            <Button onClick={handleLoadMore} variant="outline" disabled={isLoadingMore}>
              {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Load More
            </Button>
          )}
        </div>
      </>
    );
  };

  const visibleDays = settings?.history_days_visitor;
  const exportableDays = settings?.export_history_days_visitor;
  const description = `A paginated log of your recent check-ins, showing the last ${visibleDays ?? '...'} days. You can export up to ${exportableDays ?? '...'} days of your history.`;

  return (
    <div className="container py-10">
      <div className="mb-4">
        <Button asChild variant="outline">
          <Link href="/dashboard/visitor">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your Visit History</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>
      <AlertDialog open={!!exportToConfirm} onOpenChange={(open) => !open && setExportToConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Export</AlertDialogTitle>
            <AlertDialogDescription>
              This action will deduct <span className="font-bold">{exportCost ?? '...'}</span> tokens from your personal balance. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleExecuteExport(exportToConfirm!)} disabled={isExporting !== null}>
              {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Export
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

