'use client';

import * as React from 'react';
import { Star, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { submitRatingAndRecalculate } from '../../actions';
import { WithId } from '@/supabase';
import { UserProfile } from '@/services/user-service';

interface SerializableVisit {
    id: string;
    visitor_id: string;
    host_id: string;
    premise_id: string;
    visitor_name: string;
    // ... other fields as needed, match the type from actions
}

const StarRatingInput = ({
    rating,
    setRating,
}: {
    rating: number;
    setRating: (rating: number) => void;
}) => {
    const [hoverRating, setHoverRating] = React.useState(0);
    return (
        <div className="flex items-center gap-1.5 p-4 rounded-2xl bg-white/[0.03] border border-white/5 shadow-inner">
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    className={cn(
                        'h-10 w-10 cursor-pointer text-zinc-800 transition-all duration-300 transform hover:scale-110',
                        (hoverRating || rating) >= star
                            ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                            : 'hover:text-zinc-600'
                    )}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                />
            ))}
        </div>
    );
};

export function RatingDialog({
    visit,
    hostProfile,
    open,
    onOpenChange,
}: {
    visit: any | null; // using any for now to avoid complex re-declaration of types here, or import it if possible
    hostProfile: WithId<UserProfile> | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [rating, setRating] = React.useState(0);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const { toast } = useToast();

    const handleSubmit = async () => {
        if (!visit || !hostProfile) {
            toast({ variant: 'destructive', title: 'Error', description: 'Missing user or visit data to submit rating.' })
            return;
        }
        if (rating === 0) {
            toast({
                variant: 'destructive',
                title: 'Rating Required',
                description: 'Please select at least one star.',
            });
            return;
        }
        setIsSubmitting(true);
        const result = await submitRatingAndRecalculate({
            visitId: visit.id,
            visitorId: (visit as any).visitor_id,
            hostId: hostProfile.id,
            premiseId: (visit as any).premise_id,
            rating,
            actor: {
                id: hostProfile.id,
                name: hostProfile.name,
                role: 'host',
            },
        });

        if (result.success) {
            toast({
                title: 'Rating Submitted!',
                description: `You've rated ${visit.visitor_name}.`,
            });
            onOpenChange(false);
        } else {
            toast({
                variant: 'destructive',
                title: 'Submission Failed',
                description: result.error,
            });
        }
        setIsSubmitting(false);
    };

    React.useEffect(() => {
        if (open) {
            setRating(0);
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#020617]/90 border-white/10 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                <DialogHeader className="space-y-4">
                    <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <Star className="h-6 w-6 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    </div>
                    <div>
                        <DialogTitle className="text-2xl font-headline font-bold text-white tracking-tight">Rate Your Visitor</DialogTitle>
                        <DialogDescription className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1">
                            Rating visit for <span className="text-primary">{visit?.visitor_name}</span>
                        </DialogDescription>
                    </div>
                </DialogHeader>
                <div className="py-8 space-y-8">
                    <div className="flex flex-col items-center gap-6">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Overall Experience</p>
                        <StarRatingInput rating={rating} setRating={setRating} />
                    </div>
                </div>
                <DialogFooter className="gap-3">
                    <DialogClose asChild>
                        <Button variant="ghost" className="text-zinc-500 hover:text-white hover:bg-white/5 border-white/5">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0} className="bg-primary text-white font-black uppercase tracking-widest text-[10px] h-12 px-8 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Submit Rating'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
