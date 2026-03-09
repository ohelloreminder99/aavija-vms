'use client';

import { useUser, WithId } from '@/supabase';
import { useUserProfile } from '@/services/user-service';
import { useSearchParams } from 'next/navigation';
import { History, UserX, Coins } from 'lucide-react';

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
                <div className="lg:col-span-2 space-y-6">
                    <AvailabilityCard hostProfile={hostProfile} premiseId={premiseId} />
                    <AnnouncementsCard role="host" premiseId={premiseId} />
                </div>

                <div className="space-y-6">
                    <VisitorTokenBalanceCard />
                    <DashboardActionCard
                        title="My Token History & Invoices"
                        description="View your personal token logs"
                        href="/dashboard/visitor/token-history"
                        icon={Coins}
                    />
                    <DashboardCard
                        variant="default"
                        title="Your Visit History"
                        description="View past visits and rate your visitors"
                        href={`/dashboard/host/history?premiseId=${premiseId}`}
                        icon={History}
                    />
                    <DashboardCard
                        variant="default"
                        title="Your Global Blocklist"
                        description="Manage visitors you've personally blocked"
                        href="/dashboard/host/blocked"
                        icon={UserX}
                    />
                </div>
            </div>
        </div>
    );
}

