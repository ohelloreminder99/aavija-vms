'use client';

import { useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useUser, useDoc, useAuth, WithId } from '@/supabase';
import { AavijaLogo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Loader2, ArrowLeftRight, LogOut, User, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Separator } from '@/components/ui/separator';
import { useUserProfile, UserProfile } from '@/services/user-service';
import { Skeleton } from '@/components/ui/skeleton';
import { clearSettingsCache, useSettings } from '@/services/settings-service';
import { Premise } from '@/services/premise-service';
import { UserSetupDialog } from '@/components/UserSetupDialog';
import { DesktopSidebar, MobileSidebar } from '@/components/Sidebar';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { needsSetup, shouldBypassSetup } from '@/lib/user-setup-check';
import { RoleGuard } from '@/components/auth/RoleGuard';
import * as React from 'react';

function HeaderContent() {
    const { user } = useUser();
    const { data: userProfile } = useUserProfile(user?.id);
    const auth = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const premiseId = searchParams.get('premiseId');

    const premiseDocRef = React.useMemo(() => {
        if (!premiseId) return null;
        return { table: 'premises', id: premiseId, __memo: true };
    }, [premiseId]);

    const { data: premise, isLoading: isPremiseLoading } = useDoc<Premise>(premiseDocRef);

    const handleSignOut = useCallback(async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        clearSettingsCache();
        router.push('/');
    }, [router]);

    const getContextText = () => {
        const pathSegments = pathname.split('/');
        const dashboardRole = pathSegments.length > 2 ? pathSegments[2] : null;

        if (isPremiseLoading && premiseId) {
            return <Skeleton className="h-5 w-32" />;
        }

        if (premiseId && premise && dashboardRole) {
            if (['owner', 'host', 'gatekeeper'].includes(dashboardRole)) {
                return <span className="truncate text-sm text-zinc-400 font-medium capitalize">{premise.name} (as {dashboardRole})</span>;
            }
        }

        if (dashboardRole === 'admin') {
            return <span className="capitalize font-semibold text-primary">Admin Dashboard</span>
        }

        if (dashboardRole === 'visitor') {
            return <span className="capitalize font-semibold text-primary">Visitor Dashboard</span>
        }

        if (dashboardRole === 'staff') {
            return <span className="capitalize font-semibold text-primary">Staff Dashboard</span>
        }

        if (pathname === '/dashboard') {
            return <span className="text-sm text-zinc-400 font-medium">Select a Role</span>;
        }

        // A sensible fallback if none of the above match
        if (userProfile?.role) {
            return <span className="capitalize font-semibold text-primary">{userProfile.role}</span>;
        }

        return null;
    }

    return (
        <div className="container flex min-h-16 max-w-7xl items-center justify-between gap-2 py-2">
            <div className="flex min-w-0 items-center gap-4">
                <Link href="/dashboard" className='flex-shrink-0'>
                    <AavijaLogo iconClassName="text-primary" textClassName="text-white" />
                </Link>
                {userProfile && (
                    <>
                        <Separator orientation="vertical" className="h-6 bg-white/10" />
                        <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium text-white">
                                {userProfile.name}
                            </span>
                            <div className="text-zinc-400">
                                {getContextText()}
                            </div>
                        </div>
                    </>
                )}
            </div>
            <div className="hidden lg:flex flex-1 justify-center max-w-sm px-4">
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <LanguageSwitcher />
                <Button variant="ghost" asChild size="sm" className="hidden sm:inline-flex text-zinc-400 hover:text-white hover:bg-white/5">
                    <Link href="/dashboard/profile">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                    </Link>
                </Button>
                <Button variant="ghost" onClick={handleSignOut} size="sm" className="hidden sm:inline-flex text-zinc-400 hover:text-white hover:bg-white/5">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign Out</span>
                </Button>

                {/* Mobile sidebar trigger icon */}
                <MobileSidebar userProfile={userProfile} />
            </div>
        </div>
    );
}


