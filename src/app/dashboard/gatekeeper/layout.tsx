'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@/supabase';
import { useUserProfile } from '@/services/user-service';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Suspense } from 'react';

function GatekeeperLayoutContent({ children }: { children: React.ReactNode }) {
    const { user } = useUser();
    const { data: userProfile, isLoading: isProfileLoading } = useUserProfile(user?.id);
    const searchParams = useSearchParams();
    const premiseId = searchParams.get('premiseId');

    const hasAccess = React.useMemo(() => {
        if (!userProfile || !premiseId) return false;
        const rolesForPremise = userProfile.premise_roles?.[premiseId];
        return rolesForPremise?.includes('gatekeeper');
    }, [userProfile, premiseId]);

    if (isProfileLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!premiseId) {
        return (
            <div className="container py-10">
                <Card className="max-w-md mx-auto">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <ShieldAlert />
                            Premise Not Specified
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>No premise was selected. Please return to the main dashboard to select a premise to manage.</p>
                        <Button asChild className="mt-4">
                            <Link href="/dashboard">Go to Dashboard</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!hasAccess) {
        return (
            <div className="container py-10">
                <Card className="max-w-md mx-auto">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <ShieldAlert />
                            Access Denied
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>You do not have permission to act as a gatekeeper for this premise. Please select a different role or premise.</p>
                        <Button asChild className="mt-4">
                            <Link href="/dashboard">Go to Dashboard</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return <>{children}</>;
}

export default function GatekeeperLayout({ children }: { children: React.ReactNode }) {
    // Suspense is needed because useSearchParams is used in the child component.
    return (
        <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <GatekeeperLayoutContent>{children}</GatekeeperLayoutContent>
        </Suspense>
    );
}

