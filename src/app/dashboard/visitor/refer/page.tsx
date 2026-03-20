'use client';

import * as React from 'react';
import { Loader2, Share2, Copy, CheckCheck, Users, TrendingUp, Coins, Building, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getMyReferralStats, type ReferralStats, type ReferralEvent } from '@/services/referral-service';
import { useSettings } from '@/services/settings-service';
import { useUser } from '@/supabase';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

export default function ReferPage() {
    const { user } = useUser();
    const { data: settings } = useSettings();
    const { toast } = useToast();

    const [stats, setStats] = React.useState<ReferralStats | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => {
        if (!user) return;
        getMyReferralStats().then(res => {
            if (res.success && res.data) setStats(res.data);
            setIsLoading(false);
        });
    }, [user]);

    const referralLink = stats?.referral_code
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}/signup?ref=${stats.referral_code}`
        : '';

    const handleCopy = async () => {
        if (!referralLink) return;
        await navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: 'Copied!', description: 'Referral link copied to clipboard.' });
    };

    const handleWhatsApp = () => {
        if (!referralLink) return;
        const msg = encodeURIComponent(
            `Hey! I'm using Aavija VMS for visitor management — it's brilliant. Sign up using my link and get ${settings?.referral_reward_tokens || 0} free tokens!\n\n${referralLink}`
        );
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    };

    const commissionRate = (settings?.referral_commission_rate || 0) * 100;
    const minTokens = settings?.referral_min_purchase_tokens || 0;
    const welcomeGift = settings?.referral_reward_tokens || 0;

    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    if (!settings?.referral_enabled) return (
        <div className="container max-w-2xl py-16 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Refer & Earn</h2>
            <p className="text-muted-foreground mt-2">The referral program is currently paused. Check back soon.</p>
        </div>
    );

    return (
        <div className="container max-w-2xl py-10 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Refer & Earn</h1>
                <p className="text-muted-foreground text-sm">
                    Share your link. Every time someone you referred buys tokens, you earn real money.
                </p>
            </div>

            {/* How it works */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { step: '1', label: 'Share your link', icon: Share2 },
                    { step: '2', label: 'They sign up & buy tokens', icon: Users },
                    { step: '3', label: 'You earn real money', icon: TrendingUp },
                ].map(({ step, label, icon: Icon }) => (
                    <div key={step} className="text-center rounded-lg border p-4 space-y-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center mx-auto">{step}</div>
                        <Icon className="h-5 w-5 mx-auto text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                ))}
            </div>

            {/* Your referral link */}
            <Card className="border-2 border-primary/20">
                <CardHeader className="pb-3 text-center">
                    <CardTitle className="text-xl">Share Your Link</CardTitle>
                    <CardDescription>Friends who sign up via your link get a welcome gift automatically.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Share buttons */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Button className="flex-1 h-12 text-lg text-[#010a05]" onClick={handleWhatsApp} variant="default" style={{ backgroundColor: '#25D366' }}>
                            <Share2 className="h-5 w-5 mr-3" />
                            Share on WhatsApp
                        </Button>
                        <Button className="flex-1 h-12 text-lg" onClick={handleCopy} variant="outline">
                            {copied ? <CheckCheck className="h-5 w-5 mr-3 text-green-500" /> : <Copy className="h-5 w-5 mr-3" />}
                            Copy Invite Link
                        </Button>
                    </div>

                    <Separator />

                    {/* Program terms */}
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Commission rate</span>
                            <span className="font-medium">{commissionRate}% per purchase</span>
                        </div>
                        {welcomeGift > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Welcome gift for new user</span>
                                <span className="font-medium">{welcomeGift} tokens</span>
                            </div>
                        )}
                        {minTokens > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Min. purchase to qualify</span>
                                <span className="font-medium">{minTokens} tokens</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Qualifying purchases</span>
                            <span className="font-medium">Every purchase ✓</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Earnings summary */}
            <div className="grid grid-cols-3 gap-3">
                <Card>
                    <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold">{stats?.total_referrals ?? 0}</p>
                        <p className="text-xs text-muted-foreground mt-1">Purchases Referred</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold">₹{stats?.total_earned?.toFixed(2) ?? '0.00'}</p>
                        <p className="text-xs text-muted-foreground mt-1">Total Earned</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold">₹{stats?.pending_balance?.toFixed(2) ?? '0.00'}</p>
                        <p className="text-xs text-muted-foreground mt-1">Available Balance</p>
                    </CardContent>
                </Card>
            </div>

            {stats && stats.pending_balance > 0 && (
                <p className="text-xs text-center text-muted-foreground">
                    Ready to withdraw? Go to <a href="/dashboard/visitor/earnings" className="underline text-primary">My Earnings</a> to request a payout.
                </p>
            )}

            {/* Apply for Premise - Expansion Opportunity */}
            <Card className="glass-card border-primary/20 bg-primary/5 hover:border-primary/40 transition-all duration-300 group overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
                <CardHeader className="pb-2 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                            <Building className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-xl font-headline text-white group-hover:text-glow transition-all duration-300">Expand the Ecosystem</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 relative z-10">
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] leading-relaxed text-emerald-400 font-bold uppercase tracking-wider mb-2">
                        💡 Important: Before applying, share your unique referral link (above) with the Property Owner. They must create an account first so you can find their email during application.
                    </div>
                    <p className="text-sm text-zinc-400">
                        Know a property that needs a better visitor management system? <strong>Apply to become their managing agent</strong> and earn continuous rewards once they are approved.
                    </p>
                    <Button asChild className="w-full h-11 group/btn" variant="outline">
                        <Link href="/dashboard/visitor/apply">
                            Apply for New Premise
                            <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>

            {/* Commission history */}
            {stats && stats.referrals.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Recent Commission Events</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats.referrals.slice(0, 10).map((ref: ReferralEvent) => (
                                <div key={ref.id} className="flex items-center justify-between text-sm">
                                    <div>
                                        <p className="font-medium">+₹{Number(ref.commission_amount).toFixed(2)}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {ref.purchase_amount} tokens purchased · {new Date(ref.created_at).toLocaleDateString('en-IN')}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="text-xs">{(Number(ref.commission_rate) * 100).toFixed(1)}%</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
