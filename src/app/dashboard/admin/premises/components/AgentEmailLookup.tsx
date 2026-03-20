'use client';

import * as React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { lookupUserByEmail } from '@/services/agent-service';

type AgentLookupResult = { id: string; name: string; photo_url: string; is_agent: boolean } | null;

interface AgentEmailLookupProps {
    value: string;
    initialEmail?: string;
    initialName?: string;
    onChange: (agentId: string) => void;
}

export function AgentEmailLookup({ value, initialEmail, initialName, onChange }: AgentEmailLookupProps) {
    const [email, setEmail] = React.useState(initialEmail || '');
    const [lookupResult, setLookupResult] = React.useState<AgentLookupResult>(
        initialName ? { id: value, name: initialName, photo_url: '', is_agent: true } : null
    );
    const [isLooking, setIsLooking] = React.useState(false);
    const [lookupError, setLookupError] = React.useState<string | null>(null);

    // Auto-lookup if value is provided and initialEmail is provided
    React.useEffect(() => {
        if (value && initialEmail && !lookupResult && !isLooking) {
            handleVerify(initialEmail);
        }
    }, [value, initialEmail, lookupResult, isLooking]);

    const handleVerify = async (emailToVerify?: string) => {
        const targetEmail = (typeof emailToVerify === 'string' ? emailToVerify : '') || email || '';
        if (!targetEmail || typeof targetEmail !== 'string' || !targetEmail.trim()) return;
        
        const finalEmail = targetEmail.trim();

        setIsLooking(true);
        setLookupError(null);
        setLookupResult(null);
        const result = await lookupUserByEmail(finalEmail);
        if (result.success && result.user) {
            setLookupResult(result.user);
            setEmail(finalEmail); // Sync internal email state
            onChange(result.user.id);
        } else {
            if (typeof emailToVerify !== 'string') { // Only show error if manual ping
                setLookupError(result.error || 'User not found.');
                onChange('');
            }
        }
        setIsLooking(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    type="email"
                    placeholder="Scan via neural mail..."
                    className="bg-black/40 border-white/5 text-white h-11 rounded-xl placeholder:text-zinc-300"
                    value={email}
                    aria-label="Agent email lookup"
                    onChange={(e) => {
                        setEmail(e.target.value);
                        setLookupResult(null);
                        onChange('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleVerify())}
                />
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleVerify()}
                    disabled={isLooking || !email}
                    className="h-11 border-white/5 hover:bg-white/5 text-[10px] font-black uppercase tracking-widest px-6"
                >
                    {isLooking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ping'}
                </Button>
            </div>
            {lookupError && (
                <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest ml-1">
                    {lookupError}
                </p>
            )}
            {lookupResult && (
                <div className="flex items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 animate-in fade-in slide-in-from-top-2">
                    <Avatar className="h-10 w-10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                        <AvatarImage src={lookupResult.photo_url} />
                        <AvatarFallback className="bg-emerald-500/10 text-emerald-400">
                            {lookupResult.name.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-emerald-400 leading-none mb-1">
                            {lookupResult.name}
                        </p>
                        <p className="text-[9px] text-emerald-500/60 font-black uppercase tracking-widest">
                            {lookupResult.is_agent ? 'Active Sales Agent' : 'User Found'}
                        </p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                </div>
            )}
            {!lookupResult && !lookupError && (
                <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.2em] ml-1">
                    Enter email to find a registered user.
                </p>
            )}
        </div>
    );
}
