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
                <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                    <p className="mb-2 font-semibold">No Visitors Blocked</p>
                    <p className="text-sm">
                        You have not blocked any visitors from this premise.
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
                        <TableHead>Blocked By</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {premiseBlocks.map((block: WithId<PremiseBlock>) => {
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
                                    {block.blockedAt ? formatDistanceToNow(new Date(block.blockedAt), { addSuffix: true }) : 'Just now'}
                                </TableCell>
                                <TableCell>
                                    {userProfile?.name}
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
                    <Link href={`/dashboard/owner?premiseId=${premiseId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Premise Block List</CardTitle>
                    <CardDescription>
                        A list of all visitors who are blocked from entering your premise.
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

