
'use client';

import * as React from 'react';
import { useUser, useFirestore, useDoc } from '@/supabase';
import { useUserProfile } from '@/services/user-service';
import { useAnnouncementsForUser, type UserRole } from '@/services/announcement-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Megaphone, Info, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { Premise } from '@/services/premise-service';

interface AnnouncementsCardProps {
  role?: UserRole;
  premise_id?: string;
}

const AnnouncementsCardComponent = ({ role, premise_id }: AnnouncementsCardProps) => {
  const { user } = useUser();
  const { data: userProfile } = useUserProfile(user?.id);

  // If we are in a premise context (Owner/Host/Gatekeeper), load the premise to get its city/state
  const premiseDocRef = React.useMemo(() => {
    if (!premise_id) return null;
    return { table: 'premises', id: premise_id, __memo: true };
  }, [premise_id]);

  const { data: premise, isLoading: isPremiseLoading } = useDoc<Premise>(premiseDocRef);

  // Filter based on the current dashboard context
  const actingCity = premise?.city;
  const actingState = premise?.city_state;
  const actingCityId = premise?.cityId;

  const { data: announcements, isLoading, error } = useAnnouncementsForUser(
    userProfile,
    role,
    actingCityId,
    actingCity,
    actingState
  );

  const isActuallyLoading = isLoading || (!!premise_id && isPremiseLoading);

  return (
    <Card className="lg:col-span-5 glass-card border-white/5 overflow-hidden group relative">
      <div className="absolute inset-0 bg-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardHeader className="relative z-10">
        <CardTitle className="flex items-center gap-3 text-white">
          <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner group-hover:border-primary/50 group-hover:bg-primary/10 transition-all duration-500">
            <Megaphone className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          </div>
          <span className="text-xl font-headline tracking-tight">Announcements</span>
        </CardTitle>
        <CardDescription className="text-zinc-400 font-medium ml-13">
          Important updates and announcements for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="relative z-10">
        {isActuallyLoading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4 bg-[#010a05]/95 backdrop-blur-3xl/[0.01] rounded-2xl border border-white/5">
            <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
            <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse">Loading...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 text-center bg-red-500/5 border border-red-500/10 rounded-2xl p-6">
            <AlertTriangle className="h-8 w-8 mb-4 text-red-500" />
            <p className="font-bold text-red-500 uppercase tracking-tighter">Connection Error</p>
            <p className="text-xs text-red-500/70 mt-1">{error.message}</p>
          </div>
        ) : announcements && announcements.length > 0 ? (
          <ScrollArea className="h-64 pr-4">
            <div className="space-y-4">
              {announcements.map((ann) => (
                <div key={ann.id} className="p-5 border border-white/5 rounded-2xl bg-[#010a05]/95 backdrop-blur-3xl/[0.02] hover:bg-[#010a05]/95 backdrop-blur-3xl/[0.05] hover:border-white/10 transition-all group/item">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-white group-hover/item:text-primary transition-colors text-base">{ann.title}</h3>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 bg-white/5 px-2 py-0.5 rounded shadow-sm">
                      {ann.createdAt ? formatDistanceToNow(ann.createdAt, { addSuffix: true }) : 'Live'}
                    </p>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed italic border-l-2 border-primary/20 pl-4 py-1">
                    "{ann.message}"
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center bg-[#010a05]/95 backdrop-blur-3xl/[0.01] border border-white/5 rounded-2xl p-6">
            <Info className="h-8 w-8 mb-4 text-zinc-400 opacity-50" />
            <p className="font-bold text-zinc-400 uppercase tracking-widest text-xs">No Announcements</p>
            <p className="text-[10px] text-zinc-400 mt-1">There are no new updates at this time.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const AnnouncementsCard = React.memo(AnnouncementsCardComponent);

