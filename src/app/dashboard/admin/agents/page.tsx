'use client';

import * as React from 'react';
import { Loader2, ArrowLeft, ShieldCheck, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { getAgentsOverview, adminApproveKyc, removeAgentDesignation, type AgentOverview } from '@/services/agent-service';
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function AdminAgentsPage() {
    const { toast } = useToast();
    const [agents, setAgents] = React.useState<AgentOverview[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [removeTarget, setRemoveTarget] = React.useState<AgentOverview | null>(null);

    const fetchAgents = React.useCallback(async () => {
        setIsLoading(true);
        const res = await getAgentsOverview();
        if (res.success && res.data) setAgents(res.data);
        setIsLoading(false);
    }, []);

    React.useEffect(() => { fetchAgents(); }, [fetchAgents]);

    const handleApproveKyc = async (userId: string, name: string) => {
        setIsSubmitting(true);
        const res = await adminApproveKyc(userId);
        if (res.success) {
            toast({ title: 'KYC Verified', description: `${name} is now KYC verified and can request payouts.` });
            fetchAgents();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: res.error });
        }
        setIsSubmitting(false);
    };

    const handleRemove = async () => {
        if (!removeTarget) return;
        setIsSubmitting(true);
        const res = await removeAgentDesignation(removeTarget.id);
        if (res.success) {
            toast({ title: 'Agent Removed', description: `${removeTarget.name} is no longer designated as an agent.` });
            fetchAgents();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: res.error });
        }
        setRemoveTarget(null);
        setIsSubmitting(false);
    };

    return (
        <div className="container py-10 max-w-6xl">
            <div className="flex items-center gap-4 mb-6">
                <Button asChild variant="outline" size="sm"><Link href="/dashboard/admin"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
                <div>
                    <h1 className="text-2xl font-bold">Agents Overview</h1>
                    <p className="text-sm text-muted-foreground">
                        All users designated as agents. To assign an agent to a premise, use the Premises page and type their email.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Active Agents ({agents.length})</CardTitle>
                    <CardDescription>Sorted by highest commission balance.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : agents.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground">
                            <p>No agents designated yet.</p>
                            <p className="text-xs mt-1">Assign agents from the Premises page by typing a user's email.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Agent</TableHead>
                                    <TableHead>Commission Balance</TableHead>
                                    <TableHead>UPI ID</TableHead>
                                    <TableHead>PAN</TableHead>
                                    <TableHead>KYC</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {agents.map(agent => (
                                    <TableRow key={agent.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={agent.photo_url} />
                                                    <AvatarFallback>{agent.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium">{agent.name}</p>
                                                    <p className="text-xs text-muted-foreground">{agent.email}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">₹{agent.agent_commission_balance.toFixed(2)}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{agent.agent_payout_upi || '—'}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{agent.pan_number || '—'}</TableCell>
                                        <TableCell>
                                            {agent.kyc_verified
                                                ? <Badge variant="outline" className="text-green-600 border-green-200"><ShieldCheck className="h-3 w-3 mr-1" />Verified</Badge>
                                                : <Badge variant="secondary"><ShieldX className="h-3 w-3 mr-1" />Pending</Badge>
                                            }
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {!agent.kyc_verified && agent.pan_number && (
                                                    <Button size="sm" variant="outline" onClick={() => handleApproveKyc(agent.id, agent.name)} disabled={isSubmitting}>
                                                        <ShieldCheck className="h-4 w-4 mr-1" />Verify KYC
                                                    </Button>
                                                )}
                                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setRemoveTarget(agent)}>
                                                    Remove
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!removeTarget} onOpenChange={open => !open && setRemoveTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Agent Designation?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {removeTarget?.name} will no longer be an agent. Their commission history and balance remain intact. This action can be reversed by reassigning them from the Premises page.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemove} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
