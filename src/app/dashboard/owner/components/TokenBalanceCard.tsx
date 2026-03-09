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
      <Card className="flex flex-col justify-center">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Premise Token Balance
          </CardTitle>
          <Coins className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Skeleton className="mt-1 h-8 w-3/4" />
          <Skeleton className="mt-4 h-10 w-3/4" />
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
      <Card className="flex flex-col justify-center">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Premise Token Balance
          </CardTitle>
          <Coins className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {balance.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            For {premise.name}
          </p>
          {isLowBalance && (
            <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Low Balance</AlertTitle>
                <AlertDescription className="text-xs">
                    Please recharge to avoid service interruptions.
                </AlertDescription>
            </Alert>
          )}
          <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
            <Coins className="mr-2 h-4 w-4" /> Buy More Tokens
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

