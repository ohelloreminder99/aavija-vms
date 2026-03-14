'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUserProfile, UserProfile } from '@/services/user-service';
import { useUser } from '@/supabase';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserProfile['role'][];
}

/**
 * RoleGuard component checks if the current user has one of the allowed roles.
 * If not, it redirects the user to the basic dashboard page.
 * It also handles the loading state while the profile is being fetched.
 */
export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user } = useUser();
  const { data: profile, isLoading } = useUserProfile(user?.id);
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (isLoading) return;

    if (!user || !profile) {
      // Not logged in or no profile, redirect to login is handled by Layout,
      // but we'll safety-gate here too.
      return;
    }

    if (allowedRoles.includes(profile.role)) {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
      // Brief delay before redirecting to allow the user to see what happened (optional)
      const timer = setTimeout(() => {
        router.push('/dashboard');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, profile, isLoading, allowedRoles, router]);

  if (isLoading || isAuthorized === null) {
    return (
      <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">
          Verifying Identity Permissions...
        </p>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-4 text-center">
        <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
        </div>
        <h2 className="text-xl font-bold text-foreground tracking-tight">Access Restricted</h2>
        <p className="text-zinc-500 text-xs max-w-sm px-6">
          Your current neural signature lacks the necessary authority level to access this sector.
          Redirecting to your authorized dashboard...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
