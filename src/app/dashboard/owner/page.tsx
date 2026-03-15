'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useDoc } from '@/supabase';
import { Premise } from '@/services/premise-service';
import { TokenBalanceCard } from './components/TokenBalanceCard';
import { History, Users, ShieldCheck, UserX, Coins, FileText, DoorOpen, Settings } from 'lucide-react';
import { DashboardCard } from '@/components/shared/DashboardCard';
import { AnnouncementsCard } from '../visitor/components/AnnouncementsCard';
import { createClient } from '@/lib/supabase/client';
import { useSettings } from '@/services/settings-service';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';

export default function OwnerDashboardPage() {
    const searchParams = useSearchParams();
    const premiseId = searchParams.get('premiseId') ?? undefined;
    const [visitCount, setVisitCount] = React.useState<number | null>(null);
    const [isVisitCountLoading, setIsVisitCountLoading] = React.useState(true);
    const { data: settings } = useSettings();

    const docRef = React.useMemo(() => {
        if (!premiseId) return null;
        return { table: 'premises', id: premiseId, __memo: true };
    }, [premiseId]);

    const { data: premise, isLoading: isLoadingPremise } = useDoc<Premise>(docRef);

    React.useEffect(() => {
        if (!premiseId) return;

        const fetchCount = async () => {
            setIsVisitCountLoading(true);
            try {
                const supabase = createClient();
                const { count, error } = await supabase.from('visits').select('*', { count: 'exact', head: true }).eq('premise_id', premiseId);
                if (error) { throw error; }
                setVisitCount(count);
            } catch (error) {
                console.error("Failed to fetch visit count:", error);
                setVisitCount(0); // Set to 0 on error
            } finally {
                setIsVisitCountLoading(false);
            }
        }
        fetchCount();

    }, [premiseId]);


    return (
        <div className="container py-10">
            <OnboardingChecklist premise={premise || undefined} isLoading={isLoadingPremise} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Stats column */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {!settings?.hide_token_economy && <TokenBalanceCard premise={premise} isLoading={isLoadingPremise} />}
                        <DashboardCard
                            variant="stat"
                            title="Visit History"
                            description="View all premise check-ins"
                            href={`/dashboard/owner/history?premiseId=${premiseId}`}
                            icon={History}
                            value={visitCount ?? 0}
                            isLoading={isVisitCountLoading}
                        />
                        <DashboardCard
                            variant="stat"
                            title="Total Hosts"
                            description="Manage your hosts"
                            href={`/dashboard/owner/hosts?premiseId=${premiseId}`}
                            icon={Users}
                            value={premise?.host_count ?? 0}
                            isLoading={isLoadingPremise}
                        />
                        <DashboardCard
                            variant="stat"
                            title="Gatekeepers"
                            description="Manage your gatekeepers"
                            href={`/dashboard/owner/gatekeepers?premiseId=${premiseId}`}
                            icon={ShieldCheck}
                            value={premise?.gatekeeper_count ?? 0}
                            isLoading={isLoadingPremise}
                        />
                        <DashboardCard
                            variant="stat"
                            title="Gate Management"
                            description="Configure premise entry nodes"
                            href={`/dashboard/owner/gates?premiseId=${premiseId}`}
                            icon={DoorOpen}
                            value={premise?.gate_count ?? 0}
                            isLoading={isLoadingPremise}
                        />
                    </div>

                    <AnnouncementsCard role="owner" premiseId={premiseId} />

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <DashboardCard
                            variant="stat"
                            title="Blocked Visitors"
                            description="Manage premise blocklist"
                            href={`/dashboard/owner/blocked?premiseId=${premiseId}`}
                            icon={UserX}
                        />
                        {!settings?.hide_token_economy && (
                            <DashboardCard
                                variant="stat"
                                title="Token History & Invoices"
                                description="View all premise transactions"
                                href={`/dashboard/owner/token-history?premiseId=${premiseId}`}
                                icon={Coins}
                            />
                        )}
                    </div>
                </div>

                {/* GST and side column */}
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-1">
                        <DashboardCard
                            variant="stat"
                            title="GST & Billing Details"
                            description="Update legal and tax info"
                            href={`/dashboard/owner/gst-details?premiseId=${premiseId}`}
                            icon={FileText}
                        />
                        <DashboardCard
                            variant="stat"
                            title="Premise Settings"
                            description="Configure verification and options"
                            href={`/dashboard/owner/settings?premiseId=${premiseId}`}
                            icon={Settings}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

