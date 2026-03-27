
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useDoc } from '@/supabase';
import { usePremiseCategories } from '@/services/premise-category-service';
import { useSettings } from '@/services/settings-service';

export default function ScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const premiseId = searchParams.get('premiseId');
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);

  const docRef = React.useMemo(() => {
    if (!premiseId) return null;
    return { table: 'premises', id: premiseId, __memo: true };
  }, [premiseId]);

  const { data: premise, isLoading: isPremiseLoading } = useDoc(docRef);
  const { data: categories, isLoading: areCategoriesLoading } = usePremiseCategories();
  const { data: settings } = useSettings();

  const categoryId = premise?.categoryId;

  const currentCategory = React.useMemo(() => {
    if (!categories || !categoryId) return null;
    return categories.find(c => c.id === categoryId);
  }, [categories, categoryId]);

  const categoryType = currentCategory?.type || 'industrial';
  const premiseDeduction = currentCategory?.deduction_rate_premise || 0;

  const hasSufficientPremiseTokens = React.useMemo(() => {
    if (settings?.hide_token_economy) return true;
    if (!premise || !currentCategory) return true; // Default allow while loading
    if (categoryType === 'residential') return true; // Residential doesn't lock scanner
    return (premise.token_balance || 0) >= premiseDeduction;
  }, [premise, currentCategory, categoryType, premiseDeduction, settings]);

  React.useEffect(() => {
    if (!hasSufficientPremiseTokens && !isPremiseLoading && !areCategoriesLoading) return;

    let html5QrCode: Html5Qrcode | null = null;
    let didScan = false;
    let scanPromise: Promise<any> | null = null;
    let isMounted = true;
    const scannerId = 'qr-scanner-fallback';

    const startScannerWithPolling = () => {
      if (!isMounted) return;
      const scannerElement = document.getElementById(scannerId);
      if (!scannerElement) {
        setTimeout(startScannerWithPolling, 100); // Poll until element exists
        return;
      }

      html5QrCode = new Html5Qrcode(scannerId, {
        verbose: false,
        formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
      });
      
      const onScanSuccess = (decodedText: string) => {
        if (!didScan && html5QrCode?.isScanning) {
          didScan = true;
          setIsProcessing(true);
          html5QrCode.stop().then(() => {
            router.push(`/dashboard/gatekeeper/confirm?token=${decodedText}&premiseId=${premiseId}`);
          });
        }
      };

      scanPromise = html5QrCode.start(
        { facingMode: 'environment' },
        { 
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            return { width: minEdge * 0.7, height: minEdge * 0.7 };
          }
        },
        onScanSuccess,
        () => { } // Optional error callback
      ).catch(err => {
        if (isMounted) {
          toast({
            variant: 'destructive',
            title: 'Camera Error',
            description: 'Failed to start camera. Please ensure permissions are granted and try refreshing the page.',
          });
        }
      });
    };

    startScannerWithPolling();

    return () => {
      isMounted = false;
      if (scanPromise) {
        scanPromise.then(() => {
          if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().then(() => html5QrCode?.clear()).catch(console.error);
          }
        }).catch(() => {});
      } else if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [router, toast, premiseId, hasSufficientPremiseTokens, isPremiseLoading, areCategoriesLoading]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="absolute top-4 left-4">
        <Button asChild variant="outline">
          <Link href={`/dashboard/gatekeeper?premiseId=${premiseId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <h1 className="mb-4 text-2xl font-bold">Alternative Scanner</h1>
      <p className="mb-6 max-w-sm text-center text-muted-foreground">
        Position the visitor's QR code in front of the camera. The scan will be processed automatically.
      </p>

      <div className="relative w-full max-w-md overflow-hidden rounded-lg border-2 border-primary/50 shadow-lg">
        {isProcessing && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-lg font-medium">Processing...</p>
          </div>
        )}
        {!hasSufficientPremiseTokens && !isPremiseLoading && !areCategoriesLoading ? (
          <div className="flex h-64 flex-col items-center justify-center bg-muted/50 p-6 text-center">
            <ShieldAlert className="mb-4 h-12 w-12 text-destructive" />
            <p className="text-lg font-semibold text-destructive">Premise Balance Low</p>
            <p className="mt-2 text-sm text-muted-foreground">This premise has insufficient tokens. Scanner is locked.</p>
          </div>
        ) : (
          <div id="qr-scanner-fallback" className="w-full min-h-[300px]" />
        )}
      </div>

      <Button variant="ghost" onClick={() => window.location.reload()} className="mt-6">
        <RefreshCw className="mr-2 h-4 w-4" />
        Restart Camera
      </Button>
    </div>
  );
}

