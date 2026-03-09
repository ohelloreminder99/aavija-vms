'use client';

import * as React from 'react';
import { Loader2, Wallet, ArrowUpRight, CheckCircle, Clock, AlertCircle, ShieldCheck, Receipt, Coins, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { submitPayoutRequest, updatePayoutDetails } from '@/services/agent-service';
import { useUser } from '@/supabase';
import { useUserProfile } from '@/services/user-service';
import { useSettings } from '@/services/settings-service';
import { useCollection } from '@/supabase';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function EarningsPage() {
    const { user } = useUser();
    const { data: profile, isLoading: profileLoading } = useUserProfile(user?.id);
    const { data: settings } = useSettings();
    const { toast } = useToast();

    const [isPayoutOpen, setIsPayoutOpen] = React.useState(false);
    const [isKycOpen, setIsKycOpen] = React.useState(false);
    const [payoutType, setPayoutType] = React.useState<'cash' | 'token_conversion'>('cash');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // KYC form state
    const [upiId, setUpiId] = React.useState('');
    const [panNumber, setPanNumber] = React.useState('');

    // Fetch payout history
    const { data: payoutHistory } = useCollection<any>({
        table: 'payout_requests',
        filters: user?.id ? [{ column: 'user_id', operator: 'eq', value: user.id }] : [],
        orderBy: { column: 'requested_at', ascending: false },
        limit: 20,
        __memo: true,
    } as any);

    React.useEffect(() => {
        if (profile) {
            setUpiId(profile.agent_payout_upi || '');
            setPanNumber(profile.pan_number || '');
        }
    }, [profile]);

    if (profileLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!profile?.is_agent) return (
        <div className="container max-w-2xl py-16 text-center">
            <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Earnings Dashboard</h2>
            <p className="text-muted-foreground mt-2">You are not currently designated as an agent. Contact admin.</p>
        </div>
    );

    const balance = profile.agent_commission_balance || 0;
    const threshold = settings?.payout_threshold_agent || 0;
    const conversionRate = settings?.token_conversion_rate || 1;
    const tdsEnabled = settings?.tds_enabled;
    const tdsRate = settings?.tds_rate || 0;
    const isEligible = balance >= threshold && threshold > 0;
    const hasPendingReq = payoutHistory?.some((r: any) => ['pending', 'processing'].includes(r.status));
    const canRequestPayout = isEligible && !hasPendingReq && profile.kyc_verified;

    const tokensForConversion = Math.floor(balance * conversionRate);
    const tdsAmount = tdsEnabled ? Math.floor(balance * (tdsRate / 100) * 100) / 100 : 0;
    const netCash = balance - tdsAmount;

    const getPayoutStatus = () => {
        if (!profile.kyc_verified) return { state: 'kyc', label: 'KYC Required', color: 'text-amber-600' };
        if (hasPendingReq) return { state: 'pending', label: 'Request Pending', color: 'text-blue-600' };
        if (isEligible) return { state: 'eligible', label: 'Eligible for Payout 🟢', color: 'text-green-600' };
        return { state: 'accumulating', label: `₹${(threshold - balance).toFixed(2)} more to reach threshold`, color: 'text-muted-foreground' };
    };

    const { state, label, color } = getPayoutStatus();

    const handlePayoutSubmit = async () => {
        setIsSubmitting(true);
        const res = await submitPayoutRequest({
            type: payoutType,
            source: 'agent',
            amount: balance,
            tokensRequested: payoutType === 'token_conversion' ? tokensForConversion : undefined,
            conversionRate: conversionRate,
        });
        if (res.success) {
            toast({ title: 'Request Submitted', description: 'Your payout request is pending admin approval.' });
            setIsPayoutOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: res.error });
        }
        setIsSubmitting(false);
    };

    const handleKycSave = async () => {
        setIsSubmitting(true);
        const res = await updatePayoutDetails({ agent_payout_upi: upiId, pan_number: panNumber });
        if (res.success) {
            toast({ title: 'Saved', description: 'Your payout details have been updated.' });
            setIsKycOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: res.error });
        }
        setIsSubmitting(false);
    };

    return (
        <div className="container max-w-3xl py-10 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">My Earnings</h1>
                <p className="text-muted-foreground text-sm">Your agent commission balance and payout history.</p>
            </div>

            {/* Balance Card */}
            <Card className="border-2">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2"><Wallet className="h-5 w-5" /> Commission Balance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-end gap-3">
                        <span className="text-4xl font-bold">₹{balance.toFixed(2)}</span>
                        <span className={cn('text-sm pb-1 font-medium', color)}>{label}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className={cn('h-full rounded-full transition-all', isEligible ? 'bg-green-500' : 'bg-primary')}
                            style={{ width: `${Math.min(100, threshold > 0 ? (balance / threshold) * 100 : 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">Payout threshold: ₹{threshold.toFixed(2)}</p>

                    <Separator />

                    <div className="flex flex-wrap gap-3">
                        <Button
                            onClick={() => setIsPayoutOpen(true)}
                            disabled={!canRequestPayout}
                            className="flex-1"
                        >
                            <ArrowUpRight className="h-4 w-4 mr-2" />
                            Request Payout
                        </Button>
                        <Button variant="outline" onClick={() => setIsKycOpen(true)}>
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            {profile.kyc_verified ? '✓ KYC Verified' : 'Complete KYC'}
                        </Button>
                    </div>

                    {!profile.kyc_verified && (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                KYC verification required for payouts. Add your UPI ID and PAN card, then wait for admin approval.
                            </AlertDescription>
                        </Alert>
                    )}
                    {settings?.payout_method_note && (
                        <p className="text-xs text-muted-foreground border rounded-md p-2 bg-muted/40">
                            ℹ️ {settings.payout_method_note}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* History */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Payout History</CardTitle>
                    <CardDescription>Your recent 20 payout requests.</CardDescription>
                </CardHeader>
                <CardContent>
                    {!payoutHistory || payoutHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No payout requests yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {payoutHistory.map((req: any) => (
                                <div key={req.id} className="flex items-center justify-between border rounded-lg p-3">
                                    <div className="flex items-center gap-3">
                                        {req.type === 'cash' ? <Receipt className="h-5 w-5 text-muted-foreground" /> : <Coins className="h-5 w-5 text-muted-foreground" />}
                                        <div>
                                            <p className="text-sm font-medium">₹{parseFloat(req.amount).toFixed(2)} — {req.type === 'cash' ? 'Cash' : `${req.tokens_credited} Tokens`}</p>
                                            <p className="text-xs text-muted-foreground">{new Date(req.requested_at).toLocaleDateString('en-IN')}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <Badge variant={req.status === 'paid' ? 'outline' : req.status === 'rejected' ? 'destructive' : 'secondary'}>
                                            {req.status}
                                        </Badge>
                                        {req.admin_note && <p className="text-xs text-muted-foreground mt-1 max-w-[150px] truncate">{req.admin_note}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Payout Request Dialog */}
            <Dialog open={isPayoutOpen} onOpenChange={setIsPayoutOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Request Payout</DialogTitle>
                        <DialogDescription>Choose how you'd like to receive your earnings of <strong>₹{balance.toFixed(2)}</strong>.</DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-3 my-2">
                        <button
                            type="button"
                            onClick={() => setPayoutType('cash')}
                            className={cn('rounded-lg border p-4 text-left transition-colors', payoutType === 'cash' ? 'border-primary bg-primary/5' : 'hover:bg-muted')}
                        >
                            <Receipt className="h-5 w-5 mb-2" />
                            <p className="font-medium text-sm">Cash Payout</p>
                            <p className="text-xs text-muted-foreground mt-1">₹{netCash.toFixed(2)} to UPI{tdsEnabled ? ` (TDS ₹${tdsAmount})` : ''}</p>
                        </button>
                        <button
                            type="button"
                            onClick={() => setPayoutType('token_conversion')}
                            className={cn('rounded-lg border p-4 text-left transition-colors', payoutType === 'token_conversion' ? 'border-primary bg-primary/5' : 'hover:bg-muted')}
                        >
                            <Coins className="h-5 w-5 mb-2" />
                            <p className="font-medium text-sm">Convert to Tokens</p>
                            <p className="text-xs text-muted-foreground mt-1">{tokensForConversion} tokens @ {conversionRate}:1</p>
                        </button>
                    </div>

                    {payoutType === 'token_conversion' && (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                                ⚠️ Token conversion is <strong>irreversible</strong>. Tokens cannot be refunded or converted back to cash once credited.
                            </AlertDescription>
                        </Alert>
                    )}

                    {payoutType === 'cash' && (
                        <p className="text-xs text-muted-foreground">Payment will be sent to: <strong>{profile.agent_payout_upi}</strong></p>
                    )}

                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handlePayoutSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Submit Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* KYC Dialog */}
            <Dialog open={isKycOpen} onOpenChange={setIsKycOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Payout Details & KYC</DialogTitle>
                        <DialogDescription>
                            Required before your first cash payout. KYC is manually verified by admin.
                            {profile.kyc_verified && <span className="text-green-600 font-medium"> ✓ Your KYC is verified.</span>}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="upi">UPI ID *</Label>
                            <Input id="upi" placeholder="yourname@upi" value={upiId} onChange={e => setUpiId(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pan">PAN Number *</Label>
                            <Input id="pan" placeholder="ABCDE1234F" value={panNumber} onChange={e => setPanNumber(e.target.value.toUpperCase())} maxLength={10} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            After saving, upload your PAN card photo via your Profile page (feature coming soon). Admin will verify and activate your payout eligibility.
                        </p>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleKycSave} disabled={isSubmitting || !upiId || !panNumber}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save Details
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
