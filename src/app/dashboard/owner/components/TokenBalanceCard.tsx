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
        <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            Premise Token Balance
          </CardTitle>
          <Coins className="h-4 w-4 text-zinc-400 animate-pulse" />
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
        <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 group-hover/balance:text-primary transition-colors">
            Premise Tokens <span className="text-zinc-400">/</span> {premise.name}
          </CardTitle>
          <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
            <Coins className="h-4 w-4 text-zinc-400 group-hover/balance:text-primary transition-colors drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-4xl font-headline font-bold text-white tracking-tight transform group-hover/balance:translate-x-1 transition-transform">
            {balance.toLocaleString()}
          </div>
          <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest mt-1">
            Tokens Available
          </p>
          {isLowBalance && (
            <Alert className="mt-4 bg-red-500/5 border-red-500/20 text-red-400 py-3 rounded-2xl">
              <AlertCircle className="h-3.5 w-3.5" />
              <AlertTitle className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Low Token Balance</AlertTitle>
              <AlertDescription className="text-[9px] font-medium leading-tight opacity-80">
                Your token balance is low. Please recharge soon.
              </AlertDescription>
            </Alert>
          )}
          <Button
            className="w-full mt-6 h-12 bg-primary text-white font-black uppercase tracking-widest text-[10px] hover:bg-primary/90 shadow-[0_0_20px_rgba(59,130,246,0.2)] rounded-xl"
            onClick={() => setIsDialogOpen(true)}
          >
            <Coins className="mr-2 h-4 w-4" /> Recharge Tokens
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

