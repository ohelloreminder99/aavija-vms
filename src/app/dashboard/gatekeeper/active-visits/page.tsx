'use client';

import * as React from 'react';
import { ArrowLeft, Loader2, Search, Users, ShieldAlert } from 'lucide-react';
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
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { checkoutVisitor, getEmergencyContactInfo } from '../actions';
import { useTransition } from 'react';
import { useCollection, WithId, useUser } from '@/supabase';
import { Visit } from '@/services/visit-service';

export default function ActiveVisitsPage() {
  const searchParams = useSearchParams();
  const premiseId = searchParams.get('premiseId');
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = React.useState('');

  // Checkout state
  const [isCheckingOut, startCheckoutTransition] = useTransition();
  const [visitToCheckout, setVisitToCheckout] = React.useState<WithId<Visit> | null>(null);
  const [checkingOutVisitId, setCheckingOutVisitId] = React.useState<string | null>(null);

  // Emergency state
  const { user } = useUser();
  const [emergencyVisit, setEmergencyVisit] = React.useState<WithId<Visit> | null>(null);
  const [emergencyPhoneData, setEmergencyPhoneData] = React.useState<{ visitorPhone?: string, hostPhone?: string } | null>(null);
  const [isFetchingEmergency, setIsFetchingEmergency] = React.useState(false);

  // Real-time query for active visits
  const activeVisitsQuery = React.useMemo(() => {
    if (!premiseId) return null;

    return {
      table: 'visits',
      filters: [
        { column: 'premise_id', operator: 'eq' as const, value: premiseId },
        { column: 'status', operator: 'eq' as const, value: 'active' }
      ],
      orderBy: { column: 'checkin_time', ascending: false },
      __memo: true
    };
  }, [premiseId]);

  const { data: visits, isLoading, error } = useCollection<Visit>(
    activeVisitsQuery
  );

  const handleCheckoutRequest = (visit: WithId<Visit>) => {
    setVisitToCheckout(visit);
  };

  const handleCheckoutConfirm = () => {
    if (!visitToCheckout || !premiseId) return;

    setCheckingOutVisitId(visitToCheckout.id);
    startCheckoutTransition(async () => {
      const result = await checkoutVisitor({
        visitId: visitToCheckout.id,
        visitorId: visitToCheckout.visitor_id,
        premiseId: premiseId,
      });

      setCheckingOutVisitId(null);
      setVisitToCheckout(null);

      if (result.success) {
        toast({
          title: 'Success',
          description: `${visitToCheckout.visitor_name} has been checked out.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Checkout Failed',
          description: result.error,
        });
      }
    });
  };

  const handleEmergencyRequest = async (visit: WithId<Visit>) => {
    if (!premiseId || !user) return;
    setEmergencyVisit(visit);
    setIsFetchingEmergency(true);
    setEmergencyPhoneData(null);

    const result = await getEmergencyContactInfo({
      visitId: visit.id,
      premiseId: premiseId,
    });

    setIsFetchingEmergency(false);
    if (result.success) {
      setEmergencyPhoneData({ visitorPhone: result.visitorPhone, hostPhone: result.hostPhone });
    } else {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: result.error,
      });
      setEmergencyVisit(null);
    }
  };

  const filteredVisits = React.useMemo(() => {
    if (!visits) return [];
    const lowercasedFilter = searchTerm.toLowerCase();
    return visits.filter(
      (v) =>
        v.visitor_name.toLowerCase().includes(lowercasedFilter) ||
        (v.host_name || '').toLowerCase().includes(lowercasedFilter)
    );
  }, [visits, searchTerm]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-destructive py-10">
          <p>Could not load active visits.</p>
          <p className="text-sm">{error.message}</p>
        </div>
      );
    }

    if (filteredVisits.length === 0) {
      return (
        <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-lg">
          <Users className="mx-auto h-12 w-12" />
          <p className="mt-4 font-semibold">No Active Visitors</p>
          <p className="mt-1 text-sm">
            There are currently no visitors checked in at this premise.
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
              <TableHead>Visitor</TableHead>
              <TableHead>Host</TableHead>
              <TableHead>Checked In</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVisits.map((visit) => (
              <TableRow key={visit.id}>
                <TableCell className="font-medium">
                  {visit.visitor_name}
                </TableCell>
                <TableCell>{visit.host_name || 'N/A'}</TableCell>
                <TableCell>
                  {formatDistanceToNow(visit.checkin_time.toDate(), {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleEmergencyRequest(visit)}
                    disabled={isCheckingOut || isFetchingEmergency}
                    title="Emergency Contact Access (Audited)"
                  >
                    <ShieldAlert className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCheckoutRequest(visit)}
                    disabled={isCheckingOut && checkingOutVisitId === visit.id}
                  >
                    {isCheckingOut && checkingOutVisitId === visit.id && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Checkout
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  };

  if (!premiseId) {
    return (
      <div className="container py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Premise ID is missing. Cannot load active visits.</p>
            <Button asChild variant="link" className="mt-4">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="mb-6">
        <Button asChild variant="outline">
          <Link href={`/dashboard/gatekeeper?premiseId=${premiseId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Gatekeeper Dashboard
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Active Visits & Checkout</CardTitle>
          <CardDescription>
            A list of all visitors currently checked in at your premise.
          </CardDescription>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>

      <AlertDialog
        open={!!visitToCheckout}
        onOpenChange={(open) => !open && setVisitToCheckout(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Checkout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to check out{' '}
              <span className="font-semibold">
                {visitToCheckout?.visitor_name}
              </span>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCheckingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCheckoutConfirm}
              disabled={isCheckingOut}
            >
              {isCheckingOut && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!emergencyVisit}
        onOpenChange={(open) => {
          if (!open && !isFetchingEmergency) {
            setEmergencyVisit(null);
            setEmergencyPhoneData(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-destructive">
              <ShieldAlert className="mr-2 h-5 w-5" />
              Emergency Contact Information
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isFetchingEmergency ? (
                <span className="flex items-center text-muted-foreground mt-2">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Retrieving secure contacts and generating Audit Log...
                </span>
              ) : emergencyPhoneData ? (
                <div className="mt-4 space-y-4">
                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-sm font-semibold mb-1">Visitor ({emergencyVisit?.visitor_name})</p>
                    <p className="font-mono text-lg">{emergencyPhoneData.visitorPhone}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-sm font-semibold mb-1">Host ({emergencyVisit?.host_name || 'N/A'})</p>
                    <p className="font-mono text-lg">{emergencyPhoneData.hostPhone || 'N/A'}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                    Security Notice: This access has been permanently logged and time-stamped in the Administrative Dashboard for accountability.
                  </p>
                </div>
              ) : (
                <span className="text-destructive mt-2">Failed to load contact information.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isFetchingEmergency}>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