export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const pathname = usePathname();
    const { data: userProfile, isLoading: isProfileLoading } = useUserProfile(user?.id);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

    useEffect(() => {
        // If the auth state is done loading and there's no user, redirect to login.
        if (!isUserLoading && !user) {
            router.replace('/login');
        }
    }, [isUserLoading, user, router]);

    // This effect handles the browser's back-forward cache.
    // If a user navigates "back" to a page that requires authentication,
    // this ensures it re-validates the auth state instead of showing a stale page.
    useEffect(() => {
        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                window.location.reload();
            }
        };

        window.addEventListener('pageshow', handlePageShow);
        return () => {
            window.removeEventListener('pageshow', handlePageShow);
        };
    }, []);

    const isLoading = isUserLoading || isProfileLoading;

    // Strict onboarding check for new users requiring their City and Phone Number
    const NeedsSetup = React.useMemo(() => {
        // Single source of truth for onboarding check.
        // Uses needsSetup() from lib/user-setup-check.ts.
        // dashboard/page.tsx no longer has its own duplicate dialog.
        if (isLoading || !userProfile || !pathname) return false;
        if (shouldBypassSetup(pathname)) return false;
        return needsSetup(userProfile);
    }, [isLoading, userProfile, pathname]);

    const { data: globalSettings } = useSettings();
    const [isSetupDialogOpen, setIsSetupDialogOpen] = React.useState(false);

    useEffect(() => {
        if (NeedsSetup) {
            setIsSetupDialogOpen(true);
        } else {
            setIsSetupDialogOpen(false);
        }
    }, [NeedsSetup]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (user) {
        return (
            <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#010a05]/95 backdrop-blur-3xl"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
                <div className="flex min-h-screen flex-col relative bg-[#010a05] text-white selection:bg-primary/20 selection:text-white">
                    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#010a05]/80 backdrop-blur-md">
                        <HeaderContent />
                    </header>
                    <div className="flex flex-1 overflow-hidden">
                        <DesktopSidebar userProfile={userProfile} isCollapsed={isSidebarCollapsed} toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
                        <main className="flex-1 overflow-y-auto w-full bg-transparent">
                            <div className="min-h-full">
                                {(() => {
                                    const pathSegments = pathname?.split('/') || [];
                                    const section = pathSegments.length > 2 ? pathSegments[2] : null;

                                    if (section === 'admin') {
                                        return (
                                            <RoleGuard allowedRoles={['admin']}>
                                                {children}
                                            </RoleGuard>
                                        );
                                    }

                                    if (section === 'owner') {
                                        // Owners and Hosts (who often acting on behalf of owners in this app's context)
                                        return (
                                            <RoleGuard allowedRoles={['owner', 'host', 'admin']}>
                                                {children}
                                            </RoleGuard>
                                        );
                                    }

                                    if (section === 'visitor') {
                                        return children;
                                    }

                                    if (section === 'gatekeeper') {
                                        return (
                                            <RoleGuard allowedRoles={['gatekeeper', 'admin']}>
                                                {children}
                                            </RoleGuard>
                                        );
                                    }

                                    if (section === 'staff') {
                                        return (
                                            <RoleGuard allowedRoles={['staff', 'admin']}>
                                                {children}
                                            </RoleGuard>
                                        );
                                    }

                                    if (section === 'host') {
                                        return (
                                            <RoleGuard allowedRoles={['host', 'admin']}>
                                                {children}
                                            </RoleGuard>
                                        );
                                    }

                                    return children;
                                })()}
                            </div>
                        </main>
                    </div>

                    {/* Setup Gatekeeper */}
                    {NeedsSetup && (
                        <div className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm pointer-events-auto" />
                    )}
                    <UserSetupDialog
                        open={isSetupDialogOpen}
                        onOpenChange={setIsSetupDialogOpen}
                        userId={user.id}
                        settings={globalSettings}
                        onComplete={() => setIsSetupDialogOpen(false)}
                    />
                </div>
            </Suspense>
        );
    }

    // If not loading and no user, the redirect is in flight. Render nothing to prevent flashing.
    return null;
}

