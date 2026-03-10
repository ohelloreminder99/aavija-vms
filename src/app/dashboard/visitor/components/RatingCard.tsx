'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useUser } from "@/supabase";
import { useUserProfile } from "@/services/user-service";
import { Star, StarHalf } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const RatingCardComponent = () => {
    const { user, isUserLoading } = useUser();
    const { data: userProfile, isLoading: isProfileLoading } = useUserProfile(user?.id);
    const isLoading = isUserLoading || isProfileLoading;

    const renderStars = (rating: number) => {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

        return (
            <div className="flex items-center gap-1 text-amber-500">
                {[...Array(fullStars)].map((_, i) => <Star key={`full-${i}`} className="h-5 w-5 fill-current" />)}
                {halfStar && <StarHalf key="half" className="h-5 w-5 fill-current" />}
                {[...Array(emptyStars)].map((_, i) => <Star key={`empty-${i}`} className="h-5 w-5" />)}
            </div>
        )
    }

    if (isLoading) {
        return (
            <Card className="glass-card border-white/5 min-h-[160px] relative overflow-hidden">
                <div className="absolute inset-0 bg-white/[0.01]" />
                <CardHeader className="relative z-10">
                    <Skeleton className="h-5 w-3/4 bg-white/5" />
                </CardHeader>
                <CardContent className="relative z-10">
                    <Skeleton className="h-8 w-1/2 bg-white/5" />
                    <Skeleton className="h-4 w-full mt-2 bg-white/5" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="glass-card border-white/5 group hover:border-primary/30 transition-all duration-500 relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="relative z-10 pb-2">
                <CardTitle className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Trust Score</CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
                <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-5xl font-bold text-white group-hover:text-glow transition-all duration-300 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                        {userProfile?.global_rating?.toFixed(1) ?? '0.0'}
                    </span>
                    <span className="text-zinc-500 font-bold tracking-tight text-sm">/ 5.0</span>
                </div>
                <div className="bg-white/[0.02] inline-flex p-2 rounded-lg border border-white/5 shadow-inner">
                    {renderStars(userProfile?.global_rating ?? 0)}
                </div>
                <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mt-6 border-t border-white/5 pt-4">
                    Total rating from <span className="text-primary/80">Hosts</span>.
                </p>
            </CardContent>
        </Card>
    );
}

export const RatingCard = React.memo(RatingCardComponent);

