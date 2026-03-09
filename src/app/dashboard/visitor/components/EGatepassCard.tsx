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
            <Card className="flex items-center justify-center p-6 min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </Card>
        );
    }

    if (!visit) {
        return null; // Will fallback if data is somehow deleted
    }

    return (
        <div className="space-y-6">
            {/* The E-Gatepass Glassmorphism Card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 via-primary/70 to-primary/40 p-[1px] shadow-2xl">
                <div className="absolute inset-0 bg-black/10 backdrop-blur-3xl z-0 pointer-events-none" />

                <div className="relative z-10 bg-card/80 backdrop-blur-xl rounded-2xl p-6 h-full border border-white/20 shadow-inner">
                    <div className="flex items-center justify-between border-b border-primary/20 pb-4 mb-4">
                        <div className="flex items-center space-x-2">
                            <ShieldCheck className="w-8 h-8 text-green-500 animate-pulse" />
                            <h2 className="text-2xl font-black text-primary tracking-tight">E-GATEPASS</h2>
                        </div>
                        <div className="flex items-center space-x-2 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/30">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                            <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">Active</span>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1 flex items-center"><MapPin className="w-3 h-3 mr-1" /> Premise</p>
                            <p className="text-xl font-bold leading-tight">{visit.premise_name || 'Unknown Location'}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-xl border border-primary/10">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1 flex items-center"><User className="w-3 h-3 mr-1" /> Visitor</p>
                                <p className="font-semibold truncate">{visit.visitor_name}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1 flex items-center"><User className="w-3 h-3 mr-1" /> Host</p>
                                <p className="font-semibold truncate">{visit.host_name || 'N/A'}</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1 flex items-center"><Clock className="w-3 h-3 mr-1" /> Time In</p>
                                <p className="font-medium">{visit.checkin_time.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-primary uppercase tracking-widest font-bold mb-1">Duration</p>
                                <p className="text-2xl font-mono font-bold text-primary">{timeInside}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Checkout Warning Alert */}
            <Alert variant="destructive" className="border-2 shadow-lg bg-destructive/5">
                <LogOut className="h-5 w-5" />
                <AlertTitle className="text-lg font-bold ml-2">Checkout Required</AlertTitle>
                <AlertDescription className="ml-2 mt-1 text-sm leading-relaxed">
                    You are currently checked in at <strong>{visit.premise_name}</strong>.
                    To generate a new QR code for another location, you must physically checkout with the Gatekeeper at this premise when leaving.
                </AlertDescription>
            </Alert>
        </div>
    );
}
