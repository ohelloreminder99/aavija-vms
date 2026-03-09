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
    <Card className={cn("hover:bg-accent hover:text-accent-foreground transition-colors", title === "Change Your Password" && "bg-yellow-50 hover:bg-yellow-100")}>
      <CardHeader className="flex flex-row items-center gap-4">
        <Icon className="h-8 w-8 text-primary" />
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
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
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <AavijaLogo />
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Your Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="container max-w-3xl py-12">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6">
          <div className="flex flex-col items-center space-y-2 text-center"><AavijaLogo /><h1 className="text-2xl font-semibold tracking-tight">Select Your Role</h1><p className="text-sm text-muted-foreground">Choose the context you want to act in.</p></div>
          <div className="space-y-4">
            <RoleCard title="Act as Visitor" description="Check-in to a new premise" href="/dashboard/visitor" icon={User} />
            {isAdmin && <RoleCard title="Act as Admin" description="Manage the entire system" href="/dashboard/admin" icon={UserCog} />}
            {userProfile?.role === 'staff' && <RoleCard title="Act as Staff" description="View duties" href="/dashboard/staff" icon={UserCog} />}
            {userProfile?.is_agent && <RoleCard title="Act as Agent" description="View commissions & payouts" href="/dashboard/visitor/earnings" icon={Wallet} />}
            {premiseRoleCards}
            <RoleCard title="Change Your Password" description="Update security" href="/dashboard/change-password" icon={LockKeyhole} />
          </div>
        </div>
      </div>
    </div>
  );
}

