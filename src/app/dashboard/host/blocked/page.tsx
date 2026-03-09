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


export default function HostBlockedPage() {
    const { user } = useUser();
    const { data: userProfile } = useUserProfile(user?.id);
    const { toast } = useToast();
    const { data: settings } = useSettings();

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
            const result = await getBlockedVisitorsForHost(user.id);
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
            hostId: user.id,
            visitorId: visitorToUnblock.id,
            actorId: user.id,
            actorName: userProfile.name,
            actorRole: 'host',
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
                <TableHeader>
                    <TableRow>
                        <TableHead>Visitor</TableHead>
                        <TableHead>Blocked On</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {blocks.map((block) => {
                        return (
                            <TableRow key={block.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarImage src={block.visitorPhotoUrl} alt={block.visitorName} />
                                            <AvatarFallback>{block.visitorName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="font-medium">{block.visitorName}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {formatDistanceToNow(new Date(block.blockedAt), { addSuffix: true })}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm" onClick={() => setVisitorToUnblock({ id: block.id, name: block.visitorName })}>
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
                <Button asChild variant="outline">
                    <Link href="/dashboard">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Your Global Blocklist</CardTitle>
                    <CardDescription>
                        Visitors on this list are blocked from checking in to see you at any of your assigned premises.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {renderContent()}
                </CardContent>
            </Card>

            <AlertDialog open={!!visitorToUnblock} onOpenChange={(open) => !open && setVisitorToUnblock(null)}>
                <AlertDialogContent>
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

