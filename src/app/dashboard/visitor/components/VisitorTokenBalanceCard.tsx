'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/supabase';
import { useUserProfile } from '@/services/user-service';
import { useSettings } from '@/services/settings-service';
import { Coins, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const BuyTokensDialog = React.lazy(() => import('@/components/shared/BuyTokensDialog'));

export function VisitorTokenBalanceCard() {
  const { user } = useUser();
  const { data: userProfile, isLoading: isProfileLoading } = useUserProfile(user?.id);
  const { data: settings, isLoading: areSettingsLoading } = useSettings();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const isLoading = isProfileLoading || areSettingsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-5 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="mt-1 h-8 w-3/4" />
          <Skeleton className="mt-4 h-10 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!settings?.show_token_card_visitor || settings?.hide_token_economy || !userProfile) {
    return null; // Don't render the card if the setting is off
  }

  const balance = userProfile.token_balance_visitor ?? 0;
  const threshold = settings?.low_token_threshold ?? 0;
  const isLowBalance = threshold > 0 && balance < threshold;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Your Visitor Token Balance
          </CardTitle>
          <Coins className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {balance.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            Tokens available for check-ins
          </p>
          {isLowBalance && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Low Balance</AlertTitle>
              <AlertDescription className="text-xs">
                Please recharge to avoid issues when checking in.
              </AlertDescription>
            </Alert>
          )}
          <Button className="mt-4 w-full" onClick={() => setIsDialogOpen(true)}>
            <Coins className="mr-2 h-4 w-4" /> Buy More Tokens
          </Button>
        </CardContent>
      </Card>
      {isDialogOpen && (
        <React.Suspense fallback={<div />}>
          <BuyTokensDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} role="visitor" />
        </React.Suspense>
      )}
    </>
  );
}

