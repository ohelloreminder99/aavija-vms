'use client';

import * as React from 'react';
import { 
    Users, 
    Search, 
    ArrowLeft, 
    Loader2, 
    Trash2, 
    Power 
} from 'lucide-react';
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
import { useUserProfile } from '@/services/user-service';
import { useUser, useDoc } from '@/supabase';
import { Premise } from '@/services/premise-service';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { toggleHostStatus, removeHostFromPremise, backfillHostAvailability } from './actions';
import { usePremiseMembers, PremiseMember } from '@/services/premise-service';
import { Badge } from '@/components/ui/badge';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { AddHostDialog } from './components/AddHostDialog';
import { BulkImportDialog } from './components/BulkImportDialog';

export default function HostsPage() {
    const router = useRouter();
    const { user } = useUser();
    const { data: userProfile } = useUserProfile(user?.id);
    const searchParams = useSearchParams();
    const premiseId = searchParams.get('premise_id') ?? undefined;

    const docRef = React.useMemo(() => {
        if (!premiseId) return null;
        return { table: 'premises', id: premiseId, __memo: true };
    }, [premiseId]);

    const { data: premise, isLoading: isPremiseLoading } = useDoc<Premise>(docRef);

    const [page, setPage] = React.useState(0);
    const pageSize = 50;
    const [searchTerm, setSearchTerm] = React.useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    
    const { data: hosts, isLoading: isLoadingHosts } = usePremiseMembers(premiseId || '', 'host', { 
        searchTerm: debouncedSearchTerm,
        page,
        pageSize
    });

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [hostToToggle, setHostToToggle] = React.useState<PremiseMember | null>(null);
    const [hostToRemove, setHostToRemove] = React.useState<PremiseMember | null>(null);
    const [isMigrating, setIsMigrating] = React.useState(false);

    const { toast } = useToast();

    const handleBackfill = async () => {
        if (!premiseId) return;
        setIsMigrating(true);
        const result = await backfillHostAvailability(premiseId);
        if (result.success) {
            toast({ title: "Update Complete", description: result.message });
        } else {
            toast({ variant: 'destructive', title: "Update Failed", description: result.error });
        }
        setIsMigrating(false);
    };

    const handleToggleStatusConfirm = async () => {
        if (!hostToToggle || !userProfile || !premiseId) return;
        setIsSubmitting(true);
        try {
            const newStatus = !(hostToToggle.is_active ?? true);
            const result = await toggleHostStatus({
                host_id: hostToToggle.user_id,
                hostName: hostToToggle.user?.name || 'Unknown',
                newStatus: newStatus,
                actor: { id: userProfile.id, name: userProfile.name, role: 'owner' },
                premise_id: premiseId,
            });
            if (result.success) {
                toast({ title: 'Success', description: `Host ${hostToToggle.user?.name || 'Unknown'} has been ${newStatus ? 'activated' : 'deactivated'}.` });
                router.refresh();
            } else {
                toast({ variant: 'destructive', title: 'Action Failed', description: result.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'An Unexpected Error Occurred', description: "Something went wrong." });
        } finally {
            setIsSubmitting(false);
            setHostToToggle(null);
        }
    };

    const handleRemoveConfirm = async () => {
        if (!hostToRemove || !userProfile || !premiseId) return;
        setIsSubmitting(true);
        try {
            const result = await removeHostFromPremise({ 
                host_id: hostToRemove.user_id, 
                hostName: hostToRemove.user?.name || 'Unknown', 
                premise_id: premiseId, 
                actor: { id: userProfile.id, name: userProfile.name, role: 'owner' } 
            });
            if (result.success) {
                toast({ title: 'Host Removed', description: `${hostToRemove.user?.name || 'Unknown'} has been removed from this premise.` });
                router.refresh();
            } else {
                toast({ variant: 'destructive', title: 'Removal Failed', description: result.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'An Unexpected Error Occurred', description: "Something went wrong." });
        } finally {
            setIsSubmitting(false);
            setHostToRemove(null);
        }
    };

    const filteredHosts = hosts || [];

    const renderContent = () => {
        if (isPremiseLoading || isLoadingHosts) return <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
        
        if (!hosts || hosts.length === 0) return (
            <div className="py-12 text-center text-zinc-400 border-2 border-dashed border-white/5 rounded-2xl bg-[#010a05]/95 backdrop-blur-3xl/[0.02]">
                <Users className="mx-auto h-8 w-8 mb-3 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-[11px]">No Hosts Found</p>
                <p className="text-[10px] opacity-60 mt-1">Add host records or use bulk import to populate the list.</p>
            </div>
        );

        return (
            <div className="space-y-6">
                <div className="rounded-3xl border border-white/5 bg-black/20 overflow-hidden shadow-2xl">
                    <Table>
                        <TableHeader className="bg-[#010a05]/95 backdrop-blur-3xl/[0.03]">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 pl-8">Host Name</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4">Unit / Flat No.</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 text-center">Status</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 text-right pr-8">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredHosts.map((host) => {
                                const isActive = host.is_active ?? true;
                                return (
                                    <TableRow key={host.id} className="border-white/5 hover:bg-[#010a05]/95 backdrop-blur-3xl/[0.02] group/row transition-colors">
                                        <TableCell className="pl-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <Avatar className="h-10 w-10 border border-white/10 group-hover/row:border-primary/30 transition-colors">
                                                        {host.user?.photo_url && <AvatarImage src={host.user.photo_url} alt={host.user.name} />}
                                                        <AvatarFallback className="bg-white/5 text-zinc-400 font-bold">{host.user?.name?.charAt(0) || '?'}</AvatarFallback>
                                                    </Avatar>
                                                    <div className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#010a05]", isActive ? "bg-emerald-500" : "bg-red-500")} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-white tracking-tight group-hover/row:text-primary transition-colors">{host.user?.name || 'Unknown'}</span>
                                                    <span className="text-[10px] text-zinc-400 font-medium tracking-tight uppercase">{host.user?.email || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-[11px] font-black text-zinc-400 tracking-widest uppercase bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 inline-block group-hover/row:border-white/10 transition-colors">
                                                {host.identity}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={isActive ? 'outline' : 'destructive'} className={cn(
                                                "text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1",
                                                isActive ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20" : "bg-red-500/5 text-red-500 border-red-500/20"
                                            )}>
                                                {isActive ? 'Active' : 'Deactivated'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className='text-right pr-8'>
                                            <div className="flex items-center justify-end gap-2">
                                                <Button variant="ghost" size="icon" title={isActive ? 'Deactivate' : 'Activate'} onClick={() => setHostToToggle(host)} className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
                                                    <Power className={cn("h-4 w-4", isActive ? "text-red-500/50 group-hover/row:text-red-500" : "text-emerald-500/50 group-hover/row:text-emerald-500")} />
                                                </Button>
                                                <Button variant="ghost" size="icon" title="Remove" onClick={() => setHostToRemove(host)} className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-all">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex items-center justify-between px-2 py-4">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                        Showing page <span className="text-white">{page + 1}</span>
                    </p>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={page === 0} 
                            onClick={() => setPage(p => p - 1)}
                            className="bg-white/5 border-white/5 text-zinc-400 h-8 rounded-lg uppercase text-[9px] font-black tracking-widest px-4 disabled:opacity-20"
                        >
                            Previous
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={!hosts || hosts.length < pageSize} 
                            onClick={() => setPage(p => p + 1)}
                            className="bg-white/5 border-white/5 text-zinc-400 h-8 rounded-lg uppercase text-[9px] font-black tracking-widest px-4 disabled:opacity-20"
                        >
                            Next
                        </Button>
                    </div>
                </div>

                {filteredHosts.length === 0 && (
                    <div className="py-20 text-center">
                        <p className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.3em]">No matching host found</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="container py-10 max-w-7xl">
            <div className="mb-8 flex items-center justify-between">
                <Button asChild variant="ghost" className="text-zinc-400 hover:text-primary hover:bg-white/5 group/back">
                    <Link href={`/dashboard/owner?premiseId=${premiseId}`} className="flex items-center">
                        <ArrowLeft className="mr-3 h-4 w-4 group-hover/back:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
                    </Link>
                </Button>

                <div className="flex items-center gap-3">
                    <div className="relative group/search hidden sm:block">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 group-focus-within/search:text-primary transition-colors" />
                        <Input
                            placeholder="SEARCH HOSTS..."
                            className="pl-11 h-11 w-64 bg-white/5 border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <BulkImportDialog 
                        premiseId={premiseId} 
                        userId={userProfile?.id}
                        userName={userProfile?.name}
                    />

                    <AddHostDialog 
                        premiseId={premiseId} 
                        premiseCity={premise?.city}
                        userId={userProfile?.id} 
                        userName={userProfile?.name} 
                    />
                </div>
            </div>

            <Card className="glass-card border-white/5 shadow-2xl relative overflow-hidden mb-20">
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-20" />
                <CardHeader className="relative z-10 border-b border-white/5 pb-8 bg-[#010a05]/40">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                            <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                        <CardTitle className="text-2xl font-headline font-bold text-white tracking-tight">Host <span className="text-primary/60">Management</span></CardTitle>
                        <CardDescription className="text-zinc-400 text-[10px] font-medium uppercase tracking-[0.2em] mt-1">
                            Manage residents and their unit assignments.
                        </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="relative z-10 pt-8">
                    <div className="sm:hidden mb-6">
                        <div className="relative group/search-mobile">
                            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 group-focus-within/search-mobile:text-primary transition-colors" />
                            <Input
                                placeholder="SEARCH HOSTS..."
                                className="pl-12 bg-white/5 border-white/5 text-white h-12 rounded-2xl placeholder:text-zinc-600 focus:border-primary/30 transition-all font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    {renderContent()}
                </CardContent>
            </Card>

            <AlertDialog open={!!hostToToggle} onOpenChange={(open) => { if (!open) { setHostToToggle(null); } }}>
                <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight">Change Host Status?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
                            You are about to <span className="text-primary font-bold">{hostToToggle?.is_active ?? true ? 'deactivate' : 'activate'}</span> {hostToToggle?.user?.name || 'this host'}.
                            {hostToToggle?.is_active ?? true ? ' They will no longer be visible to visitors at the gate.' : ' They will reappear in the visitor selection list.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 pt-6">
                        <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-400 hover:text-white hover:bg-white/5">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleToggleStatusConfirm} disabled={isSubmitting} className="bg-primary text-[#010a05] font-black uppercase tracking-widest text-[10px] h-11 px-8 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!hostToRemove} onOpenChange={(open) => { if (!open) { setHostToRemove(null); } }}>
                <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight text-red-500">Remove Host?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
                            This will remove <span className="text-white font-bold">{hostToRemove?.user?.name || 'this host'}</span> from your premise.
                            They will lose access to this premise but will still be able to use the app as a visitor.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 pt-6">
                        <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-400 hover:text-white hover:bg-white/5">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveConfirm} disabled={isSubmitting} className="bg-red-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
