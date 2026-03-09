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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUser, WithId, useDoc, useCollection } from '@/supabase';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile, UserProfile } from '@/services/user-service';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, subDays, parse } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/services/settings-service';
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
  const [isExporting, setIsExporting] = React.useState<'csv' | 'pdf' | null>(
    null
  );
  const [imageUrlToView, setImageUrlToView] = React.useState<string | null>(null);


  const [startDate, setStartDate] = React.useState<string>(
    format(subDays(new Date(), 30), 'dd/MM/yyyy')
  );
  const [endDate, setEndDate] = React.useState<string>(
    format(new Date(), 'dd/MM/yyyy')
  );
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
      formattedDate = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(
        2,
        4
      )}/${digitsOnly.slice(4, 8)}`;
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
      // Refetch visits after action
      if (premiseId && settings) {
        const historyDays = settings.history_days_owner;
        const computedStartDate = historyDays && historyDays > 0 ? subDays(new Date(), historyDays).toISOString() : undefined;
        const fetchInitialVisits = async () => {
          setIsLoadingVisits(true);
          setError(null);
          setVisits([]);
          setLastVisible(undefined);
          setHasMore(true);

          try {
            const result = await getVisitsForPremise({ premiseId, limit: PAGE_SIZE, startDate: computedStartDate });
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
      }
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

    // Apply dropdown filters
    let dropdownFilteredVisits = dateFilteredVisits;
    if (visitorFilter !== 'all') {
      dropdownFilteredVisits = dropdownFilteredVisits.filter(v => v.visitor_id === visitorFilter);
    }
    if (hostFilter !== 'all') {
      dropdownFilteredVisits = dropdownFilteredVisits.filter(v => v.host_id === hostFilter);
    }

    // Finally apply free-text search on the remaining results
    const lowerSearch = searchTerm.toLowerCase();
    if (!lowerSearch) {
      return dropdownFilteredVisits;
    }

    return dropdownFilteredVisits.filter(
      (v) =>
        v.visitor_name.toLowerCase().includes(lowerSearch) ||
        (v.host_name || '').toLowerCase().includes(lowerSearch)
    );
  }, [visits, searchTerm, startDate, endDate, visitorFilter, hostFilter]);

  const handleExecuteExport = async (exportType: 'csv' | 'pdf') => {
    if (!userProfile || !premiseId || !category) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not identify user, premise, or premise category.' });
      return;
    }

    const cost = exportType === 'csv' ? category.csv_export_cost : category.pdf_export_cost;

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
        description: `Cost for ${exportType.toUpperCase()} export has been deducted. Fetching extended data...`,
      });

      // 1. Fetch the full historical range permitted by exportableDays
      const exportableDays = settings?.export_history_days_owner || 30; // fallback
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
          'Host Name': visit.host_name || 'N/A',
          'Check-in Time': format(new Date(visit.checkin_time), 'PPpp'),
          'Check-out Time': visit.checkout_time
            ? format(new Date(visit.checkout_time), 'PPpp')
            : 'N/A',
          Status: visit.status,
          'Vehicle Plate': visit.vehicle_details?.plate || 'N/A',
          'Vehicle Model': visit.vehicle_details?.model || 'N/A',
        }));
        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
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
          head: [
            ['Visitor', 'Host', 'Check-in', 'Check-out', 'Status', 'Vehicle'],
          ],
          body: totalExportVisits.map((visit) => [
            visit.visitor_name,
            visit.host_name || 'N/A',
            format(new Date(visit.checkin_time), 'Pp'),
            visit.checkout_time
              ? format(new Date(visit.checkout_time), 'Pp')
              : 'N/A',
            visit.status,
            visit.vehicle_details
              ? `${visit.vehicle_details.plate} (${visit.vehicle_details.model})`
              : 'N/A',
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


  const renderTable = () => {
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
          <p>An error occurred while fetching visit history.</p>
          <p className="text-sm">{error}</p>
        </div>
      );
    }

    if (!visits || visits.length === 0) {
      return (
        <div className="py-10 text-center text-muted-foreground border-2 border-dashed rounded-lg">
          <p>No visit history found for your premise.</p>
        </div>
      );
    }

    if (filteredVisits.length === 0) {
      return (
        <p className="py-10 text-center text-muted-foreground">
          No visits match your criteria.
        </p>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Snapshot</TableHead>
            <TableHead>Visitor Name</TableHead>
            <TableHead>Host Name</TableHead>
            <TableHead>Check-in Time</TableHead>
            <TableHead>Check-out Time</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredVisits.map((visit) => {
            return (
              <TableRow key={visit.id}>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setImageUrlToView(visit.visitor_snapshot_url || null)}
                    disabled={!visit.visitor_snapshot_url}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{visit.visitor_name}</div>
                </TableCell>
                <TableCell>{visit.host_name || 'N/A'}</TableCell>
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
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {visit.status === 'active' ? (
                      <Button variant="outline" size="sm" onClick={() => setVisitToForceCheckout(visit)}>Force Checkout</Button>
                    ) : (
                      <Button variant="ghost" size="icon" title="Block from Premise" onClick={() => setVisitToBlock(visit)}>
                        <UserX className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    );
  };

  const visibleDays = settings?.history_days_owner;
  const exportableDays = settings?.export_history_days_owner;
  const description = `A paginated log of recent visits at your premise, showing the last ${visibleDays ?? '...'} days. You can export up to ${exportableDays ?? '...'} days of history via CSV/PDF.`;

  return (
    <div className="container py-10">
      <div className="mb-4">
        <Button asChild variant="outline">
          <Link href={`/dashboard/owner?premiseId=${premiseId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Visit History</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex items-end gap-2">
                <div>
                  <Label
                    htmlFor="start-date"
                    className="text-xs text-muted-foreground"
                  >
                    From
                  </Label>
                  <Input
                    id="start-date"
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={startDate}
                    onChange={(e) => handleDateInputChange(e.target.value, setStartDate)}
                    className="w-[150px]"
                    maxLength={10}
                  />
                </div>
                <div>
                  <Label
                    htmlFor="end-date"
                    className="text-xs text-muted-foreground"
                  >
                    To
                  </Label>
                  <Input
                    id="end-date"
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={endDate}
                    onChange={(e) => handleDateInputChange(e.target.value, setEndDate)}
                    className="w-[150px]"
                    maxLength={10}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={() => setExportToConfirm('csv')}
                  disabled={
                    filteredVisits.length === 0 ||
                    isLoading ||
                    !!dateError ||
                    !!isExporting
                  }
                >
                  {isExporting === 'csv' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setExportToConfirm('pdf')}
                  disabled={
                    filteredVisits.length === 0 ||
                    isLoading ||
                    !!dateError ||
                    !!isExporting
                  }
                >
                  {isExporting === 'pdf' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Export PDF
                </Button>
              </div>
              {dateError && (
                <p className="w-full text-xs text-destructive">{dateError}</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Input
                placeholder="Search results by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div>
                <Label htmlFor="visitor-filter" className="text-xs text-muted-foreground">Visitor</Label>
                <Select value={visitorFilter} onValueChange={setVisitorFilter}>
                  <SelectTrigger id="visitor-filter">
                    <SelectValue placeholder="Filter by visitor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Visitors</SelectItem>
                    {uniqueVisitors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="host-filter" className="text-xs text-muted-foreground">Host</Label>
                <Select value={hostFilter} onValueChange={setHostFilter}>
                  <SelectTrigger id="host-filter">
                    <SelectValue placeholder="Filter by host" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Hosts</SelectItem>
                    {uniqueHosts.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className='mt-6'>
            {renderTable()}
          </div>
          <div className="mt-6 flex justify-center">
            {hasMore && (
              <Button onClick={handleLoadMore} variant="outline" disabled={isLoadingMore}>
                {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Load More
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!imageUrlToView} onOpenChange={(open) => !open && setImageUrlToView(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Visitor Snapshot</DialogTitle>
          </DialogHeader>
          {imageUrlToView && (
            <div className="relative aspect-square w-full">
              <Image
                src={imageUrlToView}
                alt="Visitor snapshot"
                fill
                className="object-contain rounded-md"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!exportToConfirm} onOpenChange={(open) => !open && setExportToConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Export</AlertDialogTitle>
            <AlertDialogDescription>
              This action will deduct <span className="font-bold">{exportCost ?? '...'}</span> tokens from the premise balance. Are you sure you want to proceed?
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

      <AlertDialog
        open={!!visitToBlock}
        onOpenChange={(open) => !open && setVisitToBlock(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently block{' '}
              <span className="font-bold">{visitToBlock?.visitor_name}</span>{' '}
              from entering this premise. They will not be able to check-in to
              visit any host.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlockConfirm}
              disabled={isBlocking}
            >
              {isBlocking && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Block Visitor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!visitToForceCheckout} onOpenChange={(open) => !open && setVisitToForceCheckout(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to force checkout?</AlertDialogTitle>
            <AlertDialogDescription>
              This will forcefully check out <span className="font-bold">{visitToForceCheckout?.visitor_name}</span>. This action should only be used if the visitor cannot be checked out normally.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceCheckoutConfirm} disabled={isCheckingOut}>
              {isCheckingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Force Checkout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

