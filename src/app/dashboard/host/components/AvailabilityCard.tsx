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
    <Card>
      <CardHeader>
        <CardTitle>Your Availability</CardTitle>
        <CardDescription>
          Set your status to inform gatekeepers what to do when a visitor arrives for you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPremiseLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Select
                value={selectedAvailability}
                onValueChange={(val) => setSelectedAvailability(val as any)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className={cn("h-3 w-3 rounded-full", selectedOption?.color)}></span>
                      )}
                      <span>{selectedOption?.label}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availabilityOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <span className={cn("h-3 w-3 rounded-full", option.color)}></span>
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleSave}
                disabled={isSubmitting || selectedAvailability === currentDbAvailability}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Status'}
              </Button>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground pt-2">
              <p><strong className="text-emerald-600">Available:</strong> Gatekeepers can check-in visitors for you as normal.</p>
              <p><strong className="text-amber-600">Busy:</strong> Gatekeepers will see you are busy but can still check-in visitors.</p>
              <p><strong className="text-red-600">Do Not Disturb:</strong> Gatekeepers cannot select you for check-in.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

