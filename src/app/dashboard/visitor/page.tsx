'use client';

import { useUser } from '@/supabase';
import { useUserProfile } from '@/services/user-service';
import { VisitorTokenBalanceCard } from './components/VisitorTokenBalanceCard';
import { RatingCard } from './components/RatingCard';
import { QRCodeCard } from './components/QRCodeCard';
import { DashboardActionCard } from './components/DashboardActionCard';
import { History, User, Coins, FileText } from 'lucide-react';
import { AnnouncementsCard } from './components/AnnouncementsCard';
import { useSettings } from '@/services/settings-service';

export default function VisitorDashboardPage() {
    const { user } = useUser();
    const { data: userProfile } = useUserProfile(user?.id);
    const { data: settings } = useSettings();

    return (
        <div className="container py-6 md:py-10">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 space-y-6">
                    <QRCodeCard />
                    <AnnouncementsCard />
                </div>
                <div className="lg:col-span-2 space-y-6">
                    <DashboardActionCard
                        title="My Profile & Vehicles"
                        description="Update your info and manage vehicles"
                        href="/dashboard/profile"
                        icon={User}
                    />
                    <DashboardActionCard
                        title="My Visit History"
                        description="View all your past check-ins"
                        href="/dashboard/visitor/history"
                        icon={History}
                    />
                    {!settings?.hide_token_economy && (
                        <DashboardActionCard
                            title="My Token History & Invoices"
                            description="View your recent token transactions"
                            href="/dashboard/visitor/token-history"
                            icon={Coins}
                        />
                    )}

                    <DashboardActionCard
                        title="GST & Billing Details"
                        description="Update legal name and tax info"
                        href="/dashboard/visitor/gst-details"
                        icon={FileText}
                    />

                    <RatingCard />
                    <VisitorTokenBalanceCard />
                </div>
            </div>
        </div>
    );
}

