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
      <Card className="glass-card border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#020617]/95 backdrop-blur-3xl/[0.01]" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 relative z-10">
          <Skeleton className="h-5 w-1/2 bg-white/5" />
        </CardHeader>
        <CardContent className="relative z-10">
          <Skeleton className="mt-1 h-10 w-3/4 bg-white/5" />
          <Skeleton className="mt-6 h-12 w-full bg-white/5" />
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
      <Card className="glass-card overflow-hidden group border-white/5 hover:border-primary/30 transition-all duration-500 relative">
        <div className="absolute inset-0 bg-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 relative z-10">
          <CardTitle className="text-base font-bold text-zinc-100 group-hover:text-glow transition-all">
            My Token Wallet
          </CardTitle>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 shadow-inner group-hover:border-primary/50 group-hover:bg-primary/20 transition-all duration-500">
            <Coins className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          </div>
        </CardHeader>
        <CardContent className="pt-4 relative z-10">
          <div className="text-5xl font-bold tracking-tight text-white mb-2 group-hover:text-glow transition-all duration-300 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            {balance.toLocaleString()}
          </div>
          <p className="text-sm text-zinc-400 font-medium mb-6">
            Available tokens for premise access
          </p>

          {isLowBalance && (
            <Alert className="mb-6 bg-red-500/10 border-red-500/20 text-red-500 backdrop-blur-sm animate-pulse rounded-2xl py-4">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <AlertTitle className="font-bold text-sm mb-1">Low Balance</AlertTitle>
              <AlertDescription className="text-xs opacity-90 leading-relaxed font-medium">
                Your wallet balance is low. Please recharge to ensure uninterrupted premise access.
              </AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full h-12 bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all transform active:scale-[0.98] font-bold tracking-wide rounded-xl"
            onClick={() => setIsDialogOpen(true)}
          >
            <Coins className="mr-2 h-5 w-5" /> Recharge Tokens
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

