'use client';

import * as React from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useUser, WithId } from '@/supabase';
import { useUserProfile, usePremiseBlocks, PremiseBlock } from '@/services/user-service';
import { unblockVisitorFromPremise } from '@/services/block-service';

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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'next/navigation';


export default function BlockedVisitorsPage() {
    const { user } = useUser();
    const { data: userProfile } = useUserProfile(user?.id);
    const searchParams = useSearchParams();
    const premiseId = searchParams.get('premiseId') ?? undefined;

    const { data: premiseBlocks, isLoading, error } = usePremiseBlocks(premiseId, user?.id);

    const [visitorToUnblock, setVisitorToUnblock] = React.useState<{ id: string, name: string } | null>(null);
    const [isUnblocking, setIsUnblocking] = React.useState(false);
    const { toast } = useToast();


    const handleUnblockConfirm = async () => {
        if (!visitorToUnblock || !userProfile || !premiseId) return;

        setIsUnblocking(true);
        const result = await unblockVisitorFromPremise({
            premiseId,
            visitorId: visitorToUnblock.id,
            actorId: userProfile.id,
            actorName: userProfile.name,
            actorRole: 'owner',
        });

        if (result.success) {
            toast({
                title: 'Visitor Unblocked',
                description: `${visitorToUnblock.name} is no longer blocked from this premise.`
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'Unblocking Failed',
                description: result.error
            });
        }
        setIsUnblocking(false);
        setVisitorToUnblock(null);
    }

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            );
        }

        if (error) {
            return (
                <div className="text-center text-destructive py-10">
                    <p>An error occurred while fetching your blocked list.</p>
                    <p className="text-sm">{error.message}</p>
                </div>
            );
        }

        if (!premiseBlocks || premiseBlocks.length === 0) {
            return (
                <div className="py-12 text-center text-zinc-400 border-2 border-dashed border-white/5 rounded-2xl bg-[#020617]/95 backdrop-blur-3xl/[0.02]">
                    <p className="mb-2 font-black uppercase tracking-widest text-[11px]">No Visitors Blocked</p>
                    <p className="text-[10px] opacity-60">
                        You have not blocked any visitors from this premise.
                    </p>
                </div>
            );
        }

        return (
            <Table>
                <TableHeader className="bg-[#020617]/95 backdrop-blur-3xl/[0.03]">
                    <TableRow className="border-white/5 hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 pl-8">Visitor</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4">Blocked On</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4">Blocked By</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 text-right pr-8">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {premiseBlocks.map((block: WithId<PremiseBlock>) => {
                        return (
                            <TableRow key={block.id}>
                                <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9 border border-white/10">
                                                <AvatarImage src={block.visitorPhotoUrl} alt={block.visitorName} />
                                                <AvatarFallback className="bg-white/5 text-zinc-400 text-xs font-bold">{block.visitorName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-bold text-white tracking-tight">{block.visitorName}</div>
                                            </div>
                                        </div>
                                </TableCell>
                                <TableCell className="text-zinc-400 text-[11px] font-medium">
                                    {block.blockedAt ? formatDistanceToNow(new Date(block.blockedAt), { addSuffix: true }) : 'Just now'}
                                </TableCell>
                                <TableCell className="text-zinc-400 text-[11px] font-medium">
                                    {userProfile?.name}
                                </TableCell>
                                <TableCell className="text-right pr-8">
                                    <Button variant="outline" size="sm" onClick={() => setVisitorToUnblock({ id: block.id, name: block.visitorName })} className="h-8 bg-white/5 border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all">
                                        Unblock
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        );
    }

    return (
        <div className="container py-10">
            <div className="mb-4">
                <Button asChild variant="ghost" className="text-zinc-400 hover:text-primary hover:bg-white/5 group/back">
                    <Link href={`/dashboard/owner?premiseId=${premiseId}`} className="flex items-center">
                        <ArrowLeft className="mr-3 h-4 w-4 group-hover/back:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
                    </Link>
                </Button>
            </div>
            <Card className="glass-card border-white/5 shadow-2xl relative overflow-hidden mb-20">
                <CardHeader className="relative z-10 border-b border-white/5 pb-6 bg-[#020617]/40">
                    <CardTitle className="text-2xl font-headline font-bold text-white tracking-tight">Blocked <span className="text-red-500/60">Visitors</span></CardTitle>
                    <CardDescription className="text-zinc-400 text-[10px] font-medium uppercase tracking-[0.2em] mt-1">
                        Manage restricted individuals for this premise.
                    </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10 pt-8">
                    {renderContent()}
                </CardContent>
            </Card>

            <AlertDialog open={!!visitorToUnblock} onOpenChange={(open) => !open && setVisitorToUnblock(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure you want to unblock this visitor?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will allow <span className="font-bold">{visitorToUnblock?.name}</span> to check-in to this premise again.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUnblockConfirm} disabled={isUnblocking}>
                            {isUnblocking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Unblock Visitor
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

