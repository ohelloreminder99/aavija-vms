'use client';

import * as React from 'react';
import { useUser, useFirestore, useDoc } from '@/supabase';
import { useUserProfile, updateUserProfile } from '@/services/user-service';
import { usePremises } from '@/services/premise-service';
import { useSettings } from '@/services/settings-service';
import { Loader2, Building, User, Briefcase, KeyRound, UserCog, ShieldCheck, LockKeyhole, UserX, Wallet } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { AavijaLogo } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useCities } from '@/services/city-service';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';


const RoleCard = React.memo(({ title, description, href, icon: Icon }: { title: string, description: string, href: string, icon: React.ElementType }) => (
  <Link href={href}>
    <Card className={cn(
      "relative overflow-hidden group transition-all duration-500",
      "glass-card hover:border-primary/50 hover:scale-[1.02] liquid-neon-border",
      title === "Security Settings" && "opacity-80 hover:opacity-100"
    )}>
      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      <CardHeader className="flex flex-row items-center gap-6 p-6 relative z-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 border border-zinc-200 group-hover:border-primary group-hover:bg-primary/20 transition-all duration-500 shadow-[inset_0_0_20px_rgba(0,0,0,0.02)]">
          <Icon className="h-7 w-7 text-foreground group-hover:text-primary group-hover:scale-110 transition-all duration-500" />
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-xl font-headline tracking-wide text-foreground transition-all duration-300">
            {title}
          </CardTitle>
          <CardDescription className="text-muted-foreground group-hover:text-foreground transition-colors duration-300">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
    </Card>
  </Link>
));
RoleCard.displayName = 'RoleCard';

const roleDetails: { [key: string]: { icon: React.ElementType, name: string, href: string } } = {
  owner: { icon: Briefcase, name: 'Owner', href: '/dashboard/owner' },
  host: { icon: KeyRound, name: 'Host', href: '/dashboard/host' },
  gatekeeper: { icon: ShieldCheck, name: 'Gatekeeper', href: '/dashboard/gatekeeper' }
};

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const { data: userProfile, isLoading: isProfileLoading } = useUserProfile(user?.id);
  const { data: premises, isLoading: arePremisesLoading } = usePremises();

  const isAdmin = userProfile?.role === 'admin';
  const isLoading = isUserLoading || isProfileLoading || arePremisesLoading;
  const premiseMap = React.useMemo(() => premises ? new Map(premises.map(p => [p.id, p.name])) : new Map(), [premises]);

  const premiseRoleCards = React.useMemo(() => {
    if (!userProfile?.premise_roles) return [];
    return Object.entries(userProfile.premise_roles)
      .flatMap(([premiseId, roles]) => {
        const premiseName = premiseMap.get(premiseId);
        if (!premiseName) return [];
        const rolesArray = Array.isArray(roles) ? roles : [roles];
        return rolesArray.map(role => {
          const details = roleDetails[role];
          if (!details) return null;
          return (
            <RoleCard
              key={`${premiseId}-${role}`}
              title={`Act as ${details.name} of ${premiseName}`}
              description={`Manage operational flow for ${premiseName}`}
              href={`${details.href}?premiseId=${premiseId}`}
              icon={details.icon}
            />
          );
        });
      })
      .filter(Boolean);
  }, [userProfile, premiseMap]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-8">
          <AavijaLogo iconClassName="text-primary animate-pulse" textClassName="text-foreground scale-150" />
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground/20" />
            <div className="absolute inset-0 h-12 w-12 animate-pulse text-primary blur-md">
              <Loader2 className="h-12 w-12 animate-spin" />
            </div>
          </div>
          <div className="space-y-2 text-center">
            <p className="text-muted-foreground font-medium tracking-[0.2em] uppercase text-xs animate-pulse">Initialising...</p>
            <div className="h-1 w-48 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary animate-[shimmer_2s_infinite] w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full py-20 px-4">
      <div className="container max-w-2xl px-0">
        <div className="mx-auto flex w-full flex-col justify-center space-y-12">
          <div className="flex flex-col items-center space-y-6 text-center">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <span className="relative flex h-2 w-2 mr-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              SECURE SESSION ACTIVE
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-headline font-bold tracking-tight text-foreground sm:text-5xl">Select Your Role</h1>
              <p className="text-lg text-muted-foreground max-w-sm mx-auto">Choose how you want to continue.</p>
            </div>
          </div>

          <div className="grid gap-5">
            <RoleCard title="Act as Visitor" description="Generate check-in tokens and manage your personal history" href="/dashboard/visitor" icon={User} />
            {isAdmin && <RoleCard title="Act as Admin" description="Full governance control over all regional operations" href="/dashboard/admin" icon={UserCog} />}
            {userProfile?.role === 'staff' && <RoleCard title="Act as Staff" description="Execute assigned security protocols" href="/dashboard/staff" icon={UserCog} />}
            {userProfile?.is_agent && <RoleCard title="Act as Agent" description="Manage ecosystem expansion and commission ledger" href="/dashboard/visitor/earnings" icon={Wallet} />}
            {premiseRoleCards}
            <div className="pt-8 mt-4 border-t border-white/5 flex flex-col gap-5">
              <RoleCard title="Security Settings" description="Update your pin and session settings" href="/dashboard/change-password" icon={LockKeyhole} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

