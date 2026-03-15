'use client';

import * as React from 'react';
import { ArrowLeft, Loader2, Search, Users, CheckCircle2 } from 'lucide-react';
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
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useCollection, WithId, useUser } from '@/supabase';
import { Visit } from '@/services/visit-service';
import { verifyVisitByHost } from '../actions';

export default function HostActiveVisitsPage() {
    const searchParams = useSearchParams();
    const premiseId = searchParams.get('premiseId');
    const { user } = useUser();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [isVerifying, setIsVerifying] = React.useState<string | null>(null);

    const activeVisitsQuery = React.useMemo(() => {
        if (!premiseId || !user) return null;

        return {
            table: 'visits',
            filters: [
                { column: 'premise_id', operator: 'eq' as const, value: premiseId },
                { column: 'host_id', operator: 'eq' as const, value: user.id },
                { column: 'status', operator: 'eq' as const, value: 'active' }
            ],
            orderBy: { column: 'checkin_time', ascending: false },
            __memo: true
        };
    }, [premiseId, user]);

    const { data: visits, isLoading, error } = useCollection<Visit>(activeVisitsQuery);

    const handleVerify = async (visitId: string) => {
        if (!premiseId || !user) return;
        setIsVerifying(visitId);
        try {
            const result = await verifyVisitByHost({
                visitId,
                premiseId,
                hostId: user.id
            });
            if (result.success) {
                toast({
                    title: "Verified",
                    description: "Meeting has been verified successfully.",
                });
            } else {
                throw new Error(result.error);
            }
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: err.message || "Failed to verify visit.",
            });
        } finally {
            setIsVerifying(null);
        }
    };

    const filteredVisits = React.useMemo(() => {
        if (!visits) return [];
        const lowercasedFilter = searchTerm.toLowerCase();
        return visits.filter((v) =>
            v.visitor_name.toLowerCase().includes(lowercasedFilter)
        );
    }, [visits, searchTerm]);

    if (!premiseId) return null;

    return (
        <div className="container py-10">
            <div className="mb-6">
                <Button asChild variant="ghost" className="text-zinc-400 hover:text-primary hover:bg-white/5 group/back">
                    <Link href={`/dashboard/host?premiseId=${premiseId}`} className="flex items-center">
                        <ArrowLeft className="mr-3 h-4 w-4 group-hover/back:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
                    </Link>
                </Button>
            </div>

            <Card className="glass-card border-white/5 shadow-2xl relative overflow-hidden mb-20">
                <CardHeader className="relative z-10 border-b border-white/5 pb-6 bg-[#020617]/40">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                            <Users className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-headline font-bold text-white tracking-tight">Active <span className="text-primary/60">Visitors</span></CardTitle>
                    </div>
                    <CardDescription className="text-zinc-400 text-[10px] font-medium uppercase tracking-[0.2em] max-w-2xl leading-relaxed">
                        Manage and verify current visitors at this premise.
                    </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10 pt-8">
                    {isLoading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-10 text-destructive">
                            <p>Failed to load active visits.</p>
                        </div>
                    ) : filteredVisits.length === 0 ? (
                        <div className="text-center py-20 text-zinc-500 border border-dashed border-white/10 rounded-2xl">
                            <p>No active visitors at the moment.</p>
                        </div>
                    ) : (
                        <>
                            <div className="relative mb-6">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                                <Input
                                    placeholder="Search visitors..."
                                    className="pl-10 bg-white/5 border-white/10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Table>
                                <TableHeader className="bg-[#020617]/95 backdrop-blur-3xl/[0.03]">
                                    <TableRow className="border-white/5 hover:bg-transparent">
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 pl-8">Visitor</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4">Checked In</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4">Status</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 text-right pr-8">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredVisits.map((visit: WithId<Visit>) => (
                                        <TableRow key={visit.id} className="border-white/5 hover:bg-white/5">
                                            <TableCell className="font-bold text-white tracking-tight pl-8">{visit.visitor_name}</TableCell>
                                            <TableCell className="text-zinc-400 text-[11px] font-medium">
                                                {formatDistanceToNow(new Date(visit.checkin_time), { addSuffix: true })}
                                            </TableCell>
                                            <TableCell>
                                                {visit.host_verified_at ? (
                                                    <div className="flex items-center gap-2 text-green-500">
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        <span className="text-xs font-bold uppercase tracking-wider">Verified</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-bold uppercase tracking-wider text-amber-500/80">Awaiting Verification</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                                {!visit.host_verified_at && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleVerify(visit.id)}
                                                        disabled={isVerifying === visit.id}
                                                        className="h-8 bg-primary text-white font-black uppercase tracking-widest text-[9px] px-6 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:scale-[1.02] transition-all"
                                                    >
                                                        {isVerifying === visit.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Meeting"}
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
