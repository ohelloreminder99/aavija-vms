
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
  premiseId?: string;
}

const AnnouncementsCardComponent = ({ role, premiseId }: AnnouncementsCardProps) => {
  const { user } = useUser();
  const { data: userProfile } = useUserProfile(user?.id);

  // If we are in a premise context (Owner/Host/Gatekeeper), load the premise to get its city/state
  const premiseDocRef = React.useMemo(() => {
    if (!premiseId) return null;
    return { table: 'premises', id: premiseId, __memo: true };
  }, [premiseId]);

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

  const isActuallyLoading = isLoading || (!!premiseId && isPremiseLoading);

  return (
    <Card className="lg:col-span-5 glass-card border-white/5 overflow-hidden group">
      <CardHeader className="relative z-10">
        <CardTitle className="flex items-center gap-3 text-white">
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Megaphone className="h-4 w-4 text-primary" />
          </div>
          System Announcements
        </CardTitle>
        <CardDescription className="text-zinc-500 font-medium">
          Official intelligence and security updates from Aavija Command.
        </CardDescription>
      </CardHeader>
      <CardContent className="relative z-10">
        {isActuallyLoading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4 bg-white/[0.02] rounded-2xl border border-white/5">
            <Loader2 className="h-8 w-8 animate-spin text-white/20" />
            <p className="text-zinc-500 text-xs animate-pulse">Retrieving encrypted data...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 text-center bg-red-500/5 border border-red-500/10 rounded-2xl p-6">
            <AlertTriangle className="h-8 w-8 mb-4 text-red-500" />
            <p className="font-bold text-red-500 uppercase tracking-tight">Signal Interrupted</p>
            <p className="text-xs text-red-500/70 mt-1">{error.message}</p>
          </div>
        ) : announcements && announcements.length > 0 ? (
          <ScrollArea className="h-64 pr-4">
            <div className="space-y-4">
              {announcements.map((ann) => (
                <div key={ann.id} className="p-5 border border-white/5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] transition-all group/item">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-white group-hover/item:text-primary transition-colors">{ann.title}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                      {ann.createdAt ? formatDistanceToNow(ann.createdAt.toDate(), { addSuffix: true }) : 'Live'}
                    </p>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed italic">
                    "{ann.message}"
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <Info className="h-8 w-8 mb-4 text-zinc-700" />
            <p className="font-bold text-zinc-500 uppercase tracking-tight">Zero Activity</p>
            <p className="text-xs text-zinc-600 mt-1">No new transmissions detected in your sectors.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const AnnouncementsCard = React.memo(AnnouncementsCardComponent);

