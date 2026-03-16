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
                variant="ghost"
                className={cn(
                    "w-full justify-start overflow-hidden group relative transition-all duration-300",
                    isActive
                        ? "bg-primary/20 text-primary border-r-2 border-primary border-l-0 border-t-0 border-b-0 rounded-none font-bold shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                        : "text-zinc-400 hover:text-white hover:bg-white/5 font-semibold"
                )}
                asChild
                onClick={onClose}
            >
                <Link href={href} title={label}>
                    {isActive && <div className="absolute inset-0 bg-primary/5 blur-xl pointer-events-none" />}
                    <Icon className={cn(
                        "mr-3 h-5 w-5 shrink-0 transition-all duration-300",
                        isActive ? "text-primary scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "group-hover:text-white text-zinc-400"
                    )} />
                    <span className="truncate">{label}</span>
                </Link>
            </Button>
        );
    };

    if (!userProfile) return null;

    return (
        <ScrollArea className="h-full py-6">
            <div className="space-y-8 px-4">
                {/* Global Links */}
                <div className="space-y-2">
                    <h4 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4">
                        Quick Links
                    </h4>
                    {renderLink('/dashboard/visitor', 'Visitor Portal', roleIcons.visitor, 'global-visitor')}
                    {renderLink('/dashboard/visitor/refer', 'Refer & Earn', Gift, 'global-refer')}
                    {userProfile.is_agent && renderLink('/dashboard/visitor/earnings', 'Agent Wallet', Wallet, 'global-earnings')}
                    {renderLink('/dashboard/profile', 'Account Profile', UserCircle, 'global-profile')}
                    {userProfile.role === 'admin' && (
                        <div className="pt-4 mt-4 border-t border-border/40 space-y-2">
                            <h4 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 mb-4">
                                Administration
                            </h4>
                            {renderLink('/dashboard/admin', 'Admin Console', roleIcons.admin, 'global-admin')}
                            {renderLink('/dashboard/admin/referrals', 'Referral Network', Users, 'admin-referrals')}
                        </div>
                    )}
                </div>

                {/* Premise Contexts (Shown for everyone with assigned roles, including Admins) */}
                {userProfile.premise_roles && Object.keys(userProfile.premise_roles).length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-border/40">
                        <h4 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-4">
                            My Properties & roles
                        </h4>
                        {Object.entries(userProfile.premise_roles).map(([premiseId, roles]) => {
                            const name = premiseNames[premiseId] || 'Loading...';
                            return (
                                <div key={premiseId} className="space-y-2">
                                    <div className="px-4 py-2 text-xs font-black text-white truncate" title={name}>
                                        {name}
                                    </div>
                                    <div className="pl-4 space-y-1 relative">
                                        <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10 ml-4" />
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
            "hidden md:flex flex-col border-r border-white/10 bg-[#010a05]/50 backdrop-blur-xl transition-all duration-500 relative",
            isCollapsed ? "w-20 items-center" : "w-72"
        )}>
            {/* Collapse Toggle */}
            <Button
                variant="ghost"
                size="icon"
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="absolute -right-4 top-4 z-10 h-8 w-8 rounded-full border border-white/10 bg-[#010a05] text-zinc-400 shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:bg-white/10 hover:text-white transition-all transform active:scale-95"
                onClick={toggleCollapse}
            >
                {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>

            {!isCollapsed ? (
                <div className="flex-1 w-full overflow-hidden">
                    <SidebarContent userProfile={userProfile} />
                </div>
            ) : (
                <div className="flex flex-col items-center py-10 space-y-6">
                    <Button variant="ghost" size="icon" className="text-zinc-400 hover:bg-white/5 hover:text-white" asChild aria-label="Visitor Dashboard">
                        <Link href="/dashboard/visitor" title="Visitor Dashboard"><Briefcase className="h-5 w-5" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="text-zinc-400 hover:bg-white/5 hover:text-white" asChild aria-label="My Profile">
                        <Link href="/dashboard/profile" title="My Profile"><UserCircle className="h-5 w-5" /></Link>
                    </Button>
                    {userProfile?.is_agent && (
                        <Button variant="ghost" size="icon" className="text-zinc-400 hover:bg-white/5 hover:text-white" asChild aria-label="My Earnings">
                            <Link href="/dashboard/visitor/earnings" title="My Earnings"><Wallet className="h-5 w-5" /></Link>
                        </Button>
                    )}
                    {userProfile?.role === 'admin' && (
                        <Button variant="ghost" size="icon" className="text-zinc-400 hover:bg-white/5 hover:text-white" asChild aria-label="Admin Console">
                            <Link href="/dashboard/admin" title="Admin Console"><Settings className="h-5 w-5" /></Link>
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
