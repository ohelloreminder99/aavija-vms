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
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'h-8 w-8 cursor-pointer text-gray-300 transition-colors',
            (hoverRating || rating) >= star && 'text-amber-400 fill-amber-400'
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate Your Visitor: {visit?.visitor_name}</DialogTitle>
          <DialogDescription>
            Your feedback helps maintain a safe and respectful community.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="flex flex-col items-center gap-2">
            <p className="font-medium">Overall Experience</p>
            <StarRatingInput rating={rating} setRating={setRating} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Rating
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by visitor name or status..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Snapshot</TableHead>
              <TableHead>Visitor</TableHead>
              <TableHead>Check-in Time</TableHead>
              <TableHead>Check-out Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVisits.map((visit) => {
              const isRated = ratingsMap.has(visit.id);
              const canRate = visit.status === 'completed' && !isRated;

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
                  <TableCell>
                    {format(new Date(visit.checkin_time), 'PPp')}
                  </TableCell>
                  <TableCell>
                    {visit.checkout_time ? (
                      format(new Date(visit.checkout_time), 'PPp')
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        N/A
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={visit.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                      {visit.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {visit.status === 'completed' ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Rate Visitor" disabled={!canRate} onClick={() => setVisitToRate(visit)}>
                          <Star className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Block Visitor" onClick={() => setVisitToBlock(visit)}>
                          <UserX className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ) : isRated ? (
                      <div className="flex items-center justify-end gap-2 text-sm text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Rated</span>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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

  const visibleDays = settings?.history_days_host;
  const exportableDays = settings?.export_history_days_host;
  const description = `A paginated log of your recent visitors, showing the last ${visibleDays ?? '...'} days. You can export up to ${exportableDays ?? '...'} days of your history. You can rate or block visitors after their visit is complete.`;

  return (
    <>
      <div className="container py-10">
        <div className="mb-4">
          <Button asChild variant="outline">
            <Link href={`/dashboard/host?premiseId=${premiseId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Your Visitor History</CardTitle>
            <CardDescription>
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent>{renderContent()}</CardContent>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will block <span className="font-bold">{visitToBlock?.visitor_name}</span> from being able to check-in to visit you in the future. They will still be able to visit other hosts at this premise.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlockConfirm} disabled={isBlocking}>
              {isBlocking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Block Visitor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </>
  );
}


