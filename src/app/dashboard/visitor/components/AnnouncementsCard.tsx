
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
    <Card className="lg:col-span-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Announcements
        </CardTitle>
        <CardDescription>
          Updates and important messages from the admin team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isActuallyLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-destructive bg-destructive/10 rounded-lg p-4">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p className="font-semibold">Could not load announcements</p>
            <p className="text-sm">{error.message}</p>
          </div>
        ) : announcements && announcements.length > 0 ? (
          <ScrollArea className="h-64 pr-4">
            <div className="space-y-4">
              {announcements.map((ann) => (
                <div key={ann.id} className="p-4 border rounded-lg bg-background">
                  <h3 className="font-semibold">{ann.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-2">
                    {ann.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ann.createdAt ? formatDistanceToNow(ann.createdAt.toDate(), { addSuffix: true }) : 'Recently'}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground bg-muted/50 rounded-lg">
            <Info className="h-8 w-8 mb-2" />
            <p className="font-semibold">No new announcements</p>
            <p className="text-sm">You're all caught up!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const AnnouncementsCard = React.memo(AnnouncementsCardComponent);

