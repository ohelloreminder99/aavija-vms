'use client';

import { useUser, WithId } from '@/supabase';
import { useUserProfile } from '@/services/user-service';
import { useSearchParams } from 'next/navigation';
import { History, UserX, Coins, Users } from 'lucide-react';

import { DashboardCard } from '@/components/shared/DashboardCard';
import { AnnouncementsCard } from '../visitor/components/AnnouncementsCard';
import { AvailabilityCard } from './components/AvailabilityCard';
import { VisitorTokenBalanceCard } from '../visitor/components/VisitorTokenBalanceCard';
import { DashboardActionCard } from '../visitor/components/DashboardActionCard';

export default function HostDashboardPage() {
    const { user } = useUser();
    const searchParams = useSearchParams();
    const premiseId = searchParams.get('premiseId') ?? undefined;
    const { data: hostProfile } = useUserProfile(user?.id);

    return (
        <div className="container py-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <AvailabilityCard hostProfile={hostProfile} premiseId={premiseId} />
                    <AnnouncementsCard role="host" premiseId={premiseId} />
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        <DashboardCard
                            variant="stat"
                            title="Active Visitors"
                            description="Verify current visitors"
                            href={`/dashboard/host/active-visits?premiseId=${premiseId}`}
                            icon={Users}
                        />
                        <DashboardCard
                            variant="stat"
                            title="Your Visit History"
                            description="View and rate visitors"
                            href={`/dashboard/host/history?premiseId=${premiseId}`}
                            icon={History}
                        />
                        <DashboardCard
                            variant="stat"
                            title="Global Blocklist"
                            description="Visitors you blocked"
                            href={`/dashboard/host/blocked?premiseId=${premiseId}`}
                            icon={UserX}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 content-start">
                        <VisitorTokenBalanceCard />
                        <DashboardActionCard
                            title="My History & Invoices"
                            description="Personal token logs"
                            href="/dashboard/visitor/token-history"
                            icon={Coins}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

