
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useDoc } from '@/supabase';
import { usePremiseCategories } from '@/services/premise-category-service';
import { useSettings } from '@/services/settings-service';

const SCANNER_ID = 'qr-scanner-fallback';

export default function ScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const premiseId = searchParams.get('premiseId');
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Ref-based singleton guard — prevents StrictMode double-init and dual scanner issue
  const scannerRef = React.useRef<Html5Qrcode | null>(null);
  const isInitializingRef = React.useRef(false);

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
    if (!premise || !currentCategory) return true;
    if (categoryType === 'residential') return true;
    return (premise.token_balance || 0) >= premiseDeduction;
  }, [premise, currentCategory, categoryType, premiseDeduction, settings]);

  const shouldScan = hasSufficientPremiseTokens && !isPremiseLoading && !areCategoriesLoading;

  React.useEffect(() => {
    if (!shouldScan) return;

    // Guard: bail if already initializing or running
    if (isInitializingRef.current || scannerRef.current) return;
    isInitializingRef.current = true;

    let didScan = false;

    const startScanner = () => {
      if (scannerRef.current || !isInitializingRef.current) return;

      const element = document.getElementById(SCANNER_ID);
      if (!element) {
        setTimeout(startScanner, 150);
        return;
      }

      const scanner = new Html5Qrcode(SCANNER_ID, { verbose: false });
      scannerRef.current = scanner;

      const onScanSuccess = (decodedText: string) => {
        if (!didScan && scannerRef.current?.isScanning) {
          didScan = true;
          setIsProcessing(true);
          scannerRef.current.stop().finally(() => {
            scannerRef.current = null;
            isInitializingRef.current = false;
            router.push(`/dashboard/gatekeeper/confirm?token=${decodedText}&premiseId=${premiseId}`);
          });
        }
      };

      scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        () => {} // silent per-frame failure callback (normal)
      ).then(() => {
        isInitializingRef.current = false;
      }).catch(() => {
        scannerRef.current = null;
        isInitializingRef.current = false;
        toast({
          variant: 'destructive',
          title: 'Camera Error',
          description: 'Failed to start camera. Please ensure permissions are granted and try refreshing.',
        });
      });
    };

    // Delay to ensure the DOM element is rendered before querying
    const timer = setTimeout(startScanner, 300);

    return () => {
      clearTimeout(timer);
      isInitializingRef.current = false;
      if (scannerRef.current) {
        const instance = scannerRef.current;
        scannerRef.current = null;
        if (instance.isScanning) {
          instance.stop().then(() => { try { instance.clear(); } catch(e) {} }).catch(console.error);
        } else {
          try { instance.clear(); } catch(e) {}
        }
      }
    };
  }, [shouldScan, router, toast, premiseId]);

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

      <h1 className="mb-4 text-2xl font-bold">QR Scanner</h1>
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
          <div id={SCANNER_ID} className="w-full min-h-[300px]" />
        )}
      </div>

      <Button variant="ghost" onClick={() => window.location.reload()} className="mt-6">
        <RefreshCw className="mr-2 h-4 w-4" />
        Restart Camera
      </Button>
    </div>
  );
}
