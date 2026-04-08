'use client';

import * as React from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useUser } from '@/supabase';
import { unblockVisitorFromHost } from '@/services/block-service';
import { getBlockedVisitorsForHost, type SerializableHostBlock } from './actions';

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
import { useSettings } from '@/services/settings-service';
import { useUserProfile } from '@/services/user-service';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';


export default function HostBlockedPage() {
    const { user } = useUser();
    const { data: userProfile } = useUserProfile(user?.id);
    const { toast } = useToast();
    const { data: settings } = useSettings();
    const searchParams = useSearchParams();
    const premiseId = searchParams.get('premise_id');

    const [blocks, setBlocks] = React.useState<SerializableHostBlock[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [refreshKey, setRefreshKey] = React.useState(0);

    const [visitorToUnblock, setVisitorToUnblock] = React.useState<{ id: string, name: string } | null>(null);
    const [isUnblocking, setIsUnblocking] = React.useState(false);

    const unblockCost = settings?.unblock_visitor_cost_host || 0;

    React.useEffect(() => {
        if (!user?.id) {
            setIsLoading(false);
            return;
        };

        const fetchBlocks = async () => {
            setIsLoading(true);
            setError(null);
            const result = await getBlockedVisitorsForHost(user.id, premiseId || undefined);
            if (result.success && result.blocks) {
                setBlocks(result.blocks);
            } else {
                setError(result.error || 'Failed to load blocklist.');
            }
            setIsLoading(false);
        }

        fetchBlocks();
    }, [user?.id, refreshKey]);


    const handleUnblockConfirm = async () => {
        if (!visitorToUnblock || !user || !userProfile) return;

        setIsUnblocking(true);
        const result = await unblockVisitorFromHost({
            host_id: user.id,
            premise_id: premiseId || '', // Pass premiseId
            visitor_id: visitorToUnblock.id,
            actor_id: user.id,
            actor_name: userProfile.name,
            actor_role: 'host',
        });

        if (result.success) {
            toast({
                title: 'Visitor Unblocked',
                description: `${visitorToUnblock.name} is no longer blocked from visiting you.`
            });
            setRefreshKey(key => key + 1); // Trigger a refetch of the list
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
                    <p className="text-sm">{error}</p>
                </div>
            );
        }

        if (!blocks || blocks.length === 0) {
            return (
                <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                    <p className="mb-2 font-semibold">No Visitors Blocked</p>
                    <p className="text-sm">
                        You have not personally blocked any visitors.
                    </p>
                </div>
            );
        }

        return (
            <Table>
                <TableHeader className="bg-[#010a05]/95 backdrop-blur-3xl/[0.03]">
                    <TableRow className="border-white/5 hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 pl-8">Visitor</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4">Blocked On</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 text-right pr-8">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {blocks.map((block) => {
                        return (
                            <TableRow key={block.id} className="border-white/5 hover:bg-[#010a05]/95 backdrop-blur-3xl/[0.02] group/row transition-colors">
                                <TableCell className="pl-8 py-4">
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
                                    {formatDistanceToNow(new Date(block.blockedAt), { addSuffix: true })}
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
                    <Link href={`/dashboard/host?premiseId=${premiseId}`} className="flex items-center">
                        <ArrowLeft className="mr-3 h-4 w-4 group-hover/back:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
                    </Link>
                </Button>
            </div>
            <Card className="glass-card border-white/5 shadow-2xl relative overflow-hidden mb-20">
                <CardHeader className="relative z-10 border-b border-white/5 pb-6 bg-[#010a05]/40">
                    <CardTitle className="text-2xl font-headline font-bold text-white tracking-tight">Blocked <span className="text-red-500/60">Visitors</span></CardTitle>
                    <CardDescription className="text-zinc-400 text-[10px] font-medium uppercase tracking-[0.2em] mt-1">
                        You have restricted these individuals from visiting you at this premise.
                    </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10 pt-8">
                    {renderContent()}
                </CardContent>
            </Card>

            <AlertDialog open={!!visitorToUnblock} onOpenChange={(open) => !open && setVisitorToUnblock(null)}>
                <AlertDialogContent className="bg-[#010a05]/95 border-white/10 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure you want to unblock this visitor?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will allow <span className="font-bold">{visitorToUnblock?.name}</span> to check-in to visit you again. {unblockCost > 0 && `This will cost ${unblockCost} tokens.`}
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

