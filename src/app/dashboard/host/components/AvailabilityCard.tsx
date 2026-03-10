'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser, useDoc, WithId } from '@/supabase';
import { UserProfile } from '@/services/user-service';
import { Premise, StaffMember } from '@/services/premise-service';
import { setHostAvailability } from '../actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AvailabilityCardProps {
  hostProfile: WithId<UserProfile> | null;
  premiseId: string | undefined;
}

const availabilityOptions = [
  { value: 'available', label: 'Available', color: 'bg-emerald-500' },
  { value: 'busy', label: 'Busy', color: 'bg-amber-500' },
  { value: 'do-not-disturb', label: 'Do Not Disturb', color: 'bg-red-500' },
];

export function AvailabilityCard({ hostProfile, premiseId }: AvailabilityCardProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const docRef = React.useMemo(() => {
    if (!premiseId) return null;
    return { table: 'premises', id: premiseId, __memo: true };
  }, [premiseId]);
  const { data: premise, isLoading: isPremiseLoading } = useDoc<Premise>(docRef);

  const hostStaffInfo = React.useMemo(() => {
    if (!premise || !hostProfile) return null;
    return premise.staff?.find(s => s.uid === hostProfile.id);
  }, [premise, hostProfile]);

  const currentDbAvailability = hostStaffInfo?.availability || 'available';
  const [selectedAvailability, setSelectedAvailability] = React.useState(currentDbAvailability);

  React.useEffect(() => {
    // When the data from the database changes, update our local selection
    setSelectedAvailability(currentDbAvailability);
  }, [currentDbAvailability]);

  const handleSave = async () => {
    if (!hostProfile || !premiseId || selectedAvailability === currentDbAvailability) return;

    setIsSubmitting(true);
    const result = await setHostAvailability({
      hostId: hostProfile.id,
      premiseId: premiseId,
      availability: selectedAvailability,
    });

    if (result.success) {
      toast({
        title: 'Status Updated',
        description: `Your availability has been saved as "${availabilityOptions.find(o => o.value === selectedAvailability)?.label}".`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: result.error || 'Could not update your availability status.',
      });
      // On failure, revert local state to match the database
      setSelectedAvailability(currentDbAvailability);
    }
    setIsSubmitting(false);
  };

  const selectedOption = availabilityOptions.find(o => o.value === selectedAvailability);

  return (
    <Card className="glass-card border-white/5 shadow-2xl overflow-hidden relative">
      <div className="absolute inset-0 mesh-obsidian opacity-10 pointer-events-none" />
      <CardHeader className="relative z-10 border-b border-white/5 pb-8">
        <CardTitle className="text-3xl font-headline font-bold text-white tracking-tight">Availability <span className="text-primary/80">Status</span></CardTitle>
        <CardDescription className="text-zinc-400 mt-2">
          Update your availability status for the entry gate.
        </CardDescription>
      </CardHeader>
      <CardContent className="relative z-10 pt-8">
        {isPremiseLoading ? (
          <div className="flex h-32 flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">Loading...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[240px]">
                <Select
                  value={selectedAvailability}
                  onValueChange={(val) => setSelectedAvailability(val as any)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-12">
                    <SelectValue>
                      <div className="flex items-center gap-3">
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          <span className={cn("h-3 w-3 rounded-full ring-2 ring-white/5", selectedOption?.color, {
                            "shadow-[0_0_12px_rgba(16,185,129,0.5)]": selectedAvailability === 'available',
                            "shadow-[0_0_12px_rgba(245,158,11,0.5)]": selectedAvailability === 'busy',
                            "shadow-[0_0_12px_rgba(239,68,68,0.5)]": selectedAvailability === 'do-not-disturb',
                          })}></span>
                        )}
                        <span className="font-bold uppercase tracking-widest text-xs">{selectedOption?.label}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-[#020617] border-white/10 text-white">
                    {availabilityOptions.map(option => (
                      <SelectItem key={option.value} value={option.value} className="focus:bg-white/5 cursor-pointer">
                        <div className="flex items-center gap-3 py-1">
                          <span className={cn("h-2.5 w-2.5 rounded-full ring-1 ring-white/10", option.color)}></span>
                          <span className="font-bold uppercase tracking-widest text-[10px]">{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleSave}
                disabled={isSubmitting || selectedAvailability === currentDbAvailability}
                className="h-12 px-8 bg-primary text-white font-black uppercase tracking-widest text-[10px] hover:bg-primary/90 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Update Status'}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/10 group/status">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 group-hover/status:drop-shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-all">Available</p>
                <p className="text-[10px] text-zinc-500 leading-tight">Gatekeepers can authorize visitors for instant entry.</p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-500/[0.03] border border-amber-500/10 group/status">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1 group-hover/status:drop-shadow-[0_0_8px_rgba(245,158,11,0.4)] transition-all">Busy</p>
                <p className="text-[10px] text-zinc-500 leading-tight">You are busy but can still be contacted.</p>
              </div>
              <div className="p-4 rounded-2xl bg-red-500/[0.03] border border-red-500/10 group/status">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1 group-hover/status:drop-shadow-[0_0_8px_rgba(239,68,68,0.4)] transition-all">DND</p>
                <p className="text-[10px] text-zinc-500 leading-tight">Do not disturb. Gatekeeper will not send visitors.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

