'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useCollection, WithId } from '@/supabase';
import { Visit } from '@/services/visit-service';
import { Loader2, ShieldCheck, Clock, MapPin, User, LogOut } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface EGatepassCardProps {
    checkinId: string;
}

export function EGatepassCard({ checkinId }: EGatepassCardProps) {
    const [timeInside, setTimeInside] = useState<string>('00:00:00');

    // Fetch the active visit details
    const visitQuery = React.useMemo(() => {
        return {
            table: 'visits',
            filters: [{ column: 'id', operator: 'eq' as const, value: checkinId }],
            __memo: true
        };
    }, [checkinId]);

    const { data: visits, isLoading } = useCollection<Visit>(visitQuery);
    const visit = visits?.[0];

    // Live timer calculating duration inside the premise
    useEffect(() => {
        if (!visit?.checkin_time) return;

        const updateTimer = () => {
            const start = visit.checkin_time.toDate().getTime();
            const now = Date.now();
            const diffStr = new Date(now - start).toISOString().substring(11, 19);
            // e.g "03:14:05"
            setTimeInside(diffStr);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [visit?.checkin_time]);

    if (isLoading) {
        return (
            <Card className="flex items-center justify-center p-6 min-h-[400px] glass-card border-white/5">
                <Loader2 className="h-10 w-10 animate-spin text-white/20" />
            </Card>
        );
    }

    if (!visit) {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* The E-Gatepass Glassmorphism Card */}
            <div className="relative overflow-hidden rounded-[2rem] bg-zinc-900/40 p-[1px] shadow-2xl border border-white/5 group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/5 group-hover:from-primary/30 transition-all duration-500" />

                <div className="relative z-10 backdrop-blur-3xl rounded-[2rem] p-8 h-full border border-white/5 overflow-hidden">
                    {/* Security Watermark */}
                    <ShieldCheck className="absolute -right-12 -top-12 w-64 h-64 text-white/5 transform rotate-12 pointer-events-none" />

                    <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-8">
                        <div className="flex items-center space-x-4">
                            <div className="h-12 w-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.1)]">
                                <ShieldCheck className="w-7 h-7 text-green-500 animate-pulse" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">E-GATEPASS</h2>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">Authorized Access</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-ping shadow-[0_0_10px_#22c55e]" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Status</span>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-1">
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black flex items-center"><MapPin className="w-3 h-3 mr-2 text-primary" /> Facility Designation</p>
                                <p className="text-2xl font-bold text-white tracking-tight">{visit.premise_name || 'Classified Location'}</p>
                            </div>

                            <div className="space-y-1">
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black flex items-center"><User className="w-3 h-3 mr-2 text-primary" /> Security Context</p>
                                <p className="text-xl font-bold text-white flex items-center">
                                    <span className="opacity-50 text-sm mr-2 font-medium italic">Visiting:</span>
                                    {visit.host_name || 'General Access'}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
                            <div className="bg-white/[0.02] p-6 space-y-1">
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black flex items-center"><Clock className="w-3 h-3 mr-2 text-primary" /> Check-in Sequence</p>
                                <p className="text-lg font-bold text-white">{visit.checkin_time.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                            </div>
                            <div className="bg-white/[0.02] p-6 space-y-1 border-l border-white/5 text-right">
                                <p className="text-[10px] text-primary uppercase tracking-widest font-black inline-flex items-center">Operational Duration <Clock className="w-3 h-3 ml-2" /></p>
                                <p className="text-4xl font-black text-white tracking-tighter tabular-nums text-glow">{timeInside}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Checkout Warning Alert */}
            <Alert className="bg-red-500/10 border-red-500/20 text-red-500 rounded-2xl p-6">
                <LogOut className="h-6 w-6 text-red-500 mr-4" />
                <div className="space-y-1">
                    <AlertTitle className="text-lg font-black uppercase tracking-tight">Checkout Protocol Required</AlertTitle>
                    <AlertDescription className="text-sm font-medium opacity-80 leading-relaxed">
                        Security tracking is active for <strong>{visit.premise_name}</strong>.
                        You must physically manifest a checkout with the Gatekeeper to terminate this session before initiating a new sequence.
                    </AlertDescription>
                </div>
            </Alert>
        </div>
    );
}
