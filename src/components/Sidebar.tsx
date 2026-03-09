'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { UserProfile } from '@/services/user-service';
import { createClient } from '@/lib/supabase/client';
import {
    LayoutDashboard,
    UserCircle,
    Building2,
    Briefcase,
    ShieldCheck,
    Settings,
    Menu,
    X,
    PanelLeftClose,
    PanelLeftOpen,
    Gift,
    Users,
    Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SidebarProps {
    userProfile: UserProfile | null;
    isMobile?: boolean;
    onClose?: () => void;
}

const roleIcons = {
    admin: Settings,
    owner: Building2,
    host: UserCircle,
    gatekeeper: ShieldCheck,
    visitor: Briefcase,
    staff: Briefcase,
};

function SidebarContent({ userProfile, onClose }: SidebarProps) {
    const pathname = usePathname();
    const [premiseNames, setPremiseNames] = React.useState<Record<string, string>>({});

    React.useEffect(() => {
        const fetchPremiseNames = async () => {
            if (!userProfile?.premise_roles) return;
            const premiseIds = Object.keys(userProfile.premise_roles);
            if (premiseIds.length === 0) return;

            const supabase = createClient();
            const { data, error } = await supabase
                .from('premises')
                .select('id, name')
                .in('id', premiseIds);

            if (!error && data) {
                const map: Record<string, string> = {};
                data.forEach((p) => {
                    map[p.id] = p.name;
                });
                setPremiseNames(map);
            }
        };

        fetchPremiseNames();
    }, [userProfile?.premise_roles]);

    const renderLink = (href: string, label: string, icon: React.ElementType, key: string, exact: boolean = false) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href);
        const Icon = icon;
        return (
            <Button
                key={key}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                    "w-full justify-start overflow-hidden",
                    isActive ? "font-semibold bg-secondary/50" : "font-normal"
                )}
                asChild
                onClick={onClose}
            >
                <Link href={href} title={label}>
                    <Icon className="mr-3 h-5 w-5 shrink-0" />
                    <span className="truncate">{label}</span>
                </Link>
            </Button>
        );
    };

    if (!userProfile) return null;

    return (
        <ScrollArea className="h-full py-4 pr-4">
            <div className="space-y-6">
                {/* Global Links */}
                <div className="space-y-1">
                    <h4 className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Global
                    </h4>
                    {renderLink('/dashboard/visitor', 'Visitor Dashboard', roleIcons.visitor, 'global-visitor')}
                    {renderLink('/dashboard/visitor/refer', 'Refer & Earn', Gift, 'global-refer')}
                    {userProfile.is_agent && renderLink('/dashboard/visitor/earnings', 'My Earnings', Wallet, 'global-earnings')}
                    {renderLink('/dashboard/profile', 'My Profile', UserCircle, 'global-profile')}
                    {userProfile.role === 'admin' && (
                        <>
                            {renderLink('/dashboard/admin', 'Admin Console', roleIcons.admin, 'global-admin')}
                            {renderLink('/dashboard/admin/referrals', 'Referral Log', Users, 'admin-referrals')}
                        </>
                    )}
                </div>

                {/* Premise Contexts */}
                {userProfile.premise_roles && Object.keys(userProfile.premise_roles).length > 0 && (
                    <div className="space-y-4">
                        <h4 className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            My Premises
                        </h4>
                        {Object.entries(userProfile.premise_roles).map(([premiseId, roles]) => {
                            const name = premiseNames[premiseId] || 'Loading...';
                            return (
                                <div key={premiseId} className="space-y-1">
                                    <div className="px-4 py-2 text-sm font-medium text-foreground truncate" title={name}>
                                        {name}
                                    </div>
                                    <div className="pl-2 pr-2 space-y-1 border-l-2 border-muted ml-3">
                                        {roles.map(role => {
                                            const href = `/dashboard/${role}?premiseId=${premiseId}`;
                                            const label = role.charAt(0).toUpperCase() + role.slice(1);
                                            return renderLink(href, label, roleIcons[role as keyof typeof roleIcons] || LayoutDashboard, `${premiseId}-${role}`);
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </ScrollArea>
    );
}

export function DesktopSidebar({ userProfile, isCollapsed, toggleCollapse }: { userProfile: UserProfile | null, isCollapsed: boolean, toggleCollapse: () => void }) {
    return (
        <aside className={cn(
            "hidden md:flex flex-col border-r bg-card transition-all duration-300 relative",
            isCollapsed ? "w-16 items-center" : "w-64"
        )}>
            {/* Collapse Toggle */}
            <Button
                variant="ghost"
                size="icon"
                className="absolute -right-4 top-4 z-10 rounded-full border bg-background shadow-sm hover:bg-accent hover:text-accent-foreground"
                onClick={toggleCollapse}
            >
                {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>

            {!isCollapsed ? (
                <div className="flex-1 w-full pl-6 overflow-hidden">
                    <SidebarContent userProfile={userProfile} />
                </div>
            ) : (
                <div className="flex flex-col items-center py-8 space-y-4">
                    <Button variant="ghost" size="icon" asChild title="Visitor Dashboard">
                        <Link href="/dashboard/visitor"><Briefcase className="h-5 w-5" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" asChild title="My Profile">
                        <Link href="/dashboard/profile"><UserCircle className="h-5 w-5" /></Link>
                    </Button>
                    {userProfile?.is_agent && (
                        <Button variant="ghost" size="icon" asChild title="My Earnings">
                            <Link href="/dashboard/visitor/earnings"><Wallet className="h-5 w-5" /></Link>
                        </Button>
                    )}
                    {userProfile?.role === 'admin' && (
                        <Button variant="ghost" size="icon" asChild title="Admin Console">
                            <Link href="/dashboard/admin"><Settings className="h-5 w-5" /></Link>
                        </Button>
                    )}
                </div>
            )}
        </aside>
    );
}

export function MobileSidebar({ userProfile }: { userProfile: UserProfile | null }) {
    const [open, setOpen] = React.useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden shrink-0">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle navigation menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0 flex flex-col pt-10">
                <SheetTitle className="px-6 text-left">Navigation menu</SheetTitle>
                <SheetDescription className="sr-only">Access different roles and dashboards.</SheetDescription>
                <div className="flex-1 px-4 overflow-y-auto">
                    <SidebarContent userProfile={userProfile} onClose={() => setOpen(false)} />
                </div>
            </SheetContent>
        </Sheet>
    );
}
