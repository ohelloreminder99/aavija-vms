
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
import { ShieldAlert, QrCode, Loader2 } from 'lucide-react';
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

const TOKEN_LIFESPAN_SECONDS = 60;

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, startGeneratingTransition] = useTransition();

  // State for token data
  const [tokenData, setTokenData] = useState<{
    token: string;
    expiresAt: number;
  } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

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
    // If the user profile shows an active check-in has just occurred,
    // and the QR dialog is still open, we must close it to prevent it
    // from re-appearing later.
    if (userProfile && userProfile.active_checkin_id && isDialogOpen) {
      // This call will set isDialogOpen to false and also trigger the cleanup
      // of the token via deleteCheckinToken.
      handleDialogClose(false);
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
      <Card className="flex items-center justify-center p-6 min-h-[400px]">
        <Skeleton className="h-full w-full" />
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
      <Card>
        <CardHeader>
          <CardTitle>Check-in Unavailable</CardTitle>
          <CardDescription>
            You are currently unable to check in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Action Required</AlertTitle>
            <AlertDescription>
              Please review your profile details or contact security.
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

      <Card>
        <CardHeader>
          <CardTitle>Ready to Check-in?</CardTitle>
          <CardDescription>
            Click the button below to generate a secure, one-time QR code for
            check-in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleGenerateToken}
            disabled={isButtonDisabled}
            className="w-full h-16 text-lg"
          >
            {isGenerating ? (
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            ) : (
              <QrCode className="mr-2 h-6 w-6" />
            )}
            Show My QR Code
          </Button>
          {validationIssues.map((issue) => (
            <Alert key={issue.key} variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>{issue.title}</AlertTitle>
              <AlertDescription>
                {issue.description}
                {issue.href && issue.buttonText && (
                  <Button asChild size="sm" className="mt-2">
                    <Link href={issue.href}>{issue.buttonText}</Link>
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your Secure QR Code</DialogTitle>
            <DialogDescription>
              Present this code to the gatekeeper. It is valid for one use and
              will expire shortly.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 gap-4">
            {tokenData ? (
              <div
                style={{
                  background: bgColor,
                  padding: '16px',
                  borderRadius: '8px',
                }}
              >
                <QRCode
                  value={tokenData.token}
                  size={256}
                  bgColor={bgColor}
                  fgColor={fgColor}
                  level="L"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-[288px]">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
            {tokenData && (
              <div className="w-full max-w-xs space-y-1 pt-2">
                <Progress
                  value={
                    (timeRemaining / (TOKEN_LIFESPAN_SECONDS * 1000)) * 100
                  }
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Code expires in {Math.round(timeRemaining / 1000)}s
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

