'use client';

import * as React from 'react';
import { ArrowLeft, Loader2, Search, Eye } from 'lucide-react';
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
} from '@/components/ui/dialog';
import Image from 'next/image';
import { useUser, WithId, useCollection } from '@/supabase';
import { useUserProfile } from '@/services/user-service';
import { useSettings } from '@/services/settings-service';
import Link from 'next/link';
import { format, subDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useSearchParams } from 'next/navigation';
import { getVisitsForPremise } from '../../admin/premises/actions';
import { useToast } from '@/hooks/use-toast';

type SerializableVisit = NonNullable<Awaited<ReturnType<typeof getVisitsForPremise>>['visits']>[0];
const PAGE_SIZE = 10;

export default function GatekeeperHistoryPage() {
  const { user } = useUser();
  const { data: userProfile } = useUserProfile(user?.id);
  const { data: settings, isLoading: isLoadingSettings } = useSettings();
  const searchParams = useSearchParams();
  const premiseIdFromUrl = searchParams.get('premiseId');
  const { toast } = useToast();

  const premiseId = premiseIdFromUrl || (userProfile?.premise_roles && Object.keys(userProfile.premise_roles)[0]);

  const [visits, setVisits] = React.useState<SerializableVisit[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastVisible, setLastVisible] = React.useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = React.useState(true);

  const [imageUrlToView, setImageUrlToView] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');

  // Realtime Pulse: Dynamically refetch data if another guard processes a check-in
  const { data: realtimePulse } = useCollection({ table: 'visits', __memo: true });
  const pulseHash = realtimePulse ? realtimePulse.length : 0;

  // Effect for the initial data fetch. Runs only when component mounts or critical IDs/settings change.
  React.useEffect(() => {
    // Wait until both the premiseId and the settings are available.
    if (!premiseId || !settings) {
      // If settings are still loading, just wait.
      if (isLoadingSettings) return;

      // If not loading, but we're missing something, stop.
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
        const startDate = historyDays && historyDays > 0 ? subDays(new Date(), historyDays).toISOString() : undefined;

        const result = await getVisitsForPremise({
          premiseId,
          limit: PAGE_SIZE,
          startDate: startDate,
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
        toast({
          variant: 'destructive',
          title: 'Error Loading History',
          description: e.message
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialVisits();
  }, [premiseId, settings, isLoadingSettings, toast, pulseHash]);


  const handleLoadMore = async () => {
    if (!premiseId || !hasMore || isLoadingMore || !settings) return;

    setIsLoadingMore(true);
    try {
      const historyDays = settings.history_days_gatekeeper;
      const startDate = historyDays && historyDays > 0 ? subDays(new Date(), historyDays).toISOString() : undefined;

      const result = await getVisitsForPremise({
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
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while fetching more history.'
      });
    } finally {
      setIsLoadingMore(false);
    }
  };


  const filteredVisits = React.useMemo(() => {
    if (!visits) return [];

    // Filter out active visits
    const completedVisits = visits.filter(v => v.status !== 'active');

    const lowerSearch = searchTerm.toLowerCase();
    if (!lowerSearch) {
      return completedVisits;
    }

    return completedVisits.filter(
      (v) =>
        v.visitor_name.toLowerCase().includes(lowerSearch) ||
        (v.host_name || '').toLowerCase().includes(lowerSearch)
    );
  }, [visits, searchTerm]);

  const renderContent = () => {
    if (isLoading || isLoadingSettings) {
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
            No check-ins have been recorded at this premise yet.
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by visitor or host name..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Snapshot</TableHead>
              <TableHead>Visitor Name</TableHead>
              <TableHead>Host Met</TableHead>
              <TableHead>Check-in Time</TableHead>
              <TableHead>Check-out Time</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVisits.map((visit) => {
              return (
                <TableRow key={visit.id}>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setImageUrlToView(visit.visitor_snapshot_url || null)} disabled={!visit.visitor_snapshot_url}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{visit.visitor_name}</div>
                  </TableCell>
                  <TableCell>{visit.host_name || 'N/A'}</TableCell>
                  <TableCell>
                    {visit.checkin_time ? format(new Date(visit.checkin_time), 'PPp') : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {visit.checkout_time ? format(new Date(visit.checkout_time), 'PPp') : 'N/A'}
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
              )
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
        {filteredVisits.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            No visits match your search criteria.
          </p>
        )}
      </>
    );
  };

  const historyDays = settings?.history_days_gatekeeper;
  const description =
    historyDays && historyDays > 0
      ? `A log of visitor check-ins from the last ${historyDays} days.`
      : 'A log of all visitor check-ins at this premise.';

  return (
    <div className="container py-10">
      <div className="mb-4">
        <Button asChild variant="outline">
          <Link href={`/dashboard/gatekeeper?premiseId=${premiseId}`}>
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
        <CardContent>{renderContent()}</CardContent>
      </Card>
      <Dialog open={!!imageUrlToView} onOpenChange={() => setImageUrlToView(null)}>
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
    </div>
  );
}

