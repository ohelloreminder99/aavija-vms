
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
import { usePremiseMembers } from '@/services/premise-service';
import QrScanner from '@/components/QrScanner';
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

  const handleScan = React.useCallback((data: string) => {
    setIsProcessing(true);
    onScan(data);
  }, [onScan]);

  const handleError = React.useCallback((error: string) => {
    toast({
      variant: 'destructive',
      title: 'Camera Error',
      description: error || 'Could not start camera. Please check permissions.',
    });
    onOpenChange(false);
  }, [toast, onOpenChange]);

  // Reset processing state when dialog closes
  React.useEffect(() => {
    if (!open) setIsProcessing(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#010a05]/95 backdrop-blur-3xl border-white/10 shadow-2xl p-0 overflow-hidden max-w-lg">
        <DialogHeader className="p-8 border-b border-white/10 bg-white/5">
          <DialogTitle className="text-2xl font-bold text-white tracking-tight">Scan <span className="text-primary/80">QR Code</span></DialogTitle>
          <DialogDescription className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-2">
            Point the camera at the visitor&apos;s QR code to scan automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="relative min-h-[400px] p-8">
          {isProcessing && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-white">Processing Visitor Data...</p>
            </div>
          )}
          {/* Only mount scanner when dialog is open and not processing */}
          {open && !isProcessing && (
            <QrScanner
              onScan={handleScan}
              onError={handleError}
              className="w-full rounded-2xl overflow-hidden border border-white/10 shadow-inner"
            />
          )}
        </div>
        <div className="p-6 border-t border-white/5 bg-white/[0.02] flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Hold steady · Auto-detects</p>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-white/5 border-white/10 text-zinc-400 hover:text-white">Close Scanner</Button>
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
  const premiseId = searchParams.get('premise_id');

  const docRef = React.useMemo(() => {
    if (!premiseId) return null;
    return { table: 'premises', id: premiseId, __memo: true };
  }, [premiseId]);

  const { data: premise, isLoading: isPremiseLoading } = useDoc(docRef);
  const { data: categories, isLoading: areCategoriesLoading } = usePremiseCategories();
  const { data: settings } = useSettings();

  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const categoryId = premise?.category_id;

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

  const { data: hostMembers } = usePremiseMembers(premiseId || undefined, 'host');

  React.useEffect(() => {
    if (hostMembers && typeof window !== 'undefined' && navigator.onLine) {
      // Pre-cache the active hosts for offline usage
      const activeHosts: SerializableCheckinHost[] = hostMembers
        .filter((h: any) => h.is_active === true && h.availability !== 'do-not-disturb')
        .map((m: any) => ({
          id: m.user_id,
          name: m.user?.name || 'Unknown',
          identity: m.identity || '',
          photo_url: m.user?.photo_url || '',
          availability: m.availability || 'available',
          token_balance: 0, // Simplified for offline cache
          isDisabled: false,
        }));

      if (premiseId) {
        saveCachedHosts(premiseId, activeHosts).catch(e => console.error("Failed to cache offline hosts", e));
      }
    }
  }, [hostMembers, premiseId]);

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
        <Card className="glass-card border-white/5 overflow-hidden group">
          <CardHeader className="border-b border-white/5 pb-8">
            <CardTitle className="flex items-center gap-3 text-white">
                <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner group-hover:border-primary transition-all">
                    <QrCode className="h-5 w-5 text-primary" />
                </div>
                <span className="text-2xl font-headline tracking-tight">Visitor Check-in</span>
            </CardTitle>
            <CardDescription className="text-zinc-500 font-medium ml-13">Scan a visitor's QR code to begin the check-in process.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <Button
              className="h-32 w-full text-xl font-bold rounded-3xl bg-primary hover:bg-primary/90 shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all hover:scale-[1.01]"
              onClick={() => setIsScannerOpen(true)}
              disabled={isScanDisabled}
            >
              {isLoading ? (
                <Loader2 className="mr-6 h-10 w-10 animate-spin text-white/50" />
              ) : (
                <QrCode className="mr-6 h-12 w-12" />
              )}
              <div className="text-left">
                <p>Scan Visitor QR</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mt-1">Initialize Protocol</p>
              </div>
            </Button>

            <Button asChild variant="ghost" className="w-full text-zinc-500 hover:text-white hover:bg-white/5 rounded-2xl h-12">
              <Link href={`/dashboard/gatekeeper/scan?premiseId=${premiseId}`}>
                <Video className="mr-3 h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Camera issues? Try alternative scanner.</span>
              </Link>
            </Button>

            {!isLoading && !hasSufficientPremiseTokens && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-500 rounded-2xl p-6">
                <ShieldAlert className="h-6 w-6 mr-4" />
                <div className="space-y-1">
                    <AlertTitle className="text-lg font-black uppercase tracking-tight">Premise Balance Low</AlertTitle>
                    <AlertDescription className="text-sm font-medium opacity-80 leading-relaxed">
                        This premise has insufficient tokens for a new check-in. Please ask the premise owner to recharge the account.
                    </AlertDescription>
                </div>
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
      <div className="mt-12 text-center pb-20">
        <Button asChild size="lg" className="h-16 px-12 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary transition-all group/hist shadow-2xl">
          <Link href={`/dashboard/gatekeeper/history?premiseId=${premiseId}`}>
            <History className="mr-4 h-6 w-6 text-zinc-500 group-hover/hist:text-primary transition-colors" />
            <span className="text-[12px] font-black uppercase tracking-[0.3em] text-zinc-300 group-hover/hist:text-white transition-colors">View Visit History</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}

