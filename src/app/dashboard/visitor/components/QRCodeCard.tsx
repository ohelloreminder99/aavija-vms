
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useUser } from '@/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert, QrCode, Loader2, ShieldCheck } from 'lucide-react';
import { useUserProfile } from '@/services/user-service';
import QRCode from 'react-qr-code';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo,
} from 'react';
import { useSettings } from '@/services/settings-service';
import { usePremiseCategories } from '@/services/premise-category-service';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { generateCheckinToken, deleteCheckinToken } from '../actions';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { EGatepassCard } from './EGatepassCard';

const TOKEN_LIFESPAN_SECONDS_DEFAULT = 60;

export function QRCodeCard() {
  const { user, isUserLoading } = useUser();
  const { data: userProfile, isLoading: isProfileLoading } =
    useUserProfile(user?.id);
  const { data: settings, isLoading: areSettingsLoading } = useSettings();
  const { data: categories, isLoading: areCategoriesLoading } =
    usePremiseCategories();

  const [fgColor, setFgColor] = useState('hsl(210 25% 25%)');
  const [bgColor, setBgColor] = useState('hsl(0 0% 100%)');
  const [isClient, setIsClient] = useState(false);

  // State for the QR code dialog
  const expirySeconds = settings?.qr_code_expiry_seconds || TOKEN_LIFESPAN_SECONDS_DEFAULT;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, startGeneratingTransition] = useTransition();

  // State for token data
  const [tokenData, setTokenData] = useState<{
    token: string;
    expiresAt: number;
  } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // We can't get computed styles until the component has mounted on the client.
    const foreground = getComputedStyle(document.documentElement)
      .getPropertyValue('--foreground')
      .trim();
    const background = getComputedStyle(document.documentElement)
      .getPropertyValue('--card')
      .trim();

    if (foreground) setFgColor(`hsl(${foreground})`);
    if (background) setBgColor(`hsl(${background})`);

    // Explicitly set for scanning reliability if theme variables feel too dark
    setFgColor('#010a05'); // Deep dark for QR bits
    setBgColor('#FFFFFF'); // White for QR background
  }, []);

  const isLoading =
    isUserLoading ||
    isProfileLoading ||
    areSettingsLoading ||
    areCategoriesLoading ||
    !isClient;

  // Function to request a new token
  const handleGenerateToken = () => {
    if (!user?.id) return;

    startGeneratingTransition(async () => {
      setTokenError(null);
      setTokenData(null);

      const result = await generateCheckinToken(user.id);
      if (result.success && result.token && result.expiresAt) {
        setTokenData({ token: result.token, expiresAt: result.expiresAt });
        setIsDialogOpen(true);
      } else {
        setTokenError(result.error || 'Failed to generate QR code.');
        setIsDialogOpen(false); // Don't open dialog on error
      }
    });
  };

  // Function to clean up a token when the dialog is closed. Memoized with useCallback.
  const handleDialogClose = useCallback(
    async (open: boolean) => {
      setIsDialogOpen(open);
      if (!open && tokenData) {
        // Asynchronously delete the token to ensure cleanup.
        await deleteCheckinToken(tokenData.token);
        setTokenData(null); // Clear the token data from state
      }
    },
    [tokenData] // Dependency on tokenData
  );

  // Effect for the countdown timer
  useEffect(() => {
    if (!tokenData || !isDialogOpen) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, tokenData.expiresAt - Date.now());
      if (remaining === 0) {
        // When timer hits 0, call the close handler which also performs cleanup.
        handleDialogClose(false);
        clearInterval(timer);
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [tokenData, isDialogOpen, handleDialogClose]);

  // Effect to automatically close the dialog when a check-in is successful
  useEffect(() => {
    if (userProfile && userProfile.active_checkin_id && isDialogOpen) {
      // Show success animation first
      setShowSuccessOverlay(true);
      
      // After a short delay, close the dialog and transition
      const timer = setTimeout(() => {
        setShowSuccessOverlay(false);
        handleDialogClose(false);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [userProfile?.active_checkin_id, isDialogOpen, handleDialogClose]);

  const maxDeductionRate = useMemo(() => {
    if (!categories || categories.length === 0) {
      return 0; // Default to 0 if no categories are set up, which allows check-in for free.
    }
    return Math.max(...categories.map((c) => c.deduction_rate_visitor));
  }, [categories]);

  const isProfileComplete = !!(userProfile?.name && userProfile.city && userProfile.phone);
  const isPhoneVerified = !!userProfile?.is_verified;
  const allowUnverifiedCheckin = !!settings?.allow_unverified_checkin;
  const allowConcurrentCheckins = !!settings?.allow_concurrent_checkins;

  const requiredTokens = maxDeductionRate;
  const currentBalance = userProfile?.token_balance_visitor ?? 0;
  const hasSufficientTokens = currentBalance >= requiredTokens;

  const hasActiveCheckin = !!userProfile?.active_checkin_id;
  const isButtonDisabled = isGenerating || !isProfileComplete || (!isPhoneVerified && !allowUnverifiedCheckin) || !hasSufficientTokens;

  const validationIssues = [];
  if (!isLoading) {
    if (!isProfileComplete) {
      validationIssues.push({
        key: 'profile',
        title: 'Profile Incomplete',
        description:
          'Your profile must be fully completed before you can check in. Please add your name, city, and phone number.',
        href: '/dashboard/profile',
        buttonText: 'Complete Your Profile',
      });
    }

    if (!isPhoneVerified && !allowUnverifiedCheckin) {
      validationIssues.push({
        key: 'phone',
        title: 'Phone Number Not Verified',
        description: 'Please verify your phone number to enable check-ins.',
        href: '/dashboard/profile',
        buttonText: 'Verify Phone Number',
      });
    }

    if (!hasSufficientTokens) {
      validationIssues.push({
        key: 'tokens',
        title: 'Insufficient Tokens',
        description: `You need at least ${requiredTokens} tokens to check-in. Your current balance is ${currentBalance}.`,
      });
    }

    if (tokenError) {
      validationIssues.push({
        key: 'token-error',
        title: 'QR Generation Failed',
        description: tokenError,
      });
    }
  }


  const canCheckIn = !isLoading && (!hasActiveCheckin || allowConcurrentCheckins);

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center glass-card p-6 min-h-[400px] border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 mesh-obsidian opacity-20" />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest animate-pulse">Loading...</p>
        </div>
      </Card>
    );
  }

  // If they have an active check in but concurrent is FALSE, lock them to the E-Gatepass
  if (hasActiveCheckin && !allowConcurrentCheckins) {
    if (userProfile?.active_checkin_id) {
      return <EGatepassCard checkinId={userProfile.active_checkin_id} />;
    }
  }

  // If they CAN check in, but somehow fail validation, show generic fallback if there's no UI
  if (!canCheckIn) {
    return (
      <Card className="glass-card border-white/5">
        <CardHeader>
          <CardTitle className="text-white">Check-in Locked</CardTitle>
          <CardDescription className="text-zinc-400">
            You are currently unable to initiate a new check-in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="bg-red-500/10 border-red-500/20 text-red-500">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            <AlertTitle className="font-bold">Security Hold</AlertTitle>
            <AlertDescription className="text-xs">
              Please review your profile details or contact facility security.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* If concurrent checkins are allowed AND they have an active check-in, render E-Gatepass above the QR Generator */}
      {hasActiveCheckin && allowConcurrentCheckins && userProfile?.active_checkin_id && (
        <div className="mb-8">
          <EGatepassCard checkinId={userProfile.active_checkin_id} />
        </div>
      )}

      <Card className="glass-card border-white/5 overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        <CardHeader className="relative z-10">
          <CardTitle className="text-white text-2xl tracking-tight">Generate Entry Pass</CardTitle>
          <CardDescription className="text-zinc-400">
            Create a secure QR code to enter the premises.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 relative z-10">
          <Button
            onClick={handleGenerateToken}
            disabled={isButtonDisabled}
            className="w-full h-20 text-xl font-bold bg-primary hover:bg-primary/90 text-[#010a05] shadow-[0_0_30px_rgba(var(--primary),0.3)] transition-all transform active:scale-[0.98]"
          >
            {isGenerating ? (
              <Loader2 className="mr-3 h-8 w-8 animate-spin" />
            ) : (
              <QrCode className="mr-3 h-8 w-8" />
            )}
            Generate QR Code
          </Button>
          {validationIssues.map((issue) => (
            <Alert key={issue.key} className="bg-red-500/10 border-red-500/20 text-red-500">
              <ShieldAlert className="h-4 w-4 text-red-500" />
              <AlertTitle className="font-bold">{issue.title}</AlertTitle>
              <AlertDescription className="text-xs">
                {issue.description}
                {issue.href && issue.buttonText && (
                  <Button asChild size="sm" className="mt-3 bg-red-500 text-white hover:bg-red-600">
                    <Link href={issue.href}>{issue.buttonText}</Link>
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md bg-[#010a05]/95 border-white/10 backdrop-blur-3xl text-white shadow-[0_0_50px_rgba(0,0,0,1)]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight text-white">Entry Pass Ready</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Show this QR code at the entry gate. Pass expires in {expirySeconds}s.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8 gap-6 border border-white/5 rounded-2xl bg-white/5 mt-4">
            {tokenData ? (
              <div
                className="p-4 bg-[#010a05]/95 backdrop-blur-3xl rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.1)] transition-transform animate-in fade-in zoom-in duration-500"
              >
                <QRCode
                  value={tokenData.token}
                  size={260}
                  bgColor="white"
                  fgColor="black"
                  level="H"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[240px] gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-zinc-400 text-sm">Preparing QR code...</p>
              </div>
            )}
            {tokenData && (
              <div className="w-full max-w-xs space-y-3 pt-4">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-zinc-400">
                  <span>Expires in</span>
                  <span className="text-primary">{Math.round(timeRemaining / 1000)}s</span>
                </div>
                <Progress
                  value={
                    (timeRemaining / (expirySeconds * 1000)) * 100
                  }
                  className="h-1.5 bg-white/10"
                />
              </div>
            )}

            {showSuccessOverlay && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#010a05]/90 backdrop-blur-xl animate-in fade-in duration-300 rounded-2xl">
                <div className="h-20 w-20 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mb-4">
                   <ShieldCheck className="h-10 w-10 text-primary animate-bounce" />
                </div>
                <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Check-in Verified</h3>
                <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mt-1">Generating E-Gatepass...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

