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
            <Card className="glass-card border-white/5 min-h-[160px]">
                <CardHeader>
                    <Skeleton className="h-5 w-3/4 bg-white/5" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-8 w-1/2 bg-white/5" />
                    <Skeleton className="h-4 w-full mt-2 bg-white/5" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="glass-card border-white/5 group hover:border-white/10 transition-all duration-300">
            <CardHeader>
                <CardTitle className="text-zinc-400 text-sm font-medium uppercase tracking-widest">Global Trust Rating</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-4xl font-bold text-white group-hover:text-glow transition-all">{userProfile?.global_rating?.toFixed(1) ?? '0.0'}</span>
                    <span className="text-zinc-500 font-medium tracking-tighter">/ 5.0</span>
                </div>
                <div>
                    {renderStars(userProfile?.global_rating ?? 0)}
                </div>
                <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-4 opacity-80">
                    Aggregate reputation from host validations.
                </p>
            </CardContent>
        </Card>
    );
}

export const RatingCard = React.memo(RatingCardComponent);

