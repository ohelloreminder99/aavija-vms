'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useDoc } from '@/supabase';
import { Premise } from '@/services/premise-service';
import { TokenBalanceCard } from './components/TokenBalanceCard';
import { History, Users, ShieldCheck, UserX, Coins, FileText, DoorOpen, Settings, BarChart2 } from 'lucide-react';
import { DashboardCard } from '@/components/shared/DashboardCard';
import { AnnouncementsCard } from '../visitor/components/AnnouncementsCard';
import { createClient } from '@/lib/supabase/client';
import { useSettings } from '@/services/settings-service';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';

export default function OwnerDashboardPage() {
    const searchParams = useSearchParams();
    const premiseId = searchParams.get('premise_id') ?? undefined;
    const [visitCount, setVisitCount] = React.useState<number | null>(null);
    const [hostCount, setHostCount] = React.useState<number | null>(null);
    const [gatekeeperCount, setGatekeeperCount] = React.useState<number | null>(null);
    const [gateCount, setGateCount] = React.useState<number | null>(null);
    const [isStatsLoading, setIsStatsLoading] = React.useState(true);
    const { data: settings } = useSettings();

    const docRef = React.useMemo(() => {
        if (!premiseId) return null;
        return { table: 'premises', id: premiseId, __memo: true };
    }, [premiseId]);

    const { data: premise, isLoading: isLoadingPremise } = useDoc<Premise>(docRef);

    React.useEffect(() => {
        if (!premiseId) return;
 
        const fetchStats = async () => {
            setIsStatsLoading(true);
            try {
                const supabase = createClient();
                
                const [visitsRes, hostsRes, gatekeepersRes, gatesRes] = await Promise.all([
                    supabase.from('visits').select('*', { count: 'exact', head: true }).eq('premise_id', premiseId),
                    supabase.from('premise_members').select('*', { count: 'exact', head: true }).eq('premise_id', premiseId).eq('role', 'host'),
                    supabase.from('premise_members').select('*', { count: 'exact', head: true }).eq('premise_id', premiseId).eq('role', 'gatekeeper'),
                    supabase.from('premise_gates').select('*', { count: 'exact', head: true }).eq('premise_id', premiseId)
                ]);

                setVisitCount(visitsRes.count);
                setHostCount(hostsRes.count);
                setGatekeeperCount(gatekeepersRes.count);
                setGateCount(gatesRes.count);

            } catch (error) {
                console.error("Failed to fetch dashboard stats:", error);
            } finally {
                setIsStatsLoading(false);
            }
        }
        fetchStats();
    }, [premiseId]);

    const computedPremise = React.useMemo(() => {
        if (!premise) return null;
        return {
            ...premise,
            host_count: hostCount ?? premise.host_count ?? 0,
            gatekeeper_count: gatekeeperCount ?? premise.gatekeeper_count ?? 0,
            gate_count: gateCount ?? premise.gate_count ?? 0,
        };
    }, [premise, hostCount, gatekeeperCount, gateCount]);


    return (
        <div className="container py-10">
            <OnboardingChecklist premise={computedPremise || undefined} isLoading={isLoadingPremise || isStatsLoading} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Stats column */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {/* Analytics highlight card */}
                        <DashboardCard
                            variant="stat"
                            title="Analytics & Insights"
                            description="Charts, heatmaps, and trends for this premise"
                            href={`/dashboard/owner/analytics?premiseId=${premiseId}`}
                            icon={BarChart2}
                        />
                        {!settings?.hide_token_economy && <TokenBalanceCard premise={premise} isLoading={isLoadingPremise} />}
                        <DashboardCard
                            variant="stat"
                            title="Visit History"
                            description="View all premise check-ins"
                            href={`/dashboard/owner/history?premiseId=${premiseId}`}
                            icon={History}
                            value={visitCount ?? 0}
                            isLoading={isStatsLoading}
                        />
                        <DashboardCard
                            variant="stat"
                            title="Total Hosts"
                            description="Manage your hosts"
                            href={`/dashboard/owner/hosts?premiseId=${premiseId}`}
                            icon={Users}
                            value={hostCount ?? premise?.host_count ?? 0}
                            isLoading={isStatsLoading}
                        />
                        <DashboardCard
                            variant="stat"
                            title="Gatekeepers"
                            description="Manage your gatekeepers"
                            href={`/dashboard/owner/gatekeepers?premiseId=${premiseId}`}
                            icon={ShieldCheck}
                            value={gatekeeperCount ?? premise?.gatekeeper_count ?? 0}
                            isLoading={isStatsLoading}
                        />
                        <DashboardCard
                            variant="stat"
                            title="Gate Management"
                            description="Configure premise entry nodes"
                            href={`/dashboard/owner/gates?premiseId=${premiseId}`}
                            icon={DoorOpen}
                            value={gateCount ?? premise?.gate_count ?? 0}
                            isLoading={isStatsLoading}
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

