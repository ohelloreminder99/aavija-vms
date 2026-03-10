'use client';

import * as React from 'react';
import { ArrowLeft, Loader2, Search, PhoneOff, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAllUsers, UserProfile, useUserProfile } from '@/services/user-service';
import Link from 'next/link';
import { WithId, useUser } from '@/supabase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { removeUserPhoneNumber } from './actions';
import { Badge } from '@/components/ui/badge';
import { createLogEntry } from '@/services/log-service';
import { LogAction } from '@/services/log-actions';
import { cn } from '@/lib/utils';

export default function AllUsersPage() {
  const { data: users, isLoading, error } = useAllUsers();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [userToManage, setUserToManage] = React.useState<WithId<UserProfile> | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const { data: adminProfile } = useUserProfile(user?.id);

  React.useEffect(() => {
    if (users && users.length > 0 && adminProfile) {
      createLogEntry({
        actorId: adminProfile.id,
        actorName: adminProfile.name,
        actorRole: 'admin',
        action: LogAction.VIEW_ALL_USERS_ADMIN,
        description: `Admin "${adminProfile.name}" viewed the all users dashboard.`
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, adminProfile]);

  const filteredUsers = React.useMemo(() => {
    if (!users) return [];
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.phone || '').includes(searchTerm)
    );
  }, [users, searchTerm]);

  const handleRemovePhoneConfirm = async () => {
    if (!userToManage) return;

    setIsSubmitting(true);
    const result = await removeUserPhoneNumber(userToManage.id);

    if (result.success) {
      toast({
        title: 'Phone Number Removed',
        description: `The phone number for ${userToManage.name} has been unlinked.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Action Failed',
        description: result.error,
      });
    }

    setIsSubmitting(false);
    setUserToManage(null);
  };

  const renderContent = () => {
    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    if (error) return (
      <div className="py-20 text-center text-red-500 border border-red-500/20 rounded-3xl bg-red-500/5">
        <Shield className="mx-auto h-10 w-10 mb-4 opacity-50" />
        <p className="font-bold uppercase tracking-widest text-[11px]">Identity Link Failure</p>
        <p className="text-[10px] opacity-60 mt-1">{error.message}</p>
      </div>
    );
    if (!users || users.length === 0) return (
      <div className="py-20 text-center text-zinc-600 border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02]">
        <Search className="mx-auto h-10 w-10 mb-4 opacity-20" />
        <p className="font-bold uppercase tracking-widest text-[11px]">Registry Empty</p>
        <p className="text-[10px] opacity-60 mt-1">No verified identities detected in the global mesh.</p>
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="relative group/search">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-700 group-focus-within/search:text-primary transition-colors" />
          <Input
            placeholder="Scan global registry by name, neural mail, or analog phone..."
            className="pl-12 bg-black/40 border-white/5 text-white h-12 rounded-2xl placeholder:text-zinc-800 focus:border-primary/30 transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="rounded-3xl border border-white/5 bg-black/20 overflow-hidden shadow-2xl">
          <Table>
            <TableHeader className="bg-white/[0.03]">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6 pl-8">Global Identity</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Architectural Role</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Linked Analog</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6 text-right pr-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user: WithId<UserProfile>) => {
                const isStaff = user.role === 'staff' || user.role === 'admin';
                return (
                  <TableRow key={user.id} className="border-white/5 hover:bg-white/[0.02] group/row transition-colors">
                    <TableCell className="pl-8 py-5">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 border border-white/10 group-hover/row:border-primary/30 transition-colors shadow-lg">
                          {user.photo_url && (
                            <AvatarImage
                              src={user.photo_url}
                              alt={user.name}
                            />
                          )}
                          <AvatarFallback className="bg-white/5 text-zinc-400 font-bold">{user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-bold text-white tracking-tight group-hover/row:text-primary transition-colors">{user.name}</span>
                          <span className="text-[10px] text-zinc-600 font-medium tracking-tight uppercase">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1",
                        user.role === 'admin' ? "bg-primary/5 text-primary border-primary/20" :
                          user.role === 'staff' ? "bg-purple-500/5 text-purple-400 border-purple-500/20" :
                            user.role === 'owner' ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20" :
                              user.role === 'host' ? "bg-blue-500/5 text-blue-400 border-blue-500/20" :
                                user.role === 'gatekeeper' ? "bg-amber-500/5 text-amber-400 border-amber-500/20" :
                                  "bg-white/5 text-zinc-500 border-white/10"
                      )}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.phone ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-zinc-500">{user.phone}</span>
                          {user.is_verified && (
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" title="Verified" />
                          )}
                        </div>
                      ) : (
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-800">No Analog</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setUserToManage(user)}
                        disabled={!user.phone}
                        className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-20"
                        title="Sever Analog Peripheral"
                      >
                        <PhoneOff className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-[11px] font-black text-zinc-800 uppercase tracking-[0.3em]">No matching identity in registry</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container py-10 max-w-7xl">
      <div className="mb-8">
        <Button asChild variant="ghost" className="text-zinc-500 hover:text-primary hover:bg-white/5 group/back">
          <Link href="/dashboard/admin" className="flex items-center">
            <ArrowLeft className="mr-3 h-4 w-4 group-hover/back:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Back to Intelligence Hub</span>
          </Link>
        </Button>
      </div>

      <Card className="glass-card border-white/5 shadow-2xl relative overflow-hidden mb-20">
        <div className="absolute inset-0 mesh-blue opacity-5 pointer-events-none" />
        <CardHeader className="relative z-10 border-b border-white/5 pb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-4xl font-headline font-bold text-white tracking-tight">Global <span className="text-primary/80">Registry</span></CardTitle>
          </div>
          <CardDescription className="text-zinc-500 text-[11px] font-medium uppercase tracking-widest max-w-2xl leading-relaxed">
            The master directory of all verified neural signatures within the Aavija global mesh. Oversight of unit classification and link authentication.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 pt-8">{renderContent()}</CardContent>
      </Card>

      <AlertDialog open={!!userToManage} onOpenChange={(open) => !open && setUserToManage(null)}>
        <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight text-red-500">Sever Analog Link?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
              This will permanently remove the neural bind for phone <span className="text-white font-bold">{userToManage?.phone}</span> from <span className="text-white font-bold">{userToManage?.name}</span>&apos;s identity profile.
              The Operative will need to establish a new analog link to utilize mobile-dependent protocols.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 pt-6">
            <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-500 hover:text-white hover:bg-white/5">Abort</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemovePhoneConfirm} disabled={isSubmitting} className="bg-red-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sever Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

