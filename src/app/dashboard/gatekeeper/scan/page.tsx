
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useDoc } from '@/supabase';
import { usePremiseCategories } from '@/services/premise-category-service';
import { useSettings } from '@/services/settings-service';
import QrScanner from '@/components/QrScanner';

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
    if (!premise || !currentCategory) return true;
    if (categoryType === 'residential') return true;
    return (premise.token_balance || 0) >= premiseDeduction;
  }, [premise, currentCategory, categoryType, premiseDeduction, settings]);

  const shouldScan = hasSufficientPremiseTokens && !isPremiseLoading && !areCategoriesLoading;

  const handleScan = React.useCallback((data: string) => {
    setIsProcessing(true);
    router.push(`/dashboard/gatekeeper/confirm?token=${data}&premiseId=${premiseId}`);
  }, [router, premiseId]);

  const handleError = React.useCallback((error: string) => {
    toast({
      variant: 'destructive',
      title: 'Camera Error',
      description: error || 'Failed to start camera. Please ensure permissions are granted and try refreshing.',
    });
  }, [toast]);

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
        ) : shouldScan && !isProcessing ? (
          <QrScanner
            onScan={handleScan}
            onError={handleError}
            className="w-full min-h-[300px]"
          />
        ) : (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      <Button variant="ghost" onClick={() => window.location.reload()} className="mt-6">
        <RefreshCw className="mr-2 h-4 w-4" />
        Restart Camera
      </Button>
    </div>
  );
}
