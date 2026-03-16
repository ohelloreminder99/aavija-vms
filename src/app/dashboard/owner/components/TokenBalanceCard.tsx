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
import { WithId } from '@/supabase';
import { Coins, AlertCircle, Loader2 } from 'lucide-react';
import { useSettings } from '@/services/settings-service';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Premise } from '@/services/premise-service';

const BuyTokensDialog = React.lazy(() => import('@/components/shared/BuyTokensDialog'));

interface TokenBalanceCardProps {
  premise: WithId<Premise> | null;
  isLoading: boolean;
}

export function TokenBalanceCard({ premise, isLoading: isPremiseLoading }: TokenBalanceCardProps) {
  const { data: settings, isLoading: areSettingsLoading } = useSettings();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const isLoading = isPremiseLoading || areSettingsLoading;

  if (isLoading) {
    return (
      <Card className="glass-card border-white/5 shadow-2xl overflow-hidden relative min-h-[160px] flex flex-col justify-center">
        <div className="absolute inset-0 mesh-obsidian opacity-10 pointer-events-none" />
        <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-bold text-zinc-400">
            Premise Token Balance
          </CardTitle>
          <Coins className="h-5 w-5 text-zinc-400 animate-pulse" />
        </CardHeader>
        <CardContent className="relative z-10">
          <Skeleton className="h-8 w-24 bg-white/5" />
          <Skeleton className="mt-4 h-10 w-full bg-white/5 rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!premise) {
    return null;
  }

  const balance = premise.token_balance ?? 0;
  const threshold = settings?.low_token_threshold ?? 0;
  const isLowBalance = threshold > 0 && balance < threshold;

  return (
    <>
      <Card className="glass-card border-white/5 shadow-2xl overflow-hidden relative min-h-[160px] flex flex-col justify-center group/balance">
        <div className="absolute inset-0 mesh-obsidian opacity-10 pointer-events-none group-hover/balance:opacity-20 transition-opacity" />
        <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 pb-5">
          <CardTitle className="text-base font-bold text-zinc-200 group-hover/balance:text-glow transition-all">
            Premise Tokens <span className="opacity-40 font-normal mx-1">/</span> <span className="text-primary">{premise.name}</span>
          </CardTitle>
          <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
            <Coins className="h-4 w-4 text-zinc-400 group-hover/balance:text-primary transition-colors drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-4xl font-headline font-bold text-white tracking-tight transform group-hover/balance:translate-x-1 transition-transform">
            {balance.toLocaleString()}
          </div>
          <p className="text-sm text-zinc-400 font-medium mt-2">
            Available tokens in premise wallet
          </p>
          {isLowBalance && (
            <Alert className="mt-6 bg-red-500/10 border-red-500/20 text-red-400 py-4 rounded-2xl animate-pulse">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-sm font-bold leading-none mb-1">Low Token Balance</AlertTitle>
              <AlertDescription className="text-xs font-medium leading-tight opacity-90">
                Your premise tokens are nearly exhausted. Please recharge to avoid service interruption.
              </AlertDescription>
            </Alert>
          )}
          <Button
            className="w-full mt-8 h-12 bg-primary hover:bg-primary/90 text-[#010a05] font-bold tracking-wide shadow-[0_0_20px_rgba(59,130,246,0.25)] rounded-xl transition-all transform active:scale-[0.98]"
            onClick={() => setIsDialogOpen(true)}
          >
            <Coins className="mr-2 h-5 w-5" /> Recharge Tokens
          </Button>
        </CardContent>
      </Card>
      {isDialogOpen && (
        <React.Suspense fallback={<div />}>
          <BuyTokensDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} role="owner" premiseId={premise.id} />
        </React.Suspense>
      )}
    </>
  );
}

