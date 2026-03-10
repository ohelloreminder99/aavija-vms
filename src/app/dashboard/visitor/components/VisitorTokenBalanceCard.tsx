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
      <Card className="glass-card overflow-hidden group border-border/40 hover:border-primary/20 transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
            Visitor Token Balance
          </CardTitle>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/5 border border-primary/10">
            <Coins className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="text-4xl font-bold tracking-tight text-zinc-900 mb-1 transition-all">
            {balance.toLocaleString()}
          </div>
          <p className="text-xs text-zinc-500 font-medium">
            Tokens available for instant check-ins
          </p>
          {isLowBalance && (
            <Alert className="mt-4 bg-red-50 border-red-100 text-red-600">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className="font-bold">Low Balance</AlertTitle>
              <AlertDescription className="text-xs opacity-90">
                Please recharge to avoid check-in disruption.
              </AlertDescription>
            </Alert>
          )}
          <Button
            className="mt-6 w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all transform active:scale-[0.98]"
            onClick={() => setIsDialogOpen(true)}
          >
            <Coins className="mr-2 h-4 w-4" /> Recharge Wallet
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

