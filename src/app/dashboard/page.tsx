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
      "relative overflow-hidden group transition-all duration-300",
      "glass-card hover:bg-white/5 hover:border-white/20 hover:scale-[1.02]",
      title === "Change Your Password" && "bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10"
    )}>
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardHeader className="flex flex-row items-center gap-5 p-6 relative z-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 border border-white/10 group-hover:border-primary/50 group-hover:bg-primary/10 transition-all duration-500 shadow-inner">
          <Icon className="h-6 w-6 text-white group-hover:text-primary transition-colors duration-500" />
        </div>
        <div>
          <CardTitle className="text-xl font-headline tracking-tight text-white group-hover:text-glow transition-all">
            {title}
          </CardTitle>
          <CardDescription className="text-zinc-400 group-hover:text-zinc-300">
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
              description={`Manage operations`}
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
      <div className="flex min-h-screen items-center justify-center bg-obsidian">
        <div className="flex flex-col items-center gap-6">
          <AavijaLogo iconClassName="text-white/80" textClassName="text-white scale-125" />
          <div className="relative">
            <Loader2 className="h-10 w-10 animate-spin text-white/20" />
            <div className="absolute inset-0 h-10 w-10 animate-pulse text-primary blur-sm">
              <Loader2 className="h-10 w-10 animate-spin" />
            </div>
          </div>
          <p className="text-zinc-400 font-medium tracking-wide animate-pulse">Initializing Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full py-16 px-4">
      <div className="container max-w-2xl">
        <div className="mx-auto flex w-full flex-col justify-center space-y-12">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="inline-flex items-center rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs font-medium text-primary backdrop-blur-sm">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              System Authentication Active
            </div>
            <h1 className="text-4xl font-headline font-bold tracking-tight text-white">Select Your Role</h1>
            <p className="text-lg text-zinc-400 max-w-sm">Choose the security context you want to operate in today.</p>
          </div>

          <div className="grid gap-4">
            <RoleCard title="Act as Visitor" description="Check-in to a new premise" href="/dashboard/visitor" icon={User} />
            {isAdmin && <RoleCard title="Act as Admin" description="Manage the entire system" href="/dashboard/admin" icon={UserCog} />}
            {userProfile?.role === 'staff' && <RoleCard title="Act as Staff" description="View assigned duties" href="/dashboard/staff" icon={UserCog} />}
            {userProfile?.is_agent && <RoleCard title="Act as Agent" description="View commissions & payouts" href="/dashboard/visitor/earnings" icon={Wallet} />}
            {premiseRoleCards}
            <div className="pt-4 mt-4 border-t border-white/5">
              <RoleCard title="Security Settings" description="Update password & recovery" href="/dashboard/change-password" icon={LockKeyhole} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

