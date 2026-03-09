'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Link2, CheckCircle2 } from 'lucide-react';
import { GoogleIcon } from '@/components/icons';

export function LinkedAccounts() {
    const [isLoading, setIsLoading] = React.useState(true);
    const [isLinking, setIsLinking] = React.useState(false);
    const [identities, setIdentities] = React.useState<any[]>([]);
    const { toast } = useToast();
    const supabase = createClient();

    React.useEffect(() => {
        async function loadIdentities() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setIdentities(user.identities || []);
            }
            setIsLoading(false);
        }
        loadIdentities();
    }, [supabase.auth]);

    const handleLinkGoogle = async () => {
        setIsLinking(true);
        try {
            const { data, error } = await supabase.auth.linkIdentity({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/dashboard/profile`,
                },
            });

            if (error) throw error;

            // If the link is successful, Supabase handles the redirection.
            // But just in case:
            toast({
                title: 'Redirecting...',
                description: 'Please wait while we connect securely to Google.',
            });
        } catch (error: any) {
            console.error('Linking error:', error);
            setIsLinking(false);
            let desc = 'Failed to link your account. Please try again.';
            if (error.message?.includes('already linked') || error.message?.includes('already exists')) {
                desc = 'This Google account is already linked to another user.';
            }
            toast({
                variant: 'destructive',
                title: 'Link Failed',
                description: desc,
            });
        }
    };

    const hasGoogleLinked = identities.some(ident => ident.provider === 'google');

    if (isLoading) {
        return (
            <Card className="mt-8">
                <CardHeader>
                    <div className="h-6 w-48 bg-muted animate-pulse rounded"></div>
                    <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2"></div>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className="mt-8">
            <CardHeader>
                <CardTitle className="text-xl">Linked Accounts</CardTitle>
                <CardDescription>
                    Connect your social accounts to log in seamlessly without a password.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <GoogleIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="font-medium">Google</p>
                            <p className="text-sm text-muted-foreground">
                                {hasGoogleLinked ? 'Connected to your profile' : 'Not connected'}
                            </p>
                        </div>
                    </div>

                    {hasGoogleLinked ? (
                        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-full">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Linked</span>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={handleLinkGoogle}
                            disabled={isLinking}
                        >
                            {isLinking ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Link2 className="mr-2 h-4 w-4" />
                            )}
                            Link Account
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
