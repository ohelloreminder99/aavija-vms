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
import { useCollection, WithId, useUser, useDoc } from '@/supabase';
import { Visit } from '@/services/visit-service';
import { Premise } from '@/services/premise-service';
import { CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

  const premiseDocRef = React.useMemo(() => premiseId ? { table: 'premises', id: premiseId } : null, [premiseId]);
  const { data: premise } = useDoc<Premise>(premiseDocRef as any);

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
          <TableHeader className="bg-[#010a05]/95 backdrop-blur-3xl/[0.03]">
          <TableRow className="border-white/5 hover:bg-transparent">
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 pl-8">Visitor</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4">Host</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4">Checked In</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4">Verification</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 text-right pr-8">Action</TableHead>
          </TableRow>
        </TableHeader>
          <TableBody>
            {filteredVisits.map((visit) => (
              <TableRow key={visit.id} className="border-white/5 hover:bg-white/5">
                <TableCell className="font-bold text-white tracking-tight pl-8">
                  {visit.visitor_name}
                </TableCell>
                <TableCell className="text-zinc-400 text-[11px] font-medium">{visit.host_name || 'N/A'}</TableCell>
                <TableCell className="text-zinc-400 text-[11px] font-medium">
                  {formatDistanceToNow(new Date(visit.checkin_time), {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell>
                  {visit.host_verified_at ? (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Verified
                    </Badge>
                  ) : premise?.require_host_verification ? (
                    <Badge variant="outline" className="text-amber-500 border-amber-500/20 gap-1">
                      <Clock className="h-3 w-3" /> Pending Host
                    </Badge>
                  ) : (
                    <span className="text-xs text-zinc-500 italic">Not Required</span>
                  )}
                </TableCell>
                <TableCell className="text-right pr-8 space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEmergencyRequest(visit)}
                    disabled={isCheckingOut || isFetchingEmergency}
                    title="Emergency Contact Access (Audited)"
                    className="h-8 bg-red-500/5 border-red-500/20 text-red-500 hover:bg-red-500/10"
                  >
                    <ShieldAlert className="h-4 w-4" />
                  </Button>
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleCheckoutRequest(visit)}
                            disabled={(isCheckingOut && checkingOutVisitId === visit.id) || (premise?.require_host_verification && !visit.host_verified_at)}
                            className="h-8 bg-primary text-white font-black uppercase tracking-widest text-[9px] px-6 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:scale-[1.02] transition-all disabled:opacity-30"
                          >
                            {isCheckingOut && checkingOutVisitId === visit.id && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Checkout
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {premise?.require_host_verification && !visit.host_verified_at && (
                        <TooltipContent className="bg-zinc-900 border-white/10 text-[10px] font-bold uppercase tracking-widest p-3">
                          <p>Host verification required</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
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
        <Button asChild variant="ghost" className="text-zinc-400 hover:text-primary hover:bg-white/5 group/back">
          <Link href={`/dashboard/gatekeeper?premiseId=${premiseId}`} className="flex items-center">
            <ArrowLeft className="mr-3 h-4 w-4 group-hover/back:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
          </Link>
        </Button>
      </div>
      <Card className="glass-card border-white/5 shadow-2xl relative overflow-hidden mb-20">
        <CardHeader className="relative z-10 border-b border-white/5 pb-6 bg-[#010a05]/40">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                    <Users className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-2xl font-headline font-bold text-white tracking-tight">Active <span className="text-primary/60">Visits</span></CardTitle>
            </div>
          <CardDescription className="text-zinc-400 text-[10px] font-medium uppercase tracking-[0.2em] max-w-2xl leading-relaxed">
            Manage visitors currently inside the premise perimeter.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 pt-8">{renderContent()}</CardContent>
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

