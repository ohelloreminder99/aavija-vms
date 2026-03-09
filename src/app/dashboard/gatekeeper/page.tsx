
'use client';

import * as React from 'react';
import { useCallback, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  History,
  QrCode,
  Loader2,
  ShieldAlert,
  Video,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useUser, useDoc } from '@/supabase';
import { useUserProfile } from '@/services/user-service';
import { useSettings } from '@/services/settings-service';
import { usePremiseCategories } from '@/services/premise-category-service';
import { Html5Qrcode } from 'html5-qrcode';
import { DashboardActionCard } from '../visitor/components/DashboardActionCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { saveCachedHosts } from '@/lib/offline-store';
import { SerializableCheckinHost } from './actions';

function ScannerDialog({
  open,
  onOpenChange,
  onScan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (token: string) => void;
}) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const scannerRegionId = 'primary-scanner-region';

  React.useEffect(() => {
    if (open) {
      setIsProcessing(false); // Reset on open
      let html5QrCode: Html5Qrcode | null = null;
      let didScan = false;

      const startScannerWithPolling = () => {
        const scannerElement = document.getElementById(scannerRegionId);
        if (!scannerElement) {
          setTimeout(startScannerWithPolling, 100); // Poll until element exists
          return;
        }

        html5QrCode = new Html5Qrcode(scannerRegionId);
        const onScanSuccess = (decodedText: string) => {
          if (!didScan && html5QrCode?.isScanning) {
            didScan = true;
            setIsProcessing(true);
            html5QrCode.stop().finally(() => {
              onScan(decodedText);
            });
          }
        };

        html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10 },
          onScanSuccess,
          () => { } // Optional error callback
        ).catch(err => {
          toast({
            variant: 'destructive',
            title: 'Camera Error',
            description: 'Could not start camera. Please check permissions and try again.',
          });
          onOpenChange(false);
        });
      };

      startScannerWithPolling();

      return () => {
        if (html5QrCode && html5QrCode.isScanning) {
          html5QrCode.stop().catch(err => {
            console.error("Failed to stop scanner on cleanup:", err);
          });
        }
      };
    }
  }, [open, onScan, onOpenChange, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scan QR Code</DialogTitle>
          <DialogDescription>
            Position the visitor's QR code in front of the camera.
          </DialogDescription>
        </DialogHeader>
        <div className="relative min-h-[300px]">
          {isProcessing && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="mt-2 text-sm text-muted-foreground">Processing...</p>
            </div>
          )}
          <div id={scannerRegionId} className="w-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}


export default function GatekeeperDashboardPage() {
  const { user } = useUser();
  const { data: gatekeeperProfile, isLoading: isProfileLoading } = useUserProfile(user?.id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const premiseId = searchParams.get('premiseId');

  const docRef = React.useMemo(() => {
    if (!premiseId) return null;
    return { table: 'premises', id: premiseId, __memo: true };
  }, [premiseId]);

  const { data: premise, isLoading: isPremiseLoading } = useDoc(docRef);
  const { data: categories, isLoading: areCategoriesLoading } = usePremiseCategories();
  const { data: settings } = useSettings();

  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const categoryId = premise?.categoryId;

  const currentCategory = useMemo(() => {
    if (!categories || !categoryId) return null;
    return categories.find(c => c.id === categoryId);
  }, [categories, categoryId]);

  const categoryType = currentCategory?.type || 'industrial';
  const premiseDeduction = currentCategory?.deduction_rate_premise || 0;

  const hasSufficientPremiseTokens = useMemo(() => {
    if (settings?.hide_token_economy) return true;
    if (!premise || !currentCategory) return true; // Default allow while loading
    if (categoryType === 'residential') return true; // Residential doesn't lock scanner
    return (premise.token_balance || 0) >= premiseDeduction;
  }, [premise, currentCategory, categoryType, premiseDeduction, settings]);

  const isLoading = isProfileLoading || isPremiseLoading || areCategoriesLoading;
  const isScanDisabled = isLoading || !hasSufficientPremiseTokens;

  React.useEffect(() => {
    if (premise && premise.staff && typeof window !== 'undefined' && navigator.onLine) {
      // Pre-cache the active hosts for offline usage
      const staffList = premise.staff || [];
      const activeHosts: SerializableCheckinHost[] = staffList
        .filter((s: any) => s && s.role === 'host' && s.is_active === true && s.availability !== 'do-not-disturb' && s.uid && s.name && s.identity)
        .map((h: any) => ({
          id: h.uid,
          name: h.name,
          identity: h.identity!,
          photo_url: h.photo_url || '',
          availability: h.availability || 'available',
          token_balance: 0, // Simplified for offline cache
          isDisabled: false,
        }));

      saveCachedHosts(premise.id, activeHosts).catch(e => console.error("Failed to cache offline hosts", e));
    }
  }, [premise]);

  const handleScan = useCallback((token: string) => {
    setIsScannerOpen(false);
    router.push(`/dashboard/gatekeeper/confirm?token=${token}&premiseId=${premiseId}`);
  }, [router, premiseId]);

  return (
    <div className="container py-10">
      <ScannerDialog
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onScan={handleScan}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Visitor Check-in</CardTitle>
            <CardDescription>Scan a visitor's QR code to begin the check-in process.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="h-24 w-full text-lg" onClick={() => setIsScannerOpen(true)} disabled={isScanDisabled}>
              {isLoading ? (
                <Loader2 className="mr-4 h-8 w-8 animate-spin" />
              ) : (
                <QrCode className="mr-4 h-8 w-8" />
              )}
              Scan Visitor QR Code
            </Button>

            <Button asChild variant="link" className="w-full">
              <Link href={`/dashboard/gatekeeper/scan?premiseId=${premiseId}`}>
                <Video className="mr-2 h-4 w-4" />
                Camera issues? Try alternative scanner.
              </Link>
            </Button>

            {!isLoading && !hasSufficientPremiseTokens && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Premise Balance Low</AlertTitle>
                <AlertDescription>
                  This premise has insufficient tokens for a new check-in. Please ask the premise owner to recharge the account.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <DashboardActionCard
          title="Active Visits & Checkout"
          description="View and manage visitors currently inside"
          href={`/dashboard/gatekeeper/active-visits?premiseId=${premiseId}`}
          icon={Users}
        />

      </div>
      <div className="mt-8 text-center">
        <Button asChild size="lg">
          <Link href={`/dashboard/gatekeeper/history?premiseId=${premiseId}`}>
            <History className="mr-2" /> View Visit History
          </Link>
        </Button>
      </div>
    </div>
  );
}

