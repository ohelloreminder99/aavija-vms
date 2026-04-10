'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useSettings } from '@/services/settings-service';
import { useUser } from '@/supabase';
import { useUserProfile } from '@/services/user-service';
import { useStates } from '@/services/state-service';
import Link from 'next/link';
import { TokenSettingsForm } from './components/TokenSettingsForm';

export default function TokenSettingsPage() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { user } = useUser();
  const { data: userProfile, isLoading: isProfileLoading } = useUserProfile(user?.id);
  const { data: states, isLoading: statesLoading } = useStates();

  const isLoading = settingsLoading || isProfileLoading || statesLoading;

  if (isLoading) {
    return (
      <div className="container flex justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="mb-4">
        <Button asChild variant="outline">
          <Link href="/dashboard/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Token &amp; Economy Settings</CardTitle>
          <CardDescription>
            Configure the application's global token economy, costs, and phone settings. Category-specific costs are managed under "Premise Categories".
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userProfile && <TokenSettingsForm userProfile={userProfile} />}
        </CardContent>
      </Card>
    </div>
  );
}
