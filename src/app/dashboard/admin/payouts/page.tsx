'use client';

import * as React from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, ArrowLeft, Receipt, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { adminProcessPayout, adminRejectPayout, getPayoutRequestsForAdmin, type PayoutRequest } from '@/services/agent-service';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type EnrichedRequest = PayoutRequest & { userName: string; userEmail: string; userPhoto: string };

const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
        pending: { label: 'Pending', variant: 'secondary' },
        processing: { label: 'Processing', variant: 'default' },
        paid: { label: 'Paid', variant: 'outline' },
        rejected: { label: 'Rejected', variant: 'destructive' },
    };
    const s = map[status] || { label: status, variant: 'secondary' };
    return <Badge variant={s.variant}>{s.label}</Badge>;
};

export default function AdminPayoutsPage() {
    const { toast } = useToast();
    const [requests, setRequests] = React.useState<EnrichedRequest[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState('pending');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Approval dialog
    const [approveTarget, setApproveTarget] = React.useState<EnrichedRequest | null>(null);
    const [utrNote, setUtrNote] = React.useState('');

    // Reject dialog
    const [rejectTarget, setRejectTarget] = React.useState<EnrichedRequest | null>(null);
    const [rejectReason, setRejectReason] = React.useState('');

    const fetchRequests = React.useCallback(async () => {
        setIsLoading(true);
        const result = await getPayoutRequestsForAdmin();
        if (result.success && result.data) {
            setRequests(result.data);
        }
        setIsLoading(false);
    }, []);

    React.useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const handleApprove = async () => {
        if (!approveTarget) return;
        if (approveTarget.type === 'cash' && !utrNote.trim()) {
            toast({ variant: 'destructive', title: 'UTR Required', description: 'Enter the transaction/UTR reference number before marking as paid.' });
            return;
        }
        setIsSubmitting(true);
        const res = await adminProcessPayout(approveTarget.id, approveTarget.type === 'cash' ? utrNote : undefined);
        if (res.success) {
            toast({ title: 'Payout Processed', description: `${approveTarget.type === 'cash' ? 'Payment confirmed' : 'Tokens credited'} for ${approveTarget.userName}.` });
            fetchRequests();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: res.error });
        }
        setApproveTarget(null);
        setUtrNote('');
        setIsSubmitting(false);
    };

    const handleReject = async () => {
        if (!rejectTarget || !rejectReason.trim()) return;
        setIsSubmitting(true);
        const res = await adminRejectPayout(rejectTarget.id, rejectReason);
        if (res.success) {
            toast({ title: 'Request Rejected', description: `Payout rejected. ${rejectTarget.userName} notified.` });
            fetchRequests();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: res.error });
        }
        setRejectTarget(null);
        setRejectReason('');
        setIsSubmitting(false);
    };

    const filtered = requests.filter(r => activeTab === 'all' ? true : r.status === activeTab);
    const pendingCount = requests.filter(r => r.status === 'pending').length;

    return (
        <div className="container py-10 max-w-6xl">
            <div className="flex items-center gap-4 mb-6">
                <Button asChild variant="outline" size="sm"><Link href="/dashboard/admin"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
                <div>
                    <h1 className="text-2xl font-bold">Payout Requests</h1>
                    <p className="text-sm text-muted-foreground">Review and process agent and referral payout requests.</p>
                </div>
                {pendingCount > 0 && <Badge variant="destructive" className="ml-auto">{pendingCount} Pending</Badge>}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                    <TabsTrigger value="pending">Pending {pendingCount > 0 && `(${pendingCount})`}</TabsTrigger>
                    <TabsTrigger value="processing">Processing</TabsTrigger>
                    <TabsTrigger value="paid">Paid</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected</TabsTrigger>
                    <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab}>
                    <Card>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
                            ) : filtered.length === 0 ? (
                                <div className="py-16 text-center text-muted-foreground">No {activeTab === 'all' ? '' : activeTab} requests.</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>User</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Requested</TableHead>
                                            <TableHead>UPI / Note</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.map(req => (
                                            <TableRow key={req.id} className={cn(req.status === 'pending' && 'bg-amber-50/30')}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={req.userPhoto} />
                                                            <AvatarFallback>{req.userName.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="text-sm font-medium">{req.userName}</p>
                                                            <p className="text-xs text-muted-foreground">{req.userEmail}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {req.type === 'cash'
                                                        ? <span className="flex items-center gap-1 text-sm"><Receipt className="h-4 w-4" /> Cash</span>
                                                        : <span className="flex items-center gap-1 text-sm"><Coins className="h-4 w-4" /> Tokens</span>
                                                    }
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">₹{req.amount.toFixed(2)}</p>
                                                        {req.type === 'cash' && req.tds_deducted ? (
                                                            <p className="text-xs text-muted-foreground">Net: ₹{req.net_amount?.toFixed(2)} (TDS: ₹{req.tds_deducted})</p>
                                                        ) : null}
                                                        {req.type === 'token_conversion' && (
                                                            <p className="text-xs text-muted-foreground">{req.tokens_credited} tokens @ {req.conversion_rate}x</p>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{statusBadge(req.status)}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {new Date(req.requested_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </TableCell>
                                                <TableCell className="text-xs max-w-[150px] truncate" title={req.upi_id || req.admin_note || ''}>
                                                    {req.upi_id || req.admin_note || '—'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {(req.status === 'pending' || req.status === 'processing') && (
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="sm" onClick={() => setApproveTarget(req)}>
                                                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                                                {req.type === 'cash' ? 'Mark Paid' : 'Approve'}
                                                            </Button>
                                                            <Button size="sm" variant="destructive" onClick={() => setRejectTarget(req)}>
                                                                <XCircle className="h-4 w-4 mr-1" />Reject
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Approve Dialog */}
            <Dialog open={!!approveTarget} onOpenChange={open => !open && setApproveTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{approveTarget?.type === 'cash' ? 'Confirm Payment' : 'Approve Token Conversion'}</DialogTitle>
                        <DialogDescription>
                            {approveTarget?.type === 'cash'
                                ? `Pay ₹${approveTarget?.net_amount?.toFixed(2) || approveTarget?.amount?.toFixed(2)} to ${approveTarget?.userName} via UPI (${approveTarget?.upi_id}) and enter the reference.`
                                : `Credit ${approveTarget?.tokens_credited} tokens to ${approveTarget?.userName}. This is irreversible.`
                            }
                        </DialogDescription>
                    </DialogHeader>
                    {approveTarget?.type === 'cash' && (
                        <div className="space-y-2">
                            <Label htmlFor="utr">UTR / Transaction Reference *</Label>
                            <Input id="utr" placeholder="e.g. 403456789012" value={utrNote} onChange={e => setUtrNote(e.target.value)} />
                        </div>
                    )}
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleApprove} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {approveTarget?.type === 'cash' ? 'Confirm Paid' : 'Credit Tokens'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={!!rejectTarget} onOpenChange={open => !open && setRejectTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Payout Request</DialogTitle>
                        <DialogDescription>Provide a reason. The user's balance will remain and they can resubmit.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="reason">Reason for rejection *</Label>
                        <Textarea id="reason" placeholder="e.g. Incorrect UPI ID provided. Please update and resubmit." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button variant="destructive" onClick={handleReject} disabled={isSubmitting || !rejectReason.trim()}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Reject Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
