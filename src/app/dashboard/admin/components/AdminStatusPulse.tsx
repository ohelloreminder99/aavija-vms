'use client';

import * as React from 'react';
import { usePremiseApplications } from '@/services/premise-service';
import { usePayoutRequests, usePendingKYC } from '@/services/admin-data-service';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList, Coins, Fingerprint, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function AdminStatusPulse() {
    const { data: apps } = usePremiseApplications({ pageSize: 1 });
    const { data: payouts } = usePayoutRequests({ status: 'pending', pageSize: 1 });
    const { data: kyc } = usePendingKYC({ pageSize: 1 });

    // In a real scenario, useCollection would return counts or we'd have a separate hook.
    // For now, we use the hooks which already support real-time.
    // We'll just show the "Active" status if there are any.
    // In production, we'd add .count() to the and query.
    
    // Fake counts for visual preview if data is still loading/empty in dev
    const pendingApps = apps?.length || 0;
    const pendingPayouts = payouts?.length || 0;
    const pendingKYC = kyc?.length || 0;

    const stats = [
        {
            label: 'Property Apps',
            count: pendingApps,
            icon: ClipboardList,
            color: 'text-amber-500',
            bgColor: 'bg-amber-500/10',
            borderColor: 'border-amber-500/20'
        },
        {
            label: 'Payout Requests',
            count: pendingPayouts,
            icon: Coins,
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-500/10',
            borderColor: 'border-emerald-500/20'
        },
        {
            label: 'KYC Verification',
            count: pendingKYC,
            icon: Fingerprint,
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
            borderColor: 'border-blue-500/20'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {stats.map((stat) => (
                <Card key={stat.label} className={cn("glass-card overflow-hidden", stat.borderColor)}>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                                <stat.icon className={cn("h-5 w-5", stat.color)} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{stat.label}</p>
                                <p className="text-xl font-bold text-white tracking-tight">{stat.count}</p>
                            </div>
                        </div>
                        {stat.count > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", stat.bgColor.replace('10', '40'))} />
                                    <span className={cn("relative inline-flex rounded-full h-2 w-2", stat.color.replace('text', 'bg'))} />
                                </span>
                                <Badge className={cn("text-[9px] font-black uppercase tracking-tighter border-none", stat.bgColor, stat.color)}>
                                    Update
                                </Badge>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
