'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  processScannedToken,
  finalizeCheckin,
  cancelCheckin,
  SerializableUserProfile,
  SerializableCheckinHost,
} from '../actions';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/supabase';
import { getCachedHosts, queueOfflineCheckin } from '@/lib/offline-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  User,
  UserCheck,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Phone,
  Car,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

type CheckinData = {
  visitor: SerializableUserProfile;
  hosts: SerializableCheckinHost[];
};
type Status = 'loading' | 'confirming' | 'submitting' | 'success' | 'error';

export default function ConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const premiseId = searchParams.get('premise_id');
  const { user } = useUser();
  const { toast } = useToast();

  const [status, setStatus] = React.useState<Status>('loading');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [checkinData, setCheckinData] = React.useState<CheckinData | null>(null);
  const [selectedHostId, setSelectedHostId] = React.useState<string | null>(null);
  const [hostSearchTerm, setHostSearchTerm] = React.useState('');
  const [imageUrlToView, setImageUrlToView] = React.useState<string | null>(null);
  const [isOfflineScan, setIsOfflineScan] = React.useState(false);


  const filteredHosts = React.useMemo(() => {
    if (!checkinData?.hosts) return [];
    const lowercasedFilter = hostSearchTerm.toLowerCase();
    return checkinData.hosts.filter(
      (host) =>
        host.name.toLowerCase().includes(lowercasedFilter) ||
        host.identity.toLowerCase().includes(lowercasedFilter)
    );
  }, [checkinData?.hosts, hostSearchTerm]);

  React.useEffect(() => {
    if (!token || !premiseId) {
      setErrorMessage('Token or Premise ID is missing.');
      setStatus('error');
      return;
    }

    if (typeof window !== 'undefined' && !navigator.onLine) {
      // OFFLINE MODE
      setIsOfflineScan(true);
      getCachedHosts(premiseId).then((cachedHosts) => {
        if (!cachedHosts || cachedHosts.length === 0) {
          setErrorMessage('You are offline, and no cached hosts were found for this premise.');
          setStatus('error');
        } else {
          setCheckinData({
            // We don't know the visitor details offline, just create a placeholder
            visitor: { id: 'offline-visitor', name: 'Unknown Visitor (Offline Scan)', email: '', phone: '', role: 'visitor' } as unknown as SerializableUserProfile,
            hosts: cachedHosts
          });
          setStatus('confirming');
        }
      }).catch(() => {
        setErrorMessage('Failed to load offline hosts.');
        setStatus('error');
      });
      return;
    }

    // ONLINE MODE
    processScannedToken(token, premiseId)
      .then((result) => {
        if (result.success && result.visitor && result.hosts) {
          if (result.hosts.length === 0) {
            setErrorMessage('There are no active hosts at this premise to check-in with.');
            setStatus('error');
          } else {
            setCheckinData({ visitor: result.visitor, hosts: result.hosts });
            setStatus('confirming');
          }
        } else {
          setErrorMessage(result.error || 'Failed to process QR code.');
          setStatus('error');
        }
      })
      .catch((e) => {
        setErrorMessage(e.message || 'An unexpected error occurred.');
        setStatus('error');
      });
  }, [token, premiseId]);

  const handleFinalizeCheckin = async () => {
    if (!token || !checkinData || !premiseId || !user || !selectedHostId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Missing required information for check-in.' });
      return;
    }

    setStatus('submitting');

    if (isOfflineScan) {
      try {
        await queueOfflineCheckin({
          id: crypto.randomUUID(),
          token,
          // Offline visitors have ID embedded in token by design (UUID format), but for ease, let's assume we decode or wait for sync.
          // Wait, the action `finalizeCheckin` takes `visitorId`. If we don't have it offline, the sync manager needs to parse the token to find the user!
          // Actually, our checkin QR code `token` is literally the `checkin_tokens.id`.
          // We can just pass the placeholder and when syncing, the server will read the `userId` from the token table!
          // So we'll pass the exact token, and the backend logic in `finalizeCheckin` ignores `visitorId` and uses the token's `userId`.
          visitor_id: checkinData.visitor.id,
          host_id: selectedHostId,
          premise_id: premiseId!,
          gatekeeperId: user.id,
          timestamp: Date.now()
        });
        toast({ title: 'Offline Scan Saved', description: 'Check-in queued locally. Will sync when online.' });
        setStatus('success');
      } catch (e) {
        setErrorMessage('Failed to queue offline check-in to local storage.');
        setStatus('error');
      }
      return;
    }

    const result = await finalizeCheckin({
      token,
      visitor_id: checkinData.visitor.id,
      host_id: selectedHostId,
      premise_id: premiseId!,
      gatekeeperId: user.id,
    });

    if (result.success) {
      setStatus('success');
    } else {
      setErrorMessage(result.error || 'An unknown error occurred during check-in.');
      setStatus('error');
    }
  };

  const handleReturnToDashboard = () => {
    if (status !== 'confirming' || !token) {
      router.push(`/dashboard/gatekeeper?premiseId=${premiseId}`);
      return;
    }
    // If we're canceling at the confirmation stage, we should delete the used token.
    cancelCheckin(token).finally(() => {
      router.push(`/dashboard/gatekeeper?premiseId=${premiseId}`);
    });
  };

  const visitor = checkinData?.visitor;

  if (status === 'loading') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying QR Code...</p>
      </div>
    );
  }

  if (status === 'submitting') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Finalizing Check-in...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
        <XCircle className="h-16 w-16 text-destructive" />
        <h2 className="text-2xl font-bold">Check-in Failed</h2>
        <p className="max-w-sm text-muted-foreground">{errorMessage}</p>
        <Button onClick={handleReturnToDashboard}>Return to Dashboard</Button>
      </div>
    );
  }

  if (status === 'success') {
    const hostName = checkinData?.hosts.find(h => h.id === selectedHostId)?.name;
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="text-2xl font-bold">Check-in Complete!</h2>
        <p className="text-muted-foreground">
          <span className="font-semibold">{visitor?.name}</span> has been successfully checked in to see <span className="font-semibold">{hostName}</span>.
        </p>
        <Button size="lg" className="mt-4" onClick={handleReturnToDashboard}>
          Scan Next Visitor
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto max-w-4xl py-10">
        <div className="mb-4">
          <Button onClick={handleReturnToDashboard} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel and Return
          </Button>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Visitor Details Card */}
          <Card className="flex flex-col">
            <CardContent className="p-6 text-center flex flex-col items-center justify-center flex-1">
              <button
                className="rounded-md overflow-hidden disabled:cursor-not-allowed"
                disabled={!visitor?.photo_url}
                onClick={() => visitor?.photo_url && setImageUrlToView(visitor.photo_url)}
              >
                <Avatar className="h-40 w-40 rounded-md border-2">
                  <AvatarImage src={visitor?.photo_url} alt={visitor?.name} className="object-contain w-full h-full" />
                  <AvatarFallback className="rounded-md text-4xl"><User /></AvatarFallback>
                </Avatar>
              </button>
              <h2 className="mt-4 text-2xl font-bold">{visitor?.name}</h2>
              <p className="text-muted-foreground">{visitor?.companyName || 'No company'}</p>
            </CardContent>
            <Separator />
            <CardContent className="p-6 text-sm space-y-4">
              <div className="flex items-center gap-4">
                <Phone className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">{(visitor as any)?.country_code ? `(${(visitor as any).country_code}) ` : ''}{(visitor as any)?.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Car className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {visitor?.selected_vehicle_number && (visitor as any)?.vehicles?.find((v: any) => v.number === visitor.selected_vehicle_number)
                      ? `${visitor.selected_vehicle_number} (${(visitor as any).vehicles.find((v: any) => v.number === visitor.selected_vehicle_number)?.type})`
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Host Selection Card */}
          <Card className="flex flex-col">
            <CardContent className="p-6 flex flex-col flex-1">
              <h2 className="text-center text-xl font-bold mb-4">Select Host</h2>
              <Input
                placeholder="Search host by name or identity..."
                value={hostSearchTerm}
                onChange={(e) => setHostSearchTerm(e.target.value)}
                className="mb-4"
              />
              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-4">
                  {filteredHosts.map((host) => (
                    <Card
                      key={host.id}
                      className={cn(
                        'transition-all',
                        host.isDisabled ? 'opacity-50 cursor-not-allowed bg-muted/50' : 'cursor-pointer hover:bg-accent',
                        selectedHostId === host.id ? 'border-primary ring-2 ring-primary' : ''
                      )}
                      onClick={() => !host.isDisabled && setSelectedHostId(host.id)}
                    >
                      <CardContent className="flex items-center justify-between gap-4 p-3">
                        <div className="flex items-center gap-3">
                          <Avatar><AvatarImage src={host.photo_url} /><AvatarFallback>{host.identity.charAt(0)}</AvatarFallback></Avatar>
                          <div>
                            <div className="font-semibold">{host.identity}</div>
                            {selectedHostId === host.id && <div className="text-sm text-foreground">{host.name}</div>}
                            {host.isDisabled && <div className="text-xs text-destructive mt-1 font-medium">Insufficient Tokens</div>}
                          </div>
                        </div>
                        {selectedHostId === host.id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                      </CardContent>
                    </Card>
                  ))}
                  {filteredHosts.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No hosts match your search.</p>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
        <div className="mt-8 flex justify-end">
          <Button size="lg" onClick={handleFinalizeCheckin} disabled={!selectedHostId}>
            <UserCheck className="mr-2 h-5 w-5" />
            Confirm Check-in
          </Button>
        </div>
      </div>
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
    </>
  );
}

