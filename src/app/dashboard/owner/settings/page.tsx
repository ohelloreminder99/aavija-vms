'use client';

import * as React from 'react';
import { ArrowLeft, Loader2, Save, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDoc } from '@/supabase';
import { Premise, updatePremise } from '@/services/premise-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function OwnerSettingsPage() {
    const searchParams = useSearchParams();
    const premiseId = searchParams.get('premise_id');
    const router = useRouter();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);

    const docRef = React.useMemo(() => {
        if (!premiseId) return null;
        return { table: 'premises', id: premiseId, __memo: true };
    }, [premiseId]);

    const { data: premise, isLoading } = useDoc<Premise>(docRef);
    const [requireHostVerification, setRequireHostVerification] = React.useState(false);

    React.useEffect(() => {
        if (premise) {
            setRequireHostVerification(!!premise.require_host_verification);
        }
    }, [premise]);

    const handleSave = async () => {
        if (!premiseId) return;
        setIsSaving(true);
        try {
            await updatePremise(null, premiseId, {
                require_host_verification: requireHostVerification
            });
            toast({
                title: "Settings Saved",
                description: "Premise configuration has been updated successfully.",
            });
            router.refresh();
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Failed to update settings.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="container py-10 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!premiseId) return null;

    return (
        <div className="container py-10 max-w-2xl mx-auto">
            <div className="mb-6">
                <Button asChild variant="outline">
                    <Link href={`/dashboard/owner?premiseId=${premiseId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>

            <Card className="glass-card border-white/5">
                <CardHeader>
                    <CardTitle className="text-2xl font-headline flex items-center gap-3">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                        Premise Security Settings
                    </CardTitle>
                    <CardDescription>
                        Configure security protocols and verification requirements for your premise.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="flex items-center justify-between space-x-4 rounded-xl border border-white/5 p-4 bg-white/5">
                        <div className="flex flex-col space-y-1">
                            <Label htmlFor="host-verification" className="text-base font-semibold">Host Verification for Checkout</Label>
                            <span className="text-sm text-zinc-500">
                                When enabled, gatekeepers can only check out visitors after the host has verified the meeting.
                            </span>
                        </div>
                        <Switch
                            id="host-verification"
                            checked={requireHostVerification}
                            onCheckedChange={setRequireHostVerification}
                        />
                    </div>
                </CardContent>
                <CardFooter className="border-t border-white/5 pt-6 flex justify-end">
                    <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-[#010a05] hover:bg-primary/90">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Configuration
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
